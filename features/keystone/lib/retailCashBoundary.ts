import type { IdempotencyKey, Prisma, User } from "@prisma/client";
import {
  assertBusinessPermission,
  assertStorePermission,
  isHumanPlatformAdmin,
  type PermissionKey,
  type EmployeeSessionData,
  type Session,
} from "../access";

export const retailCommandScopes = new Set([
  "createPosCart",
  "addPosCartLine",
  "updatePosCartLine",
  "removePosCartLine",
  "transitionPosCart",
  "openEmployeeShift",
  "completePosSale",
  "refundPosSale",
  "voidCompletedPosSale",
  "openRegisterSession",
  "recordCashMovement",
  "closeRegisterSession",
  "closeEmployeeShift",
  "generateStoreDayReconciliation",
  "approveStoreDayReconciliation",
  "prepareBankDeposit",
  "transitionBankDeposit",
]);

export function retailStoreLock(
  scope: string,
  businessId: string,
  storeId: string,
) {
  return {
    key: `retail-period:${businessId}:${storeId}`,
    exclusive: [
      "closeEmployeeShift",
      "generateStoreDayReconciliation",
      "approveStoreDayReconciliation",
    ].includes(scope),
  };
}

export function retailRegisterLockKey(
  businessId: string,
  storeId: string,
  registerSessionId: string,
) {
  return `retail-register:${businessId}:${storeId}:${registerSessionId}`;
}

// A narrow read port keeps authority fixtures honest without pretending to
// implement every generated Prisma delegate method.
export type RetailAuthorityPort = {
  user: { findUnique(args: { where: { id: string }; select: { id: true; sessionVersion: true; isPlatformAdmin: true; platformAdminApprovedAt: true } }): Promise<Pick<User, "id" | "sessionVersion" | "isPlatformAdmin" | "platformAdminApprovedAt"> | null> };
  employee: { findMany(args: { where: { userId: string; businessId: string; status: "active" }; select: { id: true; status: true; business: { select: { id: true; status: true } }; role: true; stores: { select: { id: true; businessId: true } } } }): Promise<EmployeeSessionData[]> };
  apiKey: { findFirst(args: { where: Prisma.ApiKeyWhereInput; select: { scopes: true; allStores: true; expiresAt: true; stores: { select: { id: true } } } }): Promise<{ scopes: unknown; allStores: boolean; expiresAt?: Date | null; stores: { id: string }[] } | null> };
  store: { findFirst(args: { where: Prisma.StoreWhereInput; select: { id: true } }): Promise<{ id: string } | null> };
};

/** Reload only authority, never PIN hashes, tokens or signing material. */
export async function currentRetailSession(
  prisma: RetailAuthorityPort,
  session: Session,
  businessId: string,
  storeId: string | null,
  permission: PermissionKey,
  mode: "execute" | "read" = "execute",
): Promise<Session> {
  const user = await prisma.user.findUnique({
    where: { id: session.itemId },
    select: {
      id: true,
      sessionVersion: true,
      isPlatformAdmin: true,
      platformAdminApprovedAt: true,
    },
  });
  if (
    !user ||
    user.id !== session.itemId ||
    (!session.apiKeyId && user.sessionVersion !== session.data.sessionVersion)
  ) {
    throw new Error("Retail actor session is no longer current");
  }
  const fresh: Session = {
    ...session,
    data: {
      ...session.data,
      isPlatformAdmin: user.isPlatformAdmin,
      platformAdminApprovedAt: user.platformAdminApprovedAt,
      employees: [],
    },
  };
  if (session.apiKeyId) {
    const key = await prisma.apiKey.findFirst({
      where: {
        id: session.apiKeyId,
        businessId,
        createdById: session.itemId,
        status: "active",
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: {
        scopes: true,
        allStores: true,
        expiresAt: true,
        stores: { select: { id: true } },
      },
    });
    // Keep the SQL expiry predicate and also inspect a returned stale port row.
    // This is boundary evidence, not a physical COMMIT-time expiry fence.
    if (!key || (key.expiresAt !== null && key.expiresAt !== undefined && key.expiresAt <= new Date())) throw new Error("Retail API key is no longer active");
    fresh.apiKeyScopes = Array.isArray(key.scopes) ? key.scopes.filter((scope): scope is string => typeof scope === "string") : [];
    fresh.apiKeyAllStores = key.allStores;
    fresh.apiKeyStoreIds = key.stores.map((store: { id: string }) => store.id);
  } else {
    fresh.data.employees = await prisma.employee.findMany({
      where: { userId: session.itemId, businessId, status: "active" },
      select: {
        id: true,
        status: true,
        business: { select: { id: true, status: true } },
        role: true,
        stores: { select: { id: true, businessId: true } },
      },
    });
  }
  assertBusinessPermission(fresh, businessId, permission);
  if (!storeId) return fresh;
  assertStorePermission(fresh, businessId, storeId, permission);
  const store = await prisma.store.findFirst({
    where: {
      id: storeId,
      businessId,
      ...(mode === "execute" ? { status: { not: "closed" } } : {}),
      // Preserve existing approved human-admin historical read scope. Other
      // principals still need an active business; NEW always does too.
      ...((mode === "execute" || !isHumanPlatformAdmin(fresh)) ? { business: { status: "active" } } : {}),
    },
    select: { id: true },
  });
  if (!store) throw new Error("Available retail store not found");
  return fresh;
}

export function assertRetailReplay(
  record: Pick<IdempotencyKey, "businessId" | "scope" | "actorUserId" | "actorApiKeyId" | "metadata">,
  session: Session,
  businessId: string,
  scope: string,
  storeId: string | null,
) {
  const metadata = record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata) ? record.metadata : {};
  if (
    record.businessId !== businessId ||
    record.scope !== scope ||
    record.actorUserId !== (session.apiKeyId ? null : session.itemId) ||
    record.actorApiKeyId !== (session.apiKeyId ?? null) ||
    (metadata.storeId != null && metadata.storeId !== storeId)
  ) {
    throw new Error("Retail command belongs to a different actor or store");
  }
}

export function assertRetailRegister(
  session: any,
  businessId: string,
  storeId: string,
  currencyCode?: string,
) {
  if (
    !session ||
    session.businessId !== businessId ||
    session.storeId !== storeId ||
    session.status !== "open" ||
    !session.register ||
    session.register.businessId !== businessId ||
    session.register.storeId !== storeId ||
    session.register.status !== "active" ||
    !session.employee ||
    session.employee.businessId !== businessId ||
    session.employee.status !== "active" ||
    !session.employee.stores.some(
      (store: { id: string }) => store.id === storeId,
    )
  ) {
    throw new Error(
      "Open retail register and current employee assignment required",
    );
  }
  if (
    session.shiftId &&
    (!session.shift ||
      session.shift.businessId !== businessId ||
      session.shift.storeId !== storeId ||
      session.shift.employeeId !== session.employeeId ||
      !["clocked_in", "on_break"].includes(session.shift.status))
  ) {
    throw new Error("Register shift is no longer active at this store");
  }
  if (currencyCode && session.store?.currencyCode !== currencyCode)
    throw new Error("Retail register currency does not match sale");
}

export const retailRegisterInclude = {
  register: true,
  shift: true,
  store: true,
  employee: { include: { stores: { select: { id: true } } } },
};

/** Opening float is itself a movement, so do not add it a second time. */
export async function assertCashLedger(
  prisma: any,
  session: {
    id: string;
    businessId: string | null;
    storeId: string | null;
    expectedCashCents: number;
  },
) {
  const totals = await Promise.all(
    (["in", "out"] as const).map((direction) =>
      prisma.cashMovement.aggregate({
        where: {
          businessId: session.businessId,
          storeId: session.storeId,
          registerSessionId: session.id,
          direction,
        },
        _sum: { amountCents: true },
      }),
    ),
  );
  const expected =
    (totals[0]._sum.amountCents ?? 0) - (totals[1]._sum.amountCents ?? 0);
  if (
    !Number.isSafeInteger(expected) ||
    expected < 0 ||
    expected !== session.expectedCashCents
  ) {
    throw new Error(
      "Register cash checkpoint does not reconcile to immutable movements; review before posting or closing",
    );
  }
  return expected;
}

export function assertSameRegisterClose(
  session: any,
  input: { countedCashCents: number; notes?: string | null },
) {
  if (
    session.countedCashCents !== input.countedCashCents ||
    session.closingNotes !== (input.notes?.trim() || "")
  ) {
    throw new Error(
      "Closed register count or notes differ from original close; use its original command key for recovery",
    );
  }
}

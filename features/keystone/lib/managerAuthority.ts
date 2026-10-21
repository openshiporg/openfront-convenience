import { createHash, randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  assertStorePermission,
  type PermissionKey,
  type Session,
} from "../access";

const MANAGER_PIN_WINDOW_MS = 10 * 60 * 1000;
const MANAGER_TARGET_ATTEMPT_LIMIT = 5;
const MANAGER_PRINCIPAL_ATTEMPT_LIMIT = 10;

type ManagerAuthorityInput = {
  businessId: string;
  storeId: string;
  employeeId: string;
  managerPin?: string | null;
};

type ManagerAuthorityClient = Pick<
  PrismaClient,
  "$queryRaw" | "employee" | "auditEvent" | "authenticationThrottle"
> & {
  __ofcIndependentManagerAuthorityClient?: Pick<
    PrismaClient,
    "$queryRaw" | "employee" | "auditEvent" | "authenticationThrottle"
  >;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function consumeManagerPinAttempt(
  prisma: ManagerAuthorityClient,
  keyHash: string,
  limit: number,
  now: Date,
): Promise<{ allowed: boolean; count: number }> {
  const resetsAt = new Date(now.getTime() + MANAGER_PIN_WINDOW_MS);
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "AuthenticationThrottle" ("id", "keyHash", "count", "resetsAt", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${keyHash}, 1, ${resetsAt}, ${now}, ${now})
    ON CONFLICT ("keyHash") DO UPDATE SET
      "count" = CASE
        WHEN "AuthenticationThrottle"."resetsAt" <= ${now} THEN 1
        ELSE "AuthenticationThrottle"."count" + 1
      END,
      "resetsAt" = CASE
        WHEN "AuthenticationThrottle"."resetsAt" <= ${now} THEN ${resetsAt}
        ELSE "AuthenticationThrottle"."resetsAt"
      END,
      "updatedAt" = ${now}
    RETURNING "count"
  `);
  const count = rows[0]?.count;
  if (!Number.isSafeInteger(count))
    throw new Error("Manager PIN admission state was not recorded");
  return { allowed: count <= limit, count };
}

function actorEmployeeId(
  session: Session,
  businessId: string,
  storeId: string,
): string | null {
  return (
    session.data.employees?.find(
      (employee) =>
        employee.status === "active" &&
        (employee.business?.id === businessId ||
          employee.role?.businessId === businessId ||
          employee.role?.business?.id === businessId) &&
        Boolean(employee.stores?.some((store) => store.id === storeId)),
    )?.id ?? null
  );
}

async function recordDeniedManagerPinAttempt(
  prisma: ManagerAuthorityClient,
  session: Session,
  input: ManagerAuthorityInput,
  actionLabel: string,
  rateLimited: boolean,
): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      businessId: input.businessId,
      storeId: input.storeId,
      eventNumber: randomUUID(),
      action: "manager_pin.denied",
      resourceType: "Employee",
      resourceId: input.employeeId,
      result: "failed",
      actorType: session.apiKeyId ? "api_key" : "user",
      actorUserId: session.apiKeyId ? null : session.itemId,
      actorEmployeeId: actorEmployeeId(
        session,
        input.businessId,
        input.storeId,
      ),
      actorApiKeyId: session.apiKeyId ?? null,
      changes: { outcome: "denied" },
      occurredAt: new Date(),
      metadata: {
        actionLabel,
        reason: rateLimited ? "rate_limited" : "invalid_authority",
      },
    },
  });
}

/**
 * Persist admission failures outside the consequential operation transaction so
 * a rolled-back PIN guess cannot erase its throttle or denied audit evidence.
 * The manager role/PIN is checked again under the operation transaction below.
 */
export async function admitManagerPinAttempt(
  prisma: ManagerAuthorityClient,
  session: Session | undefined,
  input: ManagerAuthorityInput,
  actionLabel: string,
  permission: PermissionKey,
): Promise<void> {
  if (!session) throw new Error("You must be signed in");
  if (session.apiKeyId)
    throw new Error("Machine sessions cannot submit manager PIN authority");
  assertStorePermission(session, input.businessId, input.storeId, permission);
  // Offline replay wraps context.prisma in its outer batch transaction. PIN
  // admission must still commit independently so a rejected savepoint/batch
  // cannot erase throttle counters or denial evidence.
  const admissionPrisma =
    prisma.__ofcIndependentManagerAuthorityClient ?? prisma;
  const now = new Date();
  const principal = session.apiKeyId
    ? `api-key:${session.apiKeyId}`
    : `user:${session.itemId}`;
  const principalKey = digest(
    `manager-pin:principal:${input.businessId}:${input.storeId}:${principal}`,
  );
  const principalAdmission = await consumeManagerPinAttempt(
    admissionPrisma,
    principalKey,
    MANAGER_PRINCIPAL_ATTEMPT_LIMIT,
    now,
  );
  const employee = await admissionPrisma.employee.findFirst({
    where: {
      id: input.employeeId,
      businessId: input.businessId,
      status: "active",
      stores: { some: { id: input.storeId } },
      role: { canManagePeople: true },
    },
    select: { id: true, posPin: true },
  });
  const targetKey = employee
    ? digest(
        `manager-pin:target:${input.businessId}:${input.storeId}:${employee.id}`,
      )
    : null;
  const targetAdmission = targetKey
    ? await consumeManagerPinAttempt(
        admissionPrisma,
        targetKey,
        MANAGER_TARGET_ATTEMPT_LIMIT,
        now,
      )
    : { allowed: true, count: 0 };
  const valid =
    principalAdmission.allowed &&
    targetAdmission.allowed &&
    Boolean(input.managerPin) &&
    Boolean(employee?.posPin) &&
    (await bcrypt.compare(input.managerPin!, employee!.posPin!));
  if (!valid) {
    const rateLimited = !principalAdmission.allowed || !targetAdmission.allowed;
    if (
      principalAdmission.count <= MANAGER_PRINCIPAL_ATTEMPT_LIMIT + 1 &&
      targetAdmission.count <= MANAGER_TARGET_ATTEMPT_LIMIT + 1
    ) {
      await recordDeniedManagerPinAttempt(
        admissionPrisma,
        session,
        input,
        actionLabel,
        rateLimited,
      );
    }
    if (rateLimited) {
      throw new Error(
        "Manager PIN verification is temporarily rate limited; try again later",
      );
    }
    throw new Error(
      `A people-management role and valid manager PIN are required for ${actionLabel}`,
    );
  }
  await admissionPrisma.authenticationThrottle.deleteMany({
    where: {
      keyHash: { in: targetKey ? [principalKey, targetKey] : [principalKey] },
    },
  });
}

export async function requireManagerPinAuthority(
  transaction: Prisma.TransactionClient,
  input: ManagerAuthorityInput,
  actionLabel: string,
) {
  const employee = await transaction.employee.findFirst({
    where: {
      id: input.employeeId,
      businessId: input.businessId,
      status: "active",
      stores: { some: { id: input.storeId } },
      role: { canManagePeople: true },
    },
  });
  if (
    !input.managerPin ||
    !employee?.posPin ||
    !(await bcrypt.compare(input.managerPin, employee.posPin))
  ) {
    throw new Error(
      `A people-management role and valid manager PIN are required for ${actionLabel}`,
    );
  }
  return employee;
}

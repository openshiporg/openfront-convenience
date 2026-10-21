import type { IdempotencyKey, Prisma } from "@prisma/client";
import { currentRetailSession, assertRetailReplay } from "./retailCashBoundary";
import { assertOperationActor } from "./operationActor";
import {
  fingerprintInput,
  buildScopedIdempotencyKey,
  normalizeIdempotencyKey,
} from "./idempotency";
import { redactSensitiveValues } from "./secretPolicy";
import type { Session } from "../access";
import { assertOriginalRegisterScope } from "./registerCloseIntent";

// Finite domain purposes, not arbitrary delegate/selection dispatch.
export const retailResultPurposes = {
  createPosCart: {
    permission: "canManageSales",
    resourceType: "Cart",
    action: "cart.create",
  },
  addPosCartLine: {
    permission: "canManageSales",
    resourceType: "CartLine",
    action: "cart.line.add",
  },
  updatePosCartLine: {
    permission: "canManageSales",
    resourceType: "CartLine",
    action: "cart.line.update",
  },
  removePosCartLine: {
    permission: "canManageSales",
    resourceType: "CartLine",
    action: "cart.line.remove",
  },
  transitionPosCart: {
    permission: "canManageSales",
    resourceType: "Cart",
    action: "cart.transition",
  },
  openEmployeeShift: {
    permission: "canManagePeople",
    resourceType: "Shift",
    action: "shift.open",
  },
  completePosSale: {
    permission: "canManageSales",
    resourceType: "Sale",
    action: "sale.complete",
  },
  refundPosSale: {
    permission: "canManagePayments",
    resourceType: "Refund",
    action: "sale.refund",
  },
  voidCompletedPosSale: {
    permission: "canManagePayments",
    resourceType: "Sale",
    action: "sale.completed_void",
  },
  openRegisterSession: {
    permission: "canManageCash",
    resourceType: "RegisterSession",
    action: "register_session.open",
  },
  recordCashMovement: {
    permission: "canManageCash",
    resourceType: "CashMovement",
    action: "cash_movement.record",
  },
  closeRegisterSession: {
    permission: "canManageCash",
    resourceType: "RegisterSession",
    action: "register_session.close",
  },
  closeEmployeeShift: {
    permission: "canManagePeople",
    resourceType: "Shift",
    action: "shift.close",
  },
  generateStoreDayReconciliation: {
    permission: "canManageReporting",
    resourceType: "StoreDay",
    action: "store_day.generate",
  },
  approveStoreDayReconciliation: {
    permission: "canManageReporting",
    resourceType: "StoreDay",
    action: "store_day.approve",
  },
  prepareBankDeposit: {
    permission: "canManageCash",
    resourceType: "BankDeposit",
    action: "bank_deposit.prepare",
  },
  transitionBankDeposit: {
    permission: "canManageCash",
    resourceType: "BankDeposit",
    action: "bank_deposit.transition",
  },
} as const;
export function retailResultPurpose(scope: string) {
  if (!Object.hasOwn(retailResultPurposes, scope))
    throw new Error("Retail result purpose is not permitted");
  return retailResultPurposes[scope as keyof typeof retailResultPurposes];
}
export function objectValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function validString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 256 &&
    !/[\r\n]/.test(value)
  );
}
export function retailReceipt(value: unknown) {
  const receipt = objectValue(value);
  if (
    !receipt ||
    Object.keys(receipt).some(
      (key) => !["id", "status", "reference"].includes(key),
    ) ||
    !validString(receipt.id) ||
    !validString(receipt.status) ||
    !(receipt.reference === null || validString(receipt.reference))
  ) {
    throw new Error(
      "Retail original receipt is malformed; retained truth requires review",
    );
  }
  return {
    id: receipt.id,
    status: receipt.status,
    reference: receipt.reference,
  };
}

/** Private result gate. Direct Prisma is intentional read-only command evidence;
 * it does not run Keystone hooks, and fresh reads are not a COMMIT-time fence. */
export async function authorizedRetailResult(
  prisma: Prisma.TransactionClient,
  session: Session,
  record: IdempotencyKey,
  scope: string,
  businessId: string,
  storeId: string,
  command?: unknown,
) {
  const purpose = retailResultPurpose(scope);
  // Reauthorize BEFORE touching the private DTO, including the raced winner.
  // The second fresh check below covers intervening related evidence reads.
  session = await currentRetailSession(
    prisma,
    session,
    businessId,
    storeId,
    purpose.permission,
    "read",
  );
  assertRetailReplay(record, session, businessId, scope, storeId);
  const receipt = retailReceipt(record.responseSnapshot);
  if (
    !validString(record.id) ||
    record.state !== "succeeded" ||
    record.responseDigest !== fingerprintInput(record.responseSnapshot)
  )
    throw new Error("Retail original result identity is invalid");
  const audit = await prisma.auditEvent.findFirst({
    where: {
      idempotencyId: record.id,
      businessId,
      storeId,
      resourceType: purpose.resourceType,
      resourceId: receipt.id,
      action: purpose.action,
      result: "succeeded",
      actorUserId: session.apiKeyId ? null : session.itemId,
      actorApiKeyId: session.apiKeyId ?? null,
    },
    select: { metadata: true, changes: true },
  });
  const auditMetadata = objectValue(audit?.metadata);
  const original = objectValue(auditMetadata?.input);
  if (
    !audit?.changes ||
    fingerprintInput(audit.changes) !== record.responseDigest ||
    auditMetadata?.scope !== scope ||
    !original ||
    original.businessId !== businessId ||
    original.storeId !== storeId ||
    fingerprintInput(original) !== record.requestDigest ||
    (command !== undefined &&
      fingerprintInput(redactSensitiveValues(command)) !== record.requestDigest)
  ) {
    throw new Error(
      "Retail original command body is unbound or different; retained truth requires review",
    );
  }
  if (typeof original.idempotencyKey !== "string")
    throw new Error("Retail original command key is unbound");
  const digest = buildScopedIdempotencyKey(
    `${businessId}:${scope}`,
    normalizeIdempotencyKey(original.idempotencyKey),
  );
  if (
    record.keyDigest !== digest ||
    record.lookupKey !== `${businessId}:${scope}:${digest}`
  )
    throw new Error("Retail original key identity is different");
  const where = { id: receipt.id, businessId, storeId };
  let resource: { id: string } | null;
  let historicalDraftLine = false;
  switch (purpose.resourceType) {
    case "Sale": {
      if (scope === "voidCompletedPosSale" && original.saleId !== receipt.id)
        throw new Error("Retail original sale result is different");
      // Cart owns the one-to-one FK. Sale has an inverse relation, NOT cartId.
      // Type each branch before spreading so Prisma excess-property checks apply.
      const saleBinding: Prisma.SaleWhereInput = scope === "completePosSale"
        ? { cart: { id: String(original.cartId ?? "") }, idempotencyId: record.id }
        : { registerSessionId: String(original.registerSessionId ?? "") };
      resource = await prisma.sale.findFirst({
        where: { ...where, ...saleBinding },
        select: { id: true },
      });
      break;
    }
    case "Refund":
      resource = await prisma.refund.findFirst({
        where: {
          ...where,
          idempotencyId: record.id,
          saleId: String(original.saleId ?? ""),
          metadata: { path: ["registerSessionId"], equals: String(original.registerSessionId ?? "") },
        },
        select: { id: true },
      });
      break;
    case "Cart":
      if (scope === "transitionPosCart" && original.cartId !== receipt.id)
        throw new Error("Retail original cart result is different");
      resource = await prisma.cart.findFirst({
        where: {
          ...where,
          ...(scope === "createPosCart"
            ? {
                registerSessionId: String(original.registerSessionId ?? ""),
                cashierId: String(original.cashierId ?? ""),
              }
            : {}),
        },
        select: { id: true },
      });
      break;
    case "CartLine":
      if (
        ["updatePosCartLine", "removePosCartLine"].includes(scope) &&
        original.cartLineId !== receipt.id
      )
        throw new Error("Retail original line result is different");
      resource = await prisma.cartLine.findFirst({
        where: { ...where, cartId: String(original.cartId ?? "") },
        select: { id: true },
      });
      // A legitimately later-removed draft line is historical, not a missing
      // sale/return effect. Its immutable original audit above remains the
      // receipt; authorize its surviving scoped parent without recreating it.
      if (!resource)
        historicalDraftLine = Boolean(
          await prisma.cart.findFirst({
            where: { id: String(original.cartId ?? ""), businessId, storeId },
            select: { id: true },
          }),
        );
      break;
    case "RegisterSession":
      if (
        scope === "closeRegisterSession" &&
        original.registerSessionId !== receipt.id
      )
        throw new Error("Retail original register result is different");
      resource = await prisma.registerSession.findFirst({
        where: {
          ...where,
          ...(scope === "openRegisterSession"
            ? {
                registerId: String(original.registerId ?? ""),
                employeeId: String(original.employeeId ?? ""),
              }
            : {}),
        },
        select: { id: true },
      });
      break;
    case "Shift":
      if (scope === "closeEmployeeShift" && original.shiftId !== receipt.id)
        throw new Error("Retail original shift result is different");
      resource = await prisma.shift.findFirst({
        where: {
          ...where,
          ...(scope === "openEmployeeShift"
            ? { employeeId: String(original.employeeId ?? "") }
            : {}),
        },
        select: { id: true },
      });
      break;
    case "CashMovement":
      resource = await prisma.cashMovement.findFirst({
        where: {
          ...where,
          registerSessionId: String(original.registerSessionId ?? ""),
        },
        select: { id: true },
      });
      break;
    case "BankDeposit":
      if (
        scope === "transitionBankDeposit" &&
        original.depositId !== receipt.id
      )
        throw new Error("Retail original deposit result is different");
      resource = await prisma.bankDeposit.findFirst({
        where: {
          ...where,
          ...(scope === "prepareBankDeposit"
            ? {
                storeDayId: String(original.storeDayId ?? ""),
                preparedById: String(original.employeeId ?? ""),
                idempotencyId: record.id,
              }
            : {}),
        },
        select: { id: true },
      });
      break;
    case "StoreDay":
      if (
        scope === "approveStoreDayReconciliation" &&
        original.storeDayId !== receipt.id
      )
        throw new Error("Retail original day result is different");
      resource = await prisma.storeDay.findFirst({
        where,
        select: { id: true },
      });
      break;
  }
  if (!historicalDraftLine && (!resource || resource.id !== receipt.id))
    throw new Error(
      "Retail original resource is unavailable in this scope; outcome remains unknown",
    );
  // LAST authority check before DTO return. Recheck original machine employee
  // attribution as well; neither a request key nor a browser scope is authority.
  const fresh = await currentRetailSession(
    prisma,
    session,
    businessId,
    storeId,
    purpose.permission,
    "read",
  );
  assertRetailReplay(record, fresh, businessId, scope, storeId);
  if (scope === "closeRegisterSession" && original.originalScope !== undefined)
    assertOriginalRegisterScope(fresh, businessId, storeId, original);
  await assertOperationActor({
    session: fresh,
    businessId,
    storeId,
    permission: purpose.permission,
    scope,
    operationInput: original,
    lookupMachineActor: async (id) =>
      Boolean(
        await prisma.employee.findFirst({
          where: {
            id,
            businessId,
            userId: fresh.itemId,
            status: "active",
            stores: { some: { id: storeId } },
          },
          select: { id: true },
        }),
      ),
  });
  return receipt;
}

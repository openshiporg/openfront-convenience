import type { Session } from "../access";

/** Owned wire DTO, not a generated Keystone/Prisma model replacement. */
export type RegisterCloseScope = {
  version: 1;
  purpose: "closeRegisterSession";
  userId: string;
  machineId: string | null;
  businessId: string;
  storeId: string;
  resourceId: string;
};
export type RegisterCloseIntent = {
  businessId: string;
  storeId: string;
  registerSessionId: string;
  countedCashCents: number;
  notes: string | null;
  idempotencyKey: string;
  originalScope: RegisterCloseScope;
};
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function id(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value)
  );
}
export function parseRegisterCloseIntent(value: unknown): RegisterCloseIntent {
  const body = object(value),
    scope = object(body?.originalScope);
  if (
    !body ||
    !scope ||
    Object.keys(body).some(
      (key) =>
        ![
          "businessId",
          "storeId",
          "registerSessionId",
          "countedCashCents",
          "notes",
          "idempotencyKey",
          "originalScope",
        ].includes(key),
    ) ||
    Object.keys(scope).some(
      (key) =>
        ![
          "version",
          "purpose",
          "userId",
          "machineId",
          "businessId",
          "storeId",
          "resourceId",
        ].includes(key),
    ) ||
    !id(body.businessId) ||
    !id(body.storeId) ||
    !id(body.registerSessionId) ||
    !id(body.idempotencyKey) ||
    body.idempotencyKey.length < 8 ||
    typeof body.countedCashCents !== "number" ||
    !Number.isSafeInteger(body.countedCashCents) ||
    body.countedCashCents < 0 ||
    !(
      body.notes === null ||
      (typeof body.notes === "string" && body.notes.length <= 5000)
    ) ||
    scope.version !== 1 ||
    scope.purpose !== "closeRegisterSession" ||
    !id(scope.userId) ||
    !(scope.machineId === null || id(scope.machineId)) ||
    scope.businessId !== body.businessId ||
    scope.storeId !== body.storeId ||
    scope.resourceId !== body.registerSessionId
  ) {
    throw new Error(
      "Original register-close intent is unavailable or invalid; retain it for review",
    );
  }
  return {
    businessId: body.businessId,
    storeId: body.storeId,
    registerSessionId: body.registerSessionId,
    countedCashCents: body.countedCashCents,
    notes: body.notes,
    idempotencyKey: body.idempotencyKey,
    originalScope: {
      version: 1,
      purpose: "closeRegisterSession",
      userId: scope.userId,
      machineId: scope.machineId,
      businessId: body.businessId,
      storeId: body.storeId,
      resourceId: body.registerSessionId,
    },
  };
}
export function assertOriginalRegisterScope(
  session: Session,
  businessId: string,
  storeId: string,
  value: unknown,
): void {
  const body = parseRegisterCloseIntent(value);
  if (
    body.businessId !== businessId ||
    body.storeId !== storeId ||
    body.originalScope.userId !== session.itemId ||
    body.originalScope.machineId !== (session.apiKeyId ?? null)
  ) {
    throw new Error(
      "Original register-close scope changed; retain the original intent, do not rekey",
    );
  }
}

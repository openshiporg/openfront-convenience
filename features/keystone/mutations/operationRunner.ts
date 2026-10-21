import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import {
  assertBusinessPermission,
  assertStorePermission,
  employeeForBusiness,
  type PermissionKey,
  type Session,
} from "../access";
import {
  buildScopedIdempotencyKey,
  fingerprintInput,
  normalizeIdempotencyKey,
} from "../lib/idempotency";
import { enqueueOperationOutbox } from "../lib/outbox";
import { assertOperationActor } from "../lib/operationActor";
import { lockOperationAuthority } from "../lib/authorityFence";
import { redactSensitiveValues } from "../lib/secretPolicy";
import { authorizedRetailResult, retailResultPurpose, objectValue } from "../lib/retailResultBoundary";
import { assertOriginalRegisterScope } from "../lib/registerCloseIntent";
import {
  currentRetailSession, assertRetailReplay, retailCommandScopes,
  retailStoreLock, retailRegisterLockKey,
} from "../lib/retailCashBoundary";

export type OperationSnapshot = Record<
  string,
  string | number | boolean | null | string[]
>;

type IdempotentOperationArgs<T extends OperationSnapshot> = {
  context: Context;
  businessId: string;
  storeId?: string | null;
  permission: PermissionKey;
  scope: string;
  idempotencyKey: string;
  input: unknown;
  resourceType: string;
  action: string;
  emitOutbox?: boolean;
  execute: (
    transaction: Prisma.TransactionClient,
    idempotencyId: string,
  ) => Promise<T>;
};

const globalOperationLocks = globalThis as typeof globalThis & {
  __ofcOperationLocks?: Map<string, Promise<void>>;
};
const operationLocks =
  globalOperationLocks.__ofcOperationLocks ?? new Map<string, Promise<void>>();
globalOperationLocks.__ofcOperationLocks = operationLocks;

async function acquireLocalOperationLock(key: string): Promise<() => void> {
  const prior = operationLocks.get(key) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const tail = prior.then(() => current);
  operationLocks.set(key, tail);
  await prior;
  return () => {
    releaseCurrent();
    if (operationLocks.get(key) === tail) operationLocks.delete(key);
  };
}

function sessionFor(context: Context): Session | undefined {
  return context.session as Session | undefined;
}

function retryableSerializableError(error: unknown): boolean {
  const candidate = error as { code?: string; message?: string } | null;
  return (
    candidate?.code === "P2034" ||
    /write conflict|deadlock|current transaction is aborted/i.test(
      candidate?.message ?? "",
    )
  );
}

function replaySnapshot<T extends OperationSnapshot>(value: unknown): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The stored idempotency result is invalid");
  }
  return value as T;
}

export function requireSession(context: Context): Session {
  const session = sessionFor(context);
  if (!session) throw new Error("You must be signed in");
  return session;
}

const recoverablePosScopes = new Set([
  "createPosCart",
  "addPosCartLine",
  "completePosSale",
  "refundPosSale",
  "closeRegisterSession",
]);

export async function posOperationOutcome(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      scope: string;
      idempotencyKey: string;
      command?: unknown;
    };
  },
  context: Context,
) {
  let session = requireSession(context);
  if (!recoverablePosScopes.has(args.input.scope)) {
    throw new Error("POS operation outcome scope is not permitted");
  }
  const purpose = retailResultPurpose(args.input.scope);
  if (args.input.scope === "closeRegisterSession") {
    const command = objectValue(args.input.command);
    if (!command || command.idempotencyKey !== args.input.idempotencyKey) throw new Error("Original register-close command is required");
    assertOriginalRegisterScope(session, args.input.businessId, args.input.storeId, command);
  }
  session = await currentRetailSession(context.prisma, session, args.input.businessId, args.input.storeId, purpose.permission, "read");
  assertBusinessPermission(session, args.input.businessId, purpose.permission);
  assertStorePermission(
    session,
    args.input.businessId,
    args.input.storeId,
    purpose.permission,
  );
  const normalizedKey = normalizeIdempotencyKey(args.input.idempotencyKey);
  const keyDigest = buildScopedIdempotencyKey(
    `${args.input.businessId}:${args.input.scope}`,
    normalizedKey,
  );
  const lookupKey = `${args.input.businessId}:${args.input.scope}:${keyDigest}`;
  const record = await context.prisma.idempotencyKey.findUnique({
    where: { lookupKey },
  });
  // Lookup/related reads may interleave with revocation. Reauthorize even absent
  // outcomes; absence never certifies rollback or permits a replacement key.
  session = await currentRetailSession(context.prisma, session, args.input.businessId, args.input.storeId, purpose.permission, "read");
  if (!record) {
    return {
      state: "not_found",
      retryable: false,
      id: null,
      status: null,
      reference: null,
    };
  }
  const sameActor =
    record.businessId === args.input.businessId &&
    record.scope === args.input.scope &&
    record.actorUserId === (session.apiKeyId ? null : session.itemId) &&
    record.actorApiKeyId === (session.apiKeyId ?? null);
  if (!sameActor) {
    throw new Error("POS operation outcome belongs to a different actor");
  }
  assertRetailReplay(record, session, args.input.businessId, args.input.scope, args.input.storeId);
  if (record.state !== "succeeded") {
    if (objectValue(record.metadata)?.storeId !== args.input.storeId) {
      throw new Error("Legacy POS processing outcome has no persisted store; retry the original command instead");
    }
    return {
      state: record.state === "processing" ? "processing" : "unknown",
      retryable: false,
      id: null,
      status: null,
      reference: null,
    };
  }
  const snapshot = await authorizedRetailResult(context.prisma, session, record, args.input.scope, args.input.businessId, args.input.storeId, args.input.command);
  return {
    state: "succeeded",
    retryable: false,
    id: typeof snapshot.id === "string" ? snapshot.id : null,
    status: typeof snapshot.status === "string" ? snapshot.status : null,
    reference:
      typeof snapshot.reference === "string" ? snapshot.reference : null,
  };
}

export async function runIdempotentOperation<T extends OperationSnapshot>({
  context,
  businessId,
  storeId,
  permission,
  scope,
  idempotencyKey,
  input,
  resourceType,
  action,
  emitOutbox = true,
  execute,
}: IdempotentOperationArgs<T>): Promise<T & { replayed: boolean }> {
  let session = requireSession(context);
  const retail = retailCommandScopes.has(scope);
  if (scope === "closeRegisterSession" && objectValue(input)?.originalScope !== undefined) {
    if (!storeId) throw new Error("Original register-close store is required");
    assertOriginalRegisterScope(session, businessId, storeId, input);
  }
  if (retail && !storeId) throw new Error("Retail commands require an explicit store");
  // Cheap scoped rejection precedes any private authority lookup. This is only
  // preflight: the fresh read and transaction fence below remain mandatory.
  assertBusinessPermission(session, businessId, permission);
  if (storeId) assertStorePermission(session, businessId, storeId, permission);
  session = await currentRetailSession(context.prisma, session, businessId, storeId ?? null, permission, "read");
  assertBusinessPermission(session, businessId, permission);
  if (storeId) assertStorePermission(session, businessId, storeId, permission);

  await assertOperationActor({
    session,
    businessId,
    storeId,
    permission,
    scope,
    operationInput: input,
    lookupMachineActor: async (claimedActorId) => {
      const machineActor = await context.prisma.employee.findFirst({
        where: {
          id: claimedActorId,
          businessId,
          userId: session.itemId,
          status: "active",
          ...(storeId ? { stores: { some: { id: storeId } } } : {}),
        },
        select: { id: true },
      });
      return Boolean(machineActor);
    },
  });

  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const keyDigest = buildScopedIdempotencyKey(
    `${businessId}:${scope}`,
    normalizedKey,
  );
  const lookupKey = `${businessId}:${scope}:${keyDigest}`;
  // Authorization material (PINs, signed provider proofs, tokens) is not part
  // of operation semantics and must never make a corrected secure retry look
  // like a different business request.
  const requestDigest = fingerprintInput(redactSensitiveValues(input));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  let record = await context.prisma.idempotencyKey.findUnique({
    where: { lookupKey },
  });

  session = await currentRetailSession(context.prisma, session, businessId, storeId ?? null, permission, "read");
  if (record) {
    assertRetailReplay(record, session, businessId, scope, storeId ?? null);
    if (record.requestDigest !== requestDigest) {
      throw new Error("Idempotency key was already used with different input");
    }
    if (record.state === "succeeded") {
      const snapshot = retail
        ? await authorizedRetailResult(context.prisma, session, record, scope, businessId, storeId!, input)
        : replaySnapshot<T>(record.responseSnapshot);
      return { ...snapshot, replayed: true } as T & { replayed: boolean };
    }
    if (record.state === "processing" && record.expiresAt > now) {
      throw new Error(
        "An operation with this idempotency key is already processing",
      );
    }

    session = await currentRetailSession(context.prisma, session, businessId, storeId ?? null, permission);
    const claimed = await context.prisma.idempotencyKey.updateMany({
      where: {
        id: record.id,
        OR: [
          { state: "failed" },
          { state: "processing", expiresAt: { lte: now } },
        ],
      },
      data: {
        state: "processing",
        startedAt: now,
        completedAt: null,
        expiresAt,
        responseCode: "",
        responseDigest: "",
        responseSnapshot: undefined,
      },
    });
    if (claimed.count !== 1) {
      throw new Error(
        "An operation with this idempotency key is already processing",
      );
    }
    record = (await context.prisma.idempotencyKey.findUnique({
      where: { id: record.id },
    }))!;
  } else {
    session = await currentRetailSession(context.prisma, session, businessId, storeId ?? null, permission);
    try {
      record = await context.prisma.idempotencyKey.create({
        data: {
          businessId,
          scope,
          keyDigest,
          lookupKey,
          requestDigest,
          state: "processing",
          startedAt: now,
          expiresAt,
          actorUserId: session.apiKeyId ? null : session.itemId,
          actorApiKeyId: session.apiKeyId ?? null,
          metadata: { storeId: storeId ?? null, commandContractVersion: 2 },
        },
      });
    } catch {
      const racedRecord = await context.prisma.idempotencyKey.findUnique({
        where: { lookupKey },
      });
      session = await currentRetailSession(context.prisma, session, businessId, storeId ?? null, permission, "read");
      if (racedRecord) assertRetailReplay(racedRecord, session, businessId, scope, storeId ?? null);
      if (racedRecord?.requestDigest !== requestDigest) {
        throw new Error(
          "Idempotency key was already used with different input",
        );
      }
      if (racedRecord?.state === "succeeded") {
        const snapshot = retail
          ? await authorizedRetailResult(context.prisma, session, racedRecord, scope, businessId, storeId!, input)
          : replaySnapshot<T>(racedRecord.responseSnapshot);
        return { ...snapshot, replayed: true } as T & { replayed: boolean };
      }
      throw new Error(
        "An operation with this idempotency key is already processing",
      );
    }
  }

  const nestedOperationTransaction = Boolean(
    (context as Context & { __ofcNestedOperationTransaction?: boolean })
      .__ofcNestedOperationTransaction,
  );
  // Serialize only identical idempotent requests. Domain operations take their
  // own cart/register/inventory/promotion locks where shared resources require
  // them; a store-wide lock would stall every terminal behind unrelated work.
  const executionLockKey = `${businessId}:${scope}:${keyDigest}`;
  const releaseLocalLock = nestedOperationTransaction
    ? () => {}
    : await acquireLocalOperationLock(executionLockKey);

  try {
    const leaseRefreshedAt = new Date();
    const lease = await context.prisma.idempotencyKey.updateMany({
      where: {
        id: record.id,
        state: "processing",
        startedAt: record.startedAt,
      },
      data: { expiresAt: new Date(leaseRefreshedAt.getTime() + 5 * 60 * 1000) },
    });
    if (lease.count !== 1)
      throw new Error(
        "The idempotency processing lease was superseded before execution",
      );
    const transact = () =>
      context.prisma.$transaction(
        async (transaction) => {
          await transaction.$queryRaw(
            Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`convenience:${executionLockKey}`}))::text AS "locked"`,
          );
          if (retail) {
            const boundary = retailStoreLock(scope, businessId, storeId!);
            if (boundary.exclusive) {
              await transaction.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${boundary.key}))::text AS "locked"`);
            } else {
              await transaction.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock_shared(hashtext(${boundary.key}))::text AS "locked"`);
            }
          }
          await lockOperationAuthority(transaction, session, businessId, storeId);
          session = await currentRetailSession(transaction, session, businessId, storeId ?? null, permission);
          await assertOperationActor({ session, businessId, storeId, permission, scope, operationInput: input,
            lookupMachineActor: async (id) => Boolean(await transaction.employee.findFirst({ where: { id, businessId, userId: session.itemId, status: "active", ...(storeId ? { stores: { some: { id: storeId } } } : {}) }, select: { id: true } })),
          });
          if (retail) {
            const registerId = (input as { registerSessionId?: string })?.registerSessionId;
            if (registerId) {
              const key = retailRegisterLockKey(businessId, storeId!, registerId);
              await transaction.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${key}))::text AS "locked"`);
            }
            if (["completePosSale", "refundPosSale", "recordCashMovement", "openRegisterSession", "voidCompletedPosSale"].includes(scope)) {
              const postingAt = new Date();
              if (await transaction.storeDay.findFirst({ where: { businessId, storeId, status: "locked", periodStartedAt: { lte: postingAt }, periodEndedAt: { gt: postingAt } }, select: { id: true } })) {
                throw new Error("Current retail posting period is locked");
              }
            }
          }
          const snapshot = await execute(transaction, record.id);
          const responseSnapshot = JSON.parse(
            JSON.stringify(snapshot),
          ) as Prisma.InputJsonValue;

          const completed = await transaction.idempotencyKey.updateMany({
            where: {
              id: record.id,
              state: "processing",
              startedAt: record.startedAt,
            },
            data: {
              state: "succeeded",
              responseCode: "ok",
              responseDigest: fingerprintInput(snapshot),
              responseSnapshot,
              completedAt: new Date(),
            },
          });
          if (completed.count !== 1)
            throw new Error(
              "The idempotency processing lease was lost during execution",
            );

          const employee = employeeForBusiness(session, businessId, permission, storeId);
          const resourceId = typeof snapshot.id === "string" ? snapshot.id : "";
          await transaction.auditEvent.create({
            data: {
              businessId,
              storeId: storeId ?? null,
              eventNumber: randomUUID(),
              action,
              resourceType,
              resourceId,
              result: "succeeded",
              actorType: session.apiKeyId ? "api_key" : "user",
              actorUserId: session.apiKeyId ? null : session.itemId,
              actorEmployeeId: employee?.id ?? null,
              actorApiKeyId: session.apiKeyId ?? null,
              idempotencyId: record.id,
              changes: redactSensitiveValues(snapshot) as Prisma.InputJsonValue,
              occurredAt: new Date(),
              metadata: {
                scope,
                input: redactSensitiveValues(input) as Prisma.InputJsonValue,
              },
            },
          });
          if (emitOutbox) {
            await enqueueOperationOutbox(transaction, {
              businessId,
              storeId,
              idempotencyId: record.id,
              action,
              resourceType,
              resourceId,
              result: redactSensitiveValues(snapshot) as OperationSnapshot,
            });
          }

          return snapshot;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );
    let result: T | null = null;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      try {
        result = await transact();
        break;
      } catch (error) {
        if (retryableSerializableError(error) && attempt < 5) continue;
        throw error;
      }
    }
    if (!result)
      throw new Error(
        "Serializable operation could not acquire a stable transaction",
      );
    if (retail) {
      const committed = await context.prisma.idempotencyKey.findUnique({ where: { id: record.id } });
      if (!committed) throw new Error("Committed retail outcome is unavailable; retain original intent");
      const receipt = await authorizedRetailResult(context.prisma, session, committed, scope, businessId, storeId!, input);
      return { ...result, ...receipt, replayed: false };
    }
    await currentRetailSession(context.prisma, session, businessId, storeId ?? null, permission, "read");
    return { ...result, replayed: false };
  } catch (error) {
    // This predicate only cleans a matching processing lease; an error or lost
    // private receipt is NOT evidence of rollback. Succeeded/ambiguous committed
    // truth must remain durable, including denied post-commit readback.
    await context.prisma.idempotencyKey.deleteMany({
      where: {
        id: record.id,
        state: "processing",
        startedAt: record.startedAt,
      },
    });
    throw error;
  } finally {
    releaseLocalLock();
  }
}

export function assertSameBusiness(
  label: string,
  expectedBusinessId: string,
  actualBusinessId: string | null | undefined,
): void {
  if (actualBusinessId !== expectedBusinessId) {
    throw new Error(`${label} does not belong to this business`);
  }
}

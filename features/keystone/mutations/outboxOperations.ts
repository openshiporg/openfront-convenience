import { createHash, randomBytes } from "node:crypto";

import { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import {
  assertBusinessPermission,
  assertStorePermission,
  hasUnrestrictedStoreAccess,
  storeIdsForPermission,
  type Session,
} from "../access";
import { resolveOutboxOutcome } from "../lib/outbox";
import { requireSession, runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

function normalizeWorkerId(value: string): string {
  const workerId = value.trim();
  if (!/^[A-Za-z0-9._:-]{3,100}$/.test(workerId)) {
    throw new Error(
      "Outbox worker ID must be 3-100 safe identifier characters",
    );
  }
  return workerId;
}

function normalizeLeaseToken(value: string): string {
  const token = value.trim();
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new Error("Outbox lease token is invalid");
  return token;
}

export function outboxLeaseOwner(session: Session, leaseToken: string): string {
  const principal = session.apiKeyId
    ? `api-key:${session.apiKeyId}`
    : `user:${session.itemId}`;
  return `v1:${createHash("sha256")
    .update(`${principal}:${leaseToken}`)
    .digest("hex")}`;
}

export async function claimOutboxEvents(
  _root: unknown,
  args: {
    input: { businessId: string; workerId: string; limit?: number | null };
  },
  context: Context,
) {
  const session = requireSession(context) as Session;
  assertBusinessPermission(
    session,
    args.input.businessId,
    "canManageIntegrations",
  );
  const workerId = normalizeWorkerId(args.input.workerId);
  const leaseToken = randomBytes(32).toString("base64url");
  const leaseOwner = outboxLeaseOwner(session, leaseToken);
  const unrestrictedStores = hasUnrestrictedStoreAccess(session);
  const allowedStoreIds = unrestrictedStores
    ? []
    : storeIdsForPermission(
        session,
        "canManageIntegrations",
        args.input.businessId,
      );
  if (!unrestrictedStores && !allowedStoreIds.length)
    return { workerId, leaseToken, events: [] };
  const storePredicate = unrestrictedStores
    ? Prisma.empty
    : Prisma.sql`AND "store" IN (${Prisma.join(allowedStoreIds)})`;
  const limit = Math.max(1, Math.min(100, Math.floor(args.input.limit ?? 25)));
  const now = new Date();
  const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);

  const ids = await context.prisma.$transaction(
    async (transaction) => {
      const rows = await transaction.$queryRaw<
        Array<{
          id: string;
          status: string;
          totalAttempts: number;
        }>
      >(Prisma.sql`
      SELECT "id", "status", "totalAttempts"
      FROM "OutboxEvent"
      WHERE "business" = ${args.input.businessId}
        ${storePredicate}
        AND (
          ("status" IN ('pending', 'retry') AND "availableAt" <= ${now})
          OR ("status" = 'processing' AND "lockedAt" < ${staleBefore})
        )
      ORDER BY "createdAt" ASC, "id" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    `);

      for (const row of rows) {
        if (row.status === "processing") {
          await transaction.outboxAttempt.updateMany({
            where: {
              eventId: row.id,
              attemptNumber: row.totalAttempts,
              outcome: "processing",
            },
            data: {
              outcome: "abandoned",
              finishedAt: now,
              error: "Outbox lease expired before completion",
            },
          });
        }
        const attemptNumber = row.totalAttempts + 1;
        const claimed = await transaction.outboxEvent.updateMany({
          where: { id: row.id, businessId: args.input.businessId },
          data: {
            status: "processing",
            attempts: { increment: 1 },
            totalAttempts: { increment: 1 },
            lockedAt: now,
            lockOwner: leaseOwner,
          },
        });
        if (claimed.count !== 1) throw new Error("Outbox claim was lost");
        await transaction.outboxAttempt.create({
          data: {
            businessId: args.input.businessId,
            eventId: row.id,
            attemptKey: `${row.id}:${attemptNumber}`,
            attemptNumber,
            workerId,
            outcome: "processing",
            startedAt: now,
          },
        });
      }
      return rows.map((row) => row.id);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );

  if (!ids.length) return { workerId, leaseToken, events: [] };
  const events = await context.prisma.outboxEvent.findMany({
    where: {
      id: { in: ids },
      businessId: args.input.businessId,
      status: "processing",
      lockOwner: leaseOwner,
    },
    select: {
      id: true,
      eventKey: true,
      topic: true,
      schemaVersion: true,
      aggregateType: true,
      aggregateId: true,
      action: true,
      payload: true,
      payloadHash: true,
      totalAttempts: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return { workerId, leaseToken, events };
}

async function assertOutboxAccess(
  context: Context,
  businessId: string,
  eventId: string,
  session: Session,
) {
  const event = await context.prisma.outboxEvent.findFirst({
    where: { id: eventId, businessId },
    select: { storeId: true },
  });
  if (!event) throw new Error("Outbox event not found");
  if (event.storeId) {
    assertStorePermission(
      session,
      businessId,
      event.storeId,
      "canManageIntegrations",
    );
  } else if (!hasUnrestrictedStoreAccess(session)) {
    throw new Error(
      "Store-scoped principals cannot process business-wide events",
    );
  }
}

export async function completeOutboxEvent(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      eventId: string;
      workerId: string;
      leaseToken: string;
      outcome: "delivered" | "retry" | "dead_letter";
      error?: string | null;
      retryAfterSeconds?: number | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const workerId = normalizeWorkerId(args.input.workerId);
  const leaseToken = normalizeLeaseToken(args.input.leaseToken);
  const session = requireSession(context) as Session;
  const leaseOwner = outboxLeaseOwner(session, leaseToken);
  await assertOutboxAccess(
    context,
    args.input.businessId,
    args.input.eventId,
    session,
  );
  const retryAfterSeconds = Math.max(
    1,
    Math.min(86_400, Math.floor(args.input.retryAfterSeconds ?? 60)),
  );
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageIntegrations",
    scope: "completeOutboxEvent",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, workerId, retryAfterSeconds },
    resourceType: "OutboxEvent",
    action: "outbox.complete",
    emitOutbox: false,
    execute: async (transaction) => {
      const event = await transaction.outboxEvent.findFirst({
        where: { id: args.input.eventId, businessId: args.input.businessId },
      });
      if (!event) throw new Error("Outbox event not found");
      if (event.status === args.input.outcome) {
        return {
          id: event.id,
          status: event.status,
          reference: event.eventKey,
        };
      }
      if (event.status !== "processing" || event.lockOwner !== leaseOwner) {
        throw new Error("Outbox event is not leased by this worker");
      }
      const now = new Date();
      const outcome = resolveOutboxOutcome(
        args.input.outcome,
        event.totalAttempts,
        event.maxAttempts,
      );
      const attempt = await transaction.outboxAttempt.updateMany({
        where: {
          eventId: event.id,
          attemptNumber: event.totalAttempts,
          workerId,
          outcome: "processing",
        },
        data: {
          outcome,
          finishedAt: now,
          error: args.input.error?.trim() || "",
        },
      });
      if (attempt.count !== 1)
        throw new Error("Outbox attempt evidence is missing");
      const updated = await transaction.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: outcome,
          availableAt:
            outcome === "retry"
              ? new Date(now.getTime() + retryAfterSeconds * 1000)
              : event.availableAt,
          deliveredAt: outcome === "delivered" ? now : event.deliveredAt,
          deadLetteredAt: outcome === "dead_letter" ? now : null,
          lastError: args.input.error?.trim() || "",
          lockedAt: null,
          lockOwner: "",
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.eventKey,
      };
    },
  });
}

export async function replayOutboxEvent(
  _root: unknown,
  args: {
    input: { businessId: string; eventId: string; idempotencyKey: string };
  },
  context: Context,
): Promise<OperationResult> {
  const session = requireSession(context) as Session;
  await assertOutboxAccess(
    context,
    args.input.businessId,
    args.input.eventId,
    session,
  );
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageIntegrations",
    scope: "replayOutboxEvent",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "OutboxEvent",
    action: "outbox.replay",
    emitOutbox: false,
    execute: async (transaction) => {
      const event = await transaction.outboxEvent.findFirst({
        where: { id: args.input.eventId, businessId: args.input.businessId },
      });
      if (!event) throw new Error("Outbox event not found");
      if (event.status === "pending") {
        return {
          id: event.id,
          status: event.status,
          reference: event.eventKey,
        };
      }
      if (!(event.status === "retry" || event.status === "dead_letter")) {
        throw new Error(
          "Only retry or dead-letter outbox events can be replayed",
        );
      }
      const updated = await transaction.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "pending",
          attempts: 0,
          replayCount: { increment: 1 },
          availableAt: new Date(),
          lockedAt: null,
          lockOwner: "",
          deadLetteredAt: null,
          lastError: "",
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.eventKey,
      };
    },
  });
}

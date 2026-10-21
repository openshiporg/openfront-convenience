import type { Prisma } from "@prisma/client";

import { fingerprintInput } from "./idempotency";

export type OutboxCompletionOutcome = "delivered" | "retry" | "dead_letter";

export function resolveOutboxOutcome(
  requested: OutboxCompletionOutcome,
  totalAttempts: number,
  maxAttempts: number,
): OutboxCompletionOutcome {
  return requested === "retry" && totalAttempts >= maxAttempts ? "dead_letter" : requested;
}

export type OperationOutboxInput = {
  businessId: string;
  storeId?: string | null;
  idempotencyId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  result: Record<string, unknown>;
};

type OutboxTransaction = Pick<Prisma.TransactionClient, "outboxEvent">;

export function operationOutboxSnapshot(input: OperationOutboxInput) {
  return {
    eventKey: `operation:${input.idempotencyId}:${input.action}:v1`,
    topic: `convenience.${input.action}.v1`,
    schemaVersion: 1,
    aggregateType: input.resourceType,
    aggregateId: input.resourceId,
    action: input.action,
    payload: {
      businessId: input.businessId,
      storeId: input.storeId ?? null,
      action: input.action,
      resource: { type: input.resourceType, id: input.resourceId },
      result: input.result,
    },
  };
}

export async function enqueueOperationOutbox(
  transaction: OutboxTransaction,
  input: OperationOutboxInput,
): Promise<{ id: string; created: boolean }> {
  const snapshot = operationOutboxSnapshot(input);
  const payloadHash = fingerprintInput(snapshot.payload);
  const existing = await transaction.outboxEvent.findUnique({
    where: { eventKey: snapshot.eventKey },
    select: { id: true, payloadHash: true },
  });
  if (existing) {
    if (existing.payloadHash !== payloadHash) {
      throw new Error("Outbox event key was reused with different evidence");
    }
    return { id: existing.id, created: false };
  }
  const event = await transaction.outboxEvent.create({
    data: {
      businessId: input.businessId,
      storeId: input.storeId ?? null,
      idempotencyId: input.idempotencyId,
      ...snapshot,
      payload: snapshot.payload as Prisma.InputJsonValue,
      payloadHash,
      status: "pending",
      attempts: 0,
      totalAttempts: 0,
      replayCount: 0,
      maxAttempts: 8,
      availableAt: new Date(),
      occurredAt: new Date(),
    },
    select: { id: true },
  });
  return { id: event.id, created: true };
}

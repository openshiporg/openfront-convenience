import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";

import {
  assertBusinessPermission,
  assertStorePermission,
  canAccessStore,
  isHumanPlatformAdmin,
  type Session,
} from "../access";
import {
  buildScopedIdempotencyKey,
  fingerprintInput,
  normalizeIdempotencyKey,
} from "../lib/idempotency";
import { offlineOperationRequestDigest } from "../lib/offlineReplay";
import { runOfflineOperationSavepoint } from "../lib/offlineReplaySavepoint";
import { redactSensitiveValues } from "../lib/secretPolicy";
import type { OperationResult } from "./cashOperations";

type OfflineReplayResult = OperationResult & {
  acknowledgedSequence: number;
};
import {
  executeOfflineOperation,
  offlineOperationTypes,
  type OfflineOperationType,
} from "./offlineReplayExecution";
import { requireSession, runIdempotentOperation } from "./operationRunner";

function deviceCode(value: string): string {
  const code = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(code))
    throw new Error("Device code must be 3-64 safe characters");
  return code;
}

function hexDigest(value: string, label: string): string {
  const result = value.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(result))
    throw new Error(`${label} must be a SHA-256 digest`);
  return result;
}

function operationPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Offline operation payload must be an object");
  }
  const payload = value as Record<string, unknown>;
  if (JSON.stringify(payload).length > 32 * 1024) {
    throw new Error("Offline operation payload exceeds 32 KiB");
  }
  for (const reserved of ["businessId", "storeId", "idempotencyKey"]) {
    if (reserved in payload)
      throw new Error(`Offline payload cannot set reserved field ${reserved}`);
  }
  return payload;
}

export async function registerOfflineDevice(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      name: string;
      deviceCode: string;
      apiKeyId?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const session = requireSession(context) as Session;
  if (session.apiKeyId)
    throw new Error("Machine sessions cannot register offline devices");
  const name = args.input.name.trim();
  const code = deviceCode(args.input.deviceCode);
  if (!name) throw new Error("Device name is required");
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageOfflineOperations",
    scope: "registerOfflineDevice",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, name, deviceCode: code },
    resourceType: "OfflineDevice",
    action: "offline_device.register",
    execute: async (transaction) => {
      const store = await transaction.store.findFirst({
        where: {
          id: args.input.storeId,
          businessId: args.input.businessId,
          status: "active",
        },
      });
      if (!store) throw new Error("Active device store not found");
      const apiKey = args.input.apiKeyId
        ? await transaction.apiKey.findFirst({
            where: {
              id: args.input.apiKeyId,
              businessId: args.input.businessId,
              status: "active",
              OR: [{ allStores: true }, { stores: { some: { id: store.id } } }],
            },
            include: { stores: { select: { id: true } } },
          })
        : null;
      if (args.input.apiKeyId && !apiKey)
        throw new Error("Active store-scoped API key not found");
      if (apiKey) {
        assertBusinessPermission(
          session,
          args.input.businessId,
          "canManageApiKeys",
        );
        assertStorePermission(
          session,
          args.input.businessId,
          store.id,
          "canManageApiKeys",
        );
        if (apiKey.allStores && !isHumanPlatformAdmin(session)) {
          throw new Error(
            "Only an approved platform administrator can bind an all-store API key to a terminal",
          );
        }
        if (
          !apiKey.allStores &&
          apiKey.stores.some(
            (assignedStore) =>
              !canAccessStore(
                session,
                args.input.businessId,
                assignedStore.id,
                "canManageApiKeys",
              ),
          )
        ) {
          throw new Error(
            "Offline device API key scope exceeds the terminal manager's assignments",
          );
        }
      }
      const scopes = Array.isArray(apiKey?.scopes)
        ? apiKey.scopes.filter(
            (scope): scope is string => typeof scope === "string",
          )
        : [];
      if (apiKey && !scopes.includes("canManageOfflineOperations")) {
        throw new Error("Offline device API key lacks its required scope");
      }
      const lookupKey = `${args.input.businessId}:${store.id}:${code}`;
      const existing = await transaction.offlineDevice.findUnique({
        where: { lookupKey },
      });
      if (existing?.status === "revoked")
        throw new Error("Revoked device codes cannot be reactivated");
      const device = existing
        ? await transaction.offlineDevice.update({
            where: { id: existing.id },
            data: { name, apiKeyId: apiKey?.id ?? null, status: "active" },
          })
        : await transaction.offlineDevice.create({
            data: {
              businessId: args.input.businessId,
              storeId: store.id,
              apiKeyId: apiKey?.id ?? null,
              name,
              deviceCode: code,
              lookupKey,
              status: "active",
              lastSequence: 0,
            },
          });
      return {
        id: device.id,
        status: device.status,
        reference: device.deviceCode,
      };
    },
  });
}

export async function transitionOfflineDevice(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      deviceId: string;
      nextStatus: "active" | "suspended" | "revoked";
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const session = requireSession(context) as Session;
  if (session.apiKeyId)
    throw new Error("Machine sessions cannot change device authorization");
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageOfflineOperations",
    scope: "transitionOfflineDevice",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "OfflineDevice",
    action: "offline_device.transition",
    execute: async (transaction) => {
      const device = await transaction.offlineDevice.findFirst({
        where: {
          id: args.input.deviceId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
        include: { apiKey: { include: { stores: { select: { id: true } } } } },
      });
      if (!device) throw new Error("Offline device not found");
      if (device.status === "revoked" && args.input.nextStatus !== "revoked")
        throw new Error("Revoked devices cannot be reactivated");
      if (device.status === args.input.nextStatus)
        return {
          id: device.id,
          status: device.status,
          reference: device.deviceCode,
        };
      if (args.input.nextStatus === "revoked" && device.apiKey) {
        assertBusinessPermission(
          session,
          args.input.businessId,
          "canManageApiKeys",
        );
        assertStorePermission(
          session,
          args.input.businessId,
          args.input.storeId,
          "canManageApiKeys",
        );
        if (device.apiKey.allStores && !isHumanPlatformAdmin(session)) {
          throw new Error(
            "Only an approved platform administrator can revoke an all-store terminal key",
          );
        }
        if (
          !device.apiKey.allStores &&
          device.apiKey.stores.some(
            (assignedStore) =>
              !canAccessStore(
                session,
                args.input.businessId,
                assignedStore.id,
                "canManageApiKeys",
              ),
          )
        ) {
          throw new Error(
            "Offline device API key scope exceeds the terminal manager's assignments",
          );
        }
      }
      const now = new Date();
      const updated = await transaction.offlineDevice.update({
        where: { id: device.id },
        data: {
          status: args.input.nextStatus,
          revokedAt: args.input.nextStatus === "revoked" ? now : null,
        },
      });
      if (args.input.nextStatus === "revoked" && device.apiKeyId) {
        await transaction.apiKey.updateMany({
          where: { id: device.apiKeyId, status: "active" },
          data: { status: "revoked", revokedAt: now },
        });
      }
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.deviceCode,
      };
    },
  });
}

export async function recordOfflineReplayBatch(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      deviceId: string;
      batchNumber: string;
      firstSequence: number;
      lastSequence: number;
      operations: Array<{
        sequence: number;
        operationType: string;
        operationIdempotencyKey: string;
        requestDigest: string;
        payload: unknown;
      }>;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OfflineReplayResult> {
  const batchNumber = args.input.batchNumber.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{2,99}$/.test(batchNumber))
    throw new Error("Offline batch number must be 3-100 safe characters");
  if (!args.input.operations.length || args.input.operations.length > 500)
    throw new Error("Offline replay batch requires 1-500 operations");
  const operations = args.input.operations
    .map((operation) => {
      if (!Number.isSafeInteger(operation.sequence) || operation.sequence < 1)
        throw new Error("Offline sequence must be a positive integer");
      if (
        !offlineOperationTypes.has(
          operation.operationType as OfflineOperationType,
        )
      )
        throw new Error("Offline operation type is not permitted");
      const operationType = operation.operationType as OfflineOperationType;
      const operationIdempotencyKey = normalizeIdempotencyKey(
        operation.operationIdempotencyKey,
      );
      const payload = operationPayload(operation.payload);
      const requestDigest = hexDigest(
        operation.requestDigest,
        "Offline request digest",
      );
      const calculatedDigest = offlineOperationRequestDigest({
        operationType,
        operationIdempotencyKey,
        payload,
      });
      if (requestDigest !== calculatedDigest)
        throw new Error("Offline request digest does not match its payload");
      return {
        sequence: operation.sequence,
        operationType,
        operationIdempotencyKey,
        requestDigest,
        payload,
      };
    })
    .sort((left, right) => left.sequence - right.sequence);
  if (
    new Set(operations.map((operation) => operation.sequence)).size !==
    operations.length
  )
    throw new Error("Offline sequence may appear only once per batch");
  if (
    operations[0].sequence !== args.input.firstSequence ||
    operations.at(-1)!.sequence !== args.input.lastSequence ||
    args.input.lastSequence - args.input.firstSequence + 1 !== operations.length
  )
    throw new Error(
      "Offline batch sequence range must be contiguous and match its operations",
    );
  const requestDigest = fingerprintInput(redactSensitiveValues(operations));

  const result = await runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageOfflineOperations",
    scope: "recordOfflineReplayBatch",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, batchNumber, operations, requestDigest },
    resourceType: "OfflineOperationBatch",
    action: "offline_batch.record",
    execute: async (transaction, idempotencyId) => {
      const session = requireSession(context) as Session;
      const device = await transaction.offlineDevice.findFirst({
        where: {
          id: args.input.deviceId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "active",
        },
      });
      if (!device) throw new Error("Active offline device not found");
      if (session.apiKeyId && device.apiKeyId !== session.apiKeyId)
        throw new Error("Machine key is not bound to this offline device");
      if (operations[0].sequence > device.lastSequence + 1)
        throw new Error(
          "Offline batch starts after the next expected sequence",
        );
      const lookupKey = `${device.id}:${batchNumber}`;
      const existingBatch = await transaction.offlineOperationBatch.findUnique({
        where: { lookupKey },
      });
      if (existingBatch) {
        if (existingBatch.requestDigest !== requestDigest)
          throw new Error(
            "Offline batch number was reused with different evidence",
          );
        return {
          id: existingBatch.id,
          status: existingBatch.status,
          reference: existingBatch.batchNumber,
          acknowledgedSequence: device.lastSequence,
        };
      }

      let cursor = device.lastSequence;
      let appliedCount = 0;
      let replayedCount = 0;
      let conflictCount = 0;
      let rejectedCount = 0;
      const outcomes: Array<{
        operation: (typeof operations)[number];
        outcome: "applied" | "replayed" | "conflict";
        resourceType: string;
        resourceId: string;
        errorCode: string;
        idempotencyKeyDigest: string;
      }> = [];
      const resourceTypes: Record<OfflineOperationType, string> = {
        createPosCart: "Cart",
        addPosCartLine: "CartLine",
        applyPromotionToCart: "Promotion",
        updatePosCartLine: "CartLine",
        removePosCartLine: "CartLine",
        transitionPosCart: "Cart",
        completePosSale: "Sale",
        recordCashMovement: "CashMovement",
      };
      for (const [index, operation] of operations.entries()) {
        const keyDigest = buildScopedIdempotencyKey(
          `${args.input.businessId}:${operation.operationType}`,
          operation.operationIdempotencyKey,
        );
        let outcome: "applied" | "replayed" | "conflict";
        let resourceId = "";
        let errorCode = "";

        if (operation.sequence <= device.lastSequence) {
          const prior = await transaction.offlineOperation.findFirst({
            where: {
              sequence: operation.sequence,
              operationType: operation.operationType,
              requestDigest: operation.requestDigest,
              outcome: { in: ["applied", "replayed"] },
              batch: { deviceId: device.id },
            },
            select: { resourceId: true },
          });
          outcome = prior ? "replayed" : "conflict";
          resourceId = prior?.resourceId ?? "";
          errorCode = prior ? "" : "sequence_replay_mismatch";
        } else if (operation.sequence !== cursor + 1 || conflictCount > 0) {
          outcome = "conflict";
          errorCode = "sequence_blocked_by_conflict";
        } else {
          const result = await runOfflineOperationSavepoint({
            transaction,
            index,
            sequence: operation.sequence,
            execute: () =>
              executeOfflineOperation({
                context,
                transaction,
                operationType: operation.operationType,
                businessId: args.input.businessId,
                storeId: args.input.storeId,
                operationIdempotencyKey: operation.operationIdempotencyKey,
                payload: operation.payload,
              }),
          });
          outcome = result.replayed ? "replayed" : "applied";
          resourceId = result.id;
          cursor += 1;
        }

        if (outcome === "applied") appliedCount += 1;
        if (outcome === "replayed") replayedCount += 1;
        if (outcome === "conflict") conflictCount += 1;
        outcomes.push({
          operation,
          outcome,
          resourceType: resourceTypes[operation.operationType],
          resourceId,
          errorCode,
          idempotencyKeyDigest: keyDigest,
        });
      }
      const status =
        conflictCount > 0
          ? "conflict"
          : rejectedCount > 0
            ? "partial"
            : "completed";
      const now = new Date();
      const batch = await transaction.offlineOperationBatch.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          deviceId: device.id,
          batchNumber,
          lookupKey,
          requestDigest,
          status,
          firstSequence: args.input.firstSequence,
          lastSequence: args.input.lastSequence,
          operationCount: operations.length,
          appliedCount,
          replayedCount,
          conflictCount,
          rejectedCount,
          receivedAt: now,
          processedAt: now,
          idempotencyId,
        },
      });
      for (const result of outcomes) {
        await transaction.offlineOperation.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            batchId: batch.id,
            sequence: result.operation.sequence,
            operationKey: `${batch.id}:${result.operation.sequence}`,
            operationType: result.operation.operationType,
            idempotencyKeyDigest: result.idempotencyKeyDigest,
            requestDigest: result.operation.requestDigest,
            outcome: result.outcome,
            resourceType: result.resourceType,
            resourceId: result.resourceId,
            errorCode: result.errorCode,
            occurredAt: now,
          },
        });
      }
      await transaction.offlineDevice.update({
        where: { id: device.id },
        data: { lastSequence: cursor, lastSeenAt: now },
      });
      if (conflictCount > 0) {
        await transaction.operationalAlert.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            alertNumber: `ALT-${randomUUID()}`,
            fingerprint: `offline:${device.id}:${batch.id}`,
            type: "offline_conflict",
            severity: "critical",
            status: "open",
            title: `Offline replay conflict · ${device.name}`,
            message:
              "One or more offline sequence records did not match server-side idempotency evidence.",
            resourceType: "OfflineOperationBatch",
            resourceId: batch.id,
            observedValue: String(conflictCount),
            thresholdValue: "0",
            detectedAt: now,
          },
        });
      }
      return {
        id: batch.id,
        status: batch.status,
        reference: batch.batchNumber,
        acknowledgedSequence: cursor,
      };
    },
  });
  if (Number.isSafeInteger(result.acknowledgedSequence)) return result;
  // Completed idempotency snapshots from releases before this field existed
  // remain replayable without producing a non-null GraphQL failure.
  const currentDevice = await context.prisma.offlineDevice.findFirst({
    where: {
      id: args.input.deviceId,
      businessId: args.input.businessId,
      storeId: args.input.storeId,
    },
    select: { lastSequence: true },
  });
  if (!currentDevice) throw new Error("Offline device not found");
  return { ...result, acknowledgedSequence: currentDevice.lastSequence };
}

"use server";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { offlineOperationRequestDigest } from "@/features/keystone/lib/offlineReplay";

export type DurableOfflineOperation = {
  sequence: number;
  operationType:
    | "addPosCartLine"
    | "updatePosCartLine"
    | "removePosCartLine"
    | "transitionPosCart"
    | "completePosSale";
  operationIdempotencyKey: string;
  payload: Record<string, unknown>;
};

export async function syncDurableOfflineQueue(input: {
  businessId: string;
  storeId: string;
  deviceId: string;
  batchNumber: string;
  idempotencyKey: string;
  operations: DurableOfflineOperation[];
}) {
  if (!input.operations.length || input.operations.length > 100) {
    return { success: false, error: "Sync requires 1-100 queued operations" };
  }
  const operations = input.operations.map((operation) => ({
    ...operation,
    requestDigest: offlineOperationRequestDigest({
      operationType: operation.operationType,
      operationIdempotencyKey: operation.operationIdempotencyKey,
      payload: operation.payload,
    }),
  }));
  const response = await keystoneClient<{
    recordOfflineReplayBatch: {
      id: string;
      status: string;
      replayed: boolean;
      reference?: string | null;
      acknowledgedSequence: number;
    };
  }>(
    `
    mutation SyncDurablePosQueue($input: RecordOfflineReplayBatchInput!) {
      recordOfflineReplayBatch(input: $input) {
        id
        status
        replayed
        reference
        acknowledgedSequence
      }
    }
  `,
    {
      input: {
        businessId: input.businessId,
        storeId: input.storeId,
        deviceId: input.deviceId,
        batchNumber: input.batchNumber,
        firstSequence: operations[0].sequence,
        lastSequence: operations.at(-1)!.sequence,
        operations,
        idempotencyKey: input.idempotencyKey,
      },
    },
  );
  return response.success
    ? { success: true, result: response.data.recordOfflineReplayBatch }
    : { success: false, error: response.error || "Offline sync failed" };
}

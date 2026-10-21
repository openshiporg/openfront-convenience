import { fingerprintInput } from "./idempotency";
import { redactSensitiveValues } from "./secretPolicy";

export function offlineOperationRequestDigest(input: {
  operationType: string;
  operationIdempotencyKey: string;
  payload: Record<string, unknown>;
}): string {
  return fingerprintInput({
    operationType: input.operationType,
    operationIdempotencyKey: input.operationIdempotencyKey,
    payload: redactSensitiveValues(input.payload),
  });
}

import type { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import { createOfflineReplayTransactionContext } from "../lib/offlineReplayContext";
import { recordCashMovement } from "./cashOperations";
import {
  addPosCartLine,
  completePosSale,
  createPosCart,
  removePosCartLine,
  transitionPosCart,
  updatePosCartLine,
} from "./posOperations";
import { applyPromotionToCart } from "./promotionOperations";

export const offlineOperationTypes = new Set([
  "createPosCart",
  "addPosCartLine",
  "applyPromotionToCart",
  "updatePosCartLine",
  "removePosCartLine",
  "transitionPosCart",
  "completePosSale",
  "recordCashMovement",
] as const);

export type OfflineOperationType =
  | "createPosCart"
  | "addPosCartLine"
  | "applyPromotionToCart"
  | "updatePosCartLine"
  | "removePosCartLine"
  | "transitionPosCart"
  | "completePosSale"
  | "recordCashMovement";

export async function executeOfflineOperation({
  context,
  transaction,
  operationType,
  businessId,
  storeId,
  operationIdempotencyKey,
  payload,
}: {
  context: Context;
  transaction: Prisma.TransactionClient;
  operationType: OfflineOperationType;
  businessId: string;
  storeId: string;
  operationIdempotencyKey: string;
  payload: Record<string, unknown>;
}) {
  const input = {
    ...payload,
    businessId,
    storeId,
    idempotencyKey: operationIdempotencyKey,
  };
  const nested = createOfflineReplayTransactionContext(context, transaction);
  switch (operationType) {
    case "createPosCart":
      return createPosCart(null, { input: input as never }, nested);
    case "addPosCartLine":
      return addPosCartLine(null, { input: input as never }, nested);
    case "applyPromotionToCart":
      return applyPromotionToCart(null, { input: input as never }, nested);
    case "updatePosCartLine":
      return updatePosCartLine(null, { input: input as never }, nested);
    case "removePosCartLine":
      return removePosCartLine(null, { input: input as never }, nested);
    case "transitionPosCart":
      return transitionPosCart(null, { input: input as never }, nested);
    case "completePosSale":
      return completePosSale(null, { input: input as never }, nested);
    case "recordCashMovement":
      return recordCashMovement(null, { input: input as never }, nested);
  }
}

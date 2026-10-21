import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";

import {
  addQuantities,
  compareQuantities,
  normalizeQuantity,
} from "../lib/quantity";
import {
  evaluateTransition,
  INVENTORY_COUNT_TRANSITIONS,
} from "../lib/transitionPolicy";
import { consumeInventoryLots } from "./inventoryPosting";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

type BaseInput = {
  businessId: string;
  storeId: string;
  idempotencyKey: string;
};

type ReceivingLineInput = {
  purchaseOrderLineId: string;
  quantityAccepted: string;
  quantityRejected?: string | null;
  acceptedUnitCostCents?: number | null;
  rejectionReason?:
    | "none"
    | "damaged"
    | "expired"
    | "wrong_item"
    | "overage"
    | "quality"
    | null;
  lotNumber?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
};

export async function startInventoryCount(
  _root: unknown,
  args: {
    input: BaseInput & {
      locationId: string;
      employeeId: string;
      type: "full" | "cycle" | "spot";
      variantIds?: string[] | null;
      notes?: string | null;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const variantIds = [
    ...new Set(args.input.variantIds?.filter(Boolean) ?? []),
  ].sort();
  if (variantIds.length > 1_000)
    throw new Error("Inventory count cannot exceed 1,000 selected variants");
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageInventory",
    scope: "startInventoryCount",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, variantIds },
    resourceType: "InventoryCount",
    action: "inventory_count.create",
    execute: async (transaction, idempotencyId) => {
      const location = await transaction.inventoryLocation.findFirst({
        where: {
          id: args.input.locationId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "active",
        },
      });
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!location || !employee)
        throw new Error("Count location or employee is invalid");
      const stockLevels = await transaction.stockLevel.findMany({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          locationId: location.id,
          ...(variantIds.length ? { variantId: { in: variantIds } } : {}),
        },
        include: { variant: true },
        orderBy: { lookupKey: "asc" },
        take: 1_001,
      });
      if (stockLevels.length > 1_000)
        throw new Error("Inventory count exceeds 1,000 stock positions");
      if (variantIds.length && stockLevels.length !== variantIds.length) {
        throw new Error(
          "One or more selected variants have no stock position at this location",
        );
      }
      if (!stockLevels.length)
        throw new Error("Inventory count requires at least one stock position");
      const now = new Date();
      const count = await transaction.inventoryCount.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          locationId: location.id,
          countNumber: `COUNT-${randomUUID()}`,
          type: args.input.type,
          status: "counting",
          startedAt: now,
          createdById: employee.id,
          notes: args.input.notes?.trim() || "",
          metadata: { idempotencyId, lineCount: stockLevels.length },
        },
      });
      for (const stock of stockLevels) {
        if (!stock.variantId || !stock.variant)
          throw new Error("Stock position is missing its variant");
        await transaction.inventoryCountLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            countId: count.id,
            stockLevelId: stock.id,
            variantId: stock.variantId,
            expectedQuantity: stock.onHandQuantity,
            varianceQuantity: "0.0000",
            metadata: { sku: stock.variant.sku },
          },
        });
      }
      return {
        id: count.id,
        status: count.status,
        reference: count.countNumber,
      };
    },
  });
}

export async function recordInventoryCountLine(
  _root: unknown,
  args: {
    input: BaseInput & {
      countLineId: string;
      employeeId: string;
      actualQuantity: string;
      unitCostCents?: number | null;
      lotNumber?: string | null;
      expiresAt?: string | null;
      reason?: string | null;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const actualQuantity = normalizeQuantity(args.input.actualQuantity);
  if (compareQuantities(actualQuantity, "0") < 0)
    throw new Error("Counted quantity cannot be negative");
  if (
    args.input.unitCostCents != null &&
    (!Number.isSafeInteger(args.input.unitCostCents) ||
      args.input.unitCostCents < 0)
  ) {
    throw new Error(
      "Count unit cost must be a non-negative integer number of cents",
    );
  }
  if (
    args.input.expiresAt &&
    !Number.isFinite(new Date(args.input.expiresAt).getTime())
  ) {
    throw new Error("Count lot expiry must be a valid timestamp");
  }
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageInventory",
    scope: "recordInventoryCountLine",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, actualQuantity },
    resourceType: "InventoryCountLine",
    action: "inventory_count.line.record",
    execute: async (transaction) => {
      const line = await transaction.inventoryCountLine.findFirst({
        where: {
          id: args.input.countLineId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          count: { status: "counting" },
        },
        include: { count: true, stockLevel: true },
      });
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!line?.count || !line.stockLevel || !employee)
        throw new Error("Open count line, stock level, or counter not found");
      // The physical count must compare with the live balance at capture time.
      // Movement before capture is already reflected in this baseline; movement
      // after capture remains preserved when approval adds the stored variance
      // to the then-current balance.
      const expectedAtPhysicalCount = line.stockLevel.onHandQuantity.toString();
      const varianceQuantity = addQuantities(
        actualQuantity,
        `-${expectedAtPhysicalCount}`,
      );
      if (
        compareQuantities(varianceQuantity, "0") > 0 &&
        args.input.unitCostCents == null
      ) {
        throw new Error(
          "A count increase requires an explicit unit cost for the discovered lot",
        );
      }
      const updated = await transaction.inventoryCountLine.update({
        where: { id: line.id },
        data: {
          expectedQuantity: expectedAtPhysicalCount,
          actualQuantity,
          varianceQuantity,
          unitCostCents: args.input.unitCostCents ?? null,
          lotNumber: args.input.lotNumber?.trim() || "",
          expiresAt: args.input.expiresAt
            ? new Date(args.input.expiresAt)
            : null,
          reason: args.input.reason?.trim() || line.reason,
          countedById: employee.id,
        },
      });
      return {
        id: updated.id,
        status: line.count.status,
        reference: line.count.countNumber,
      };
    },
  });
}

export async function receivePurchaseOrder(
  _root: unknown,
  args: {
    input: BaseInput & {
      purchaseOrderId: string;
      locationId: string;
      employeeId: string;
      vendorDocumentNumber?: string | null;
      discrepancyNotes?: string | null;
      lines: ReceivingLineInput[];
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (!args.input.lines.length)
    throw new Error("At least one receiving line is required");
  const lines = args.input.lines.map((line) => ({
    ...line,
    quantityAccepted: normalizeQuantity(line.quantityAccepted),
    quantityRejected: normalizeQuantity(line.quantityRejected ?? "0"),
  }));
  for (const line of lines) {
    if (
      compareQuantities(line.quantityAccepted, "0") < 0 ||
      compareQuantities(line.quantityRejected, "0") < 0
    ) {
      throw new Error("Receiving quantities cannot be negative");
    }
    if (
      compareQuantities(
        addQuantities(line.quantityAccepted, line.quantityRejected),
        "0",
      ) <= 0
    ) {
      throw new Error(
        "Each receiving line must accept or reject a positive quantity",
      );
    }
    if (
      compareQuantities(line.quantityAccepted, "0") > 0 &&
      (!Number.isSafeInteger(line.acceptedUnitCostCents) ||
        Number(line.acceptedUnitCostCents) < 0)
    ) {
      throw new Error(
        "Accepted receiving quantity requires an explicit non-negative accepted unit cost in cents",
      );
    }
    if (
      line.expiresAt &&
      !Number.isFinite(new Date(line.expiresAt).getTime())
    ) {
      throw new Error("Lot expiry must be a valid ISO timestamp");
    }
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePurchasing",
    scope: "receivePurchaseOrder",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, lines },
    resourceType: "Receiving",
    action: "purchase_order.receive",
    execute: async (transaction, idempotencyId) => {
      const purchaseOrder = await transaction.purchaseOrder.findFirst({
        where: {
          id: args.input.purchaseOrderId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: { in: ["approved", "partially_received"] },
        },
        include: { lines: true },
      });
      if (!purchaseOrder)
        throw new Error("Receivable purchase order not found");

      const location = await transaction.inventoryLocation.findFirst({
        where: {
          id: args.input.locationId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "active",
        },
      });
      if (!location) throw new Error("Active inventory location not found");

      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!employee)
        throw new Error("Active receiver is not assigned to this store");

      const uniqueLineIds = new Set(
        lines.map((line) => line.purchaseOrderLineId),
      );
      if (uniqueLineIds.size !== lines.length) {
        throw new Error(
          "A purchase-order line may appear only once per receiving",
        );
      }

      const now = new Date();
      const receiving = await transaction.receiving.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          purchaseOrderId: purchaseOrder.id,
          vendorId: purchaseOrder.vendorId,
          receivingNumber: `RCV-${randomUUID()}`,
          vendorDocumentNumber: args.input.vendorDocumentNumber?.trim() || "",
          status: "posted",
          receivedAt: now,
          postedAt: now,
          receivedById: employee.id,
          discrepancyNotes: args.input.discrepancyNotes?.trim() || "",
          metadata: { idempotencyId },
        },
      });

      for (const lineInput of lines) {
        const poLine = purchaseOrder.lines.find(
          (line) => line.id === lineInput.purchaseOrderLineId,
        );
        if (!poLine || !poLine.variantId) {
          throw new Error(
            "Receiving line does not belong to this purchase order",
          );
        }
        const outstanding = addQuantities(
          poLine.quantityOrdered.toString(),
          `-${addQuantities(poLine.quantityReceived.toString(), poLine.quantityCancelled.toString())}`,
        );
        const processed = addQuantities(
          lineInput.quantityAccepted,
          lineInput.quantityRejected,
        );
        if (compareQuantities(processed, outstanding) > 0) {
          throw new Error(
            `Receiving exceeds outstanding quantity for ${poLine.descriptionSnapshot}`,
          );
        }
        if (
          compareQuantities(lineInput.quantityRejected, "0") > 0 &&
          (!lineInput.rejectionReason || lineInput.rejectionReason === "none")
        ) {
          throw new Error(
            "Rejected receiving quantity requires a rejection reason",
          );
        }

        const receivingLine = await transaction.receivingLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            receivingId: receiving.id,
            purchaseOrderLineId: poLine.id,
            variantId: poLine.variantId,
            quantityExpected: outstanding,
            quantityAccepted: lineInput.quantityAccepted,
            quantityRejected: lineInput.quantityRejected,
            rejectionReason: lineInput.rejectionReason ?? "none",
            unitCostCents: lineInput.acceptedUnitCostCents ?? 0,
            notes: lineInput.notes?.trim() || "",
          },
        });

        if (compareQuantities(lineInput.quantityAccepted, "0") > 0) {
          const lotNumber =
            lineInput.lotNumber?.trim() || `LOT-${randomUUID()}`;
          const lot = await transaction.inventoryLot.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              locationId: location.id,
              variantId: poLine.variantId,
              vendorId: purchaseOrder.vendorId,
              receivingLineId: receivingLine.id,
              lotNumber,
              lookupKey: `${location.id}:${poLine.variantId}:${lotNumber}`,
              quantityReceived: lineInput.quantityAccepted,
              quantityRemaining: lineInput.quantityAccepted,
              unitCostCents: lineInput.acceptedUnitCostCents ?? 0,
              receivedAt: now,
              expiresAt: lineInput.expiresAt
                ? new Date(lineInput.expiresAt)
                : null,
              status: "active",
            },
          });

          const stockLookupKey = `${location.id}:${poLine.variantId}`;
          const stockLevel = await transaction.stockLevel.findUnique({
            where: { lookupKey: stockLookupKey },
          });
          const balanceAfter = addQuantities(
            stockLevel?.onHandQuantity.toString() ?? "0.0000",
            lineInput.quantityAccepted,
          );
          const updatedStock = stockLevel
            ? await transaction.stockLevel.update({
                where: { id: stockLevel.id },
                data: { onHandQuantity: balanceAfter },
              })
            : await transaction.stockLevel.create({
                data: {
                  businessId: args.input.businessId,
                  storeId: args.input.storeId,
                  locationId: location.id,
                  variantId: poLine.variantId,
                  lookupKey: stockLookupKey,
                  onHandQuantity: balanceAfter,
                  reservedQuantity: "0.0000",
                  parQuantity: "0.0000",
                  reorderPoint: "0.0000",
                  reorderQuantity: "0.0000",
                },
              });

          await transaction.inventoryLedgerEntry.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              stockLevelId: updatedStock.id,
              locationId: location.id,
              variantId: poLine.variantId,
              lotId: lot.id,
              type: "receiving",
              quantityDelta: lineInput.quantityAccepted,
              balanceAfter,
              unitCostCents: lineInput.acceptedUnitCostCents ?? 0,
              reason: `Receiving ${receiving.receivingNumber}`,
              sourceType: "Receiving",
              sourceId: receiving.id,
              receivingLineId: receivingLine.id,
              actorId: employee.id,
              idempotencyId,
              occurredAt: now,
            },
          });
        }

        await transaction.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: {
            quantityReceived: addQuantities(
              poLine.quantityReceived.toString(),
              lineInput.quantityAccepted,
            ),
            quantityCancelled: addQuantities(
              poLine.quantityCancelled.toString(),
              lineInput.quantityRejected,
            ),
          },
        });
      }

      const refreshedLines = await transaction.purchaseOrderLine.findMany({
        where: { purchaseOrderId: purchaseOrder.id },
      });
      const complete = refreshedLines.every(
        (line) =>
          compareQuantities(
            addQuantities(
              line.quantityReceived.toString(),
              line.quantityCancelled.toString(),
            ),
            line.quantityOrdered.toString(),
          ) >= 0,
      );
      await transaction.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: { status: complete ? "received" : "partially_received" },
      });

      return {
        id: receiving.id,
        status: receiving.status,
        reference: receiving.receivingNumber,
      };
    },
  });
}

export async function postInventoryAdjustment(
  _root: unknown,
  args: {
    input: BaseInput & {
      locationId: string;
      variantId: string;
      employeeId: string;
      type: "opening_balance" | "waste" | "spoilage" | "theft" | "correction";
      quantityDelta: string;
      unitCostCents?: number | null;
      lotNumber?: string | null;
      expiresAt?: string | null;
      reason: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const allowedTypes = new Set([
    "opening_balance",
    "waste",
    "spoilage",
    "theft",
    "correction",
  ]);
  if (!allowedTypes.has(args.input.type)) {
    throw new Error("Unsupported manual inventory adjustment type");
  }
  const quantityDelta = normalizeQuantity(args.input.quantityDelta);
  if (compareQuantities(quantityDelta, "0") === 0)
    throw new Error("Inventory adjustment cannot be zero");
  if (
    compareQuantities(quantityDelta, "0") > 0 &&
    (!Number.isSafeInteger(args.input.unitCostCents) ||
      Number(args.input.unitCostCents) < 0)
  )
    throw new Error(
      "Positive inventory adjustments require an explicit non-negative unit cost",
    );
  if (
    args.input.expiresAt &&
    !Number.isFinite(new Date(args.input.expiresAt).getTime())
  ) {
    throw new Error("Adjustment lot expiry must be a valid timestamp");
  }
  if (!args.input.reason.trim())
    throw new Error("Inventory adjustment reason is required");

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageInventory",
    scope: "postInventoryAdjustment",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, quantityDelta },
    resourceType: "InventoryLedgerEntry",
    action: "inventory.adjust",
    execute: async (transaction, idempotencyId) => {
      const location = await transaction.inventoryLocation.findFirst({
        where: {
          id: args.input.locationId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "active",
        },
      });
      const variant = await transaction.productVariant.findFirst({
        where: { id: args.input.variantId, businessId: args.input.businessId },
      });
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!location || !variant || !employee) {
        throw new Error(
          "Inventory location, variant, or employee is invalid for this business",
        );
      }

      const lookupKey = `${location.id}:${variant.id}`;
      const stockLevel = await transaction.stockLevel.findUnique({
        where: { lookupKey },
      });
      const balanceAfter = addQuantities(
        stockLevel?.onHandQuantity.toString() ?? "0.0000",
        quantityDelta,
      );
      if (
        !variant.allowNegativeInventory &&
        compareQuantities(balanceAfter, "0") < 0
      ) {
        throw new Error("Adjustment would make inventory negative");
      }
      const updatedStock = stockLevel
        ? await transaction.stockLevel.update({
            where: { id: stockLevel.id },
            data: { onHandQuantity: balanceAfter },
          })
        : await transaction.stockLevel.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              locationId: location.id,
              variantId: variant.id,
              lookupKey,
              onHandQuantity: balanceAfter,
              reservedQuantity: "0.0000",
              parQuantity: "0.0000",
              reorderPoint: "0.0000",
              reorderQuantity: "0.0000",
            },
          });

      const now = new Date();
      const positive = compareQuantities(quantityDelta, "0") > 0;
      const segments: Array<{
        lotId: string | null;
        quantityDelta: string;
        unitCostCents: number | null;
      }> = [];
      if (positive) {
        const lotNumber = args.input.lotNumber?.trim() || `ADJ-${randomUUID()}`;
        const lot = await transaction.inventoryLot.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            locationId: location.id,
            variantId: variant.id,
            lotNumber,
            lookupKey: `${location.id}:${variant.id}:${lotNumber}`,
            quantityReceived: quantityDelta,
            quantityRemaining: quantityDelta,
            unitCostCents: args.input.unitCostCents ?? 0,
            receivedAt: now,
            expiresAt: args.input.expiresAt
              ? new Date(args.input.expiresAt)
              : null,
            status: "active",
            metadata: { source: "manual_adjustment" },
          },
        });
        segments.push({
          lotId: lot.id,
          quantityDelta,
          unitCostCents: args.input.unitCostCents ?? 0,
        });
      } else {
        const consumed = await consumeInventoryLots(transaction, {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          locationId: location.id,
          variantId: variant.id,
          quantity: quantityDelta.slice(1),
          includeExpired: ["waste", "spoilage", "correction"].includes(
            args.input.type,
          ),
        });
        for (const segment of consumed) {
          if (!segment.lotId && !variant.allowNegativeInventory) {
            throw new Error("Adjustment exceeds available FIFO lot quantity");
          }
          segments.push({
            lotId: segment.lotId,
            quantityDelta: `-${segment.quantity}`,
            unitCostCents: segment.unitCostCents ?? variant.costCents,
          });
        }
      }
      let runningBalance = stockLevel?.onHandQuantity.toString() ?? "0.0000";
      let entryId = "";
      for (const segment of segments) {
        runningBalance = addQuantities(runningBalance, segment.quantityDelta);
        const entry = await transaction.inventoryLedgerEntry.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            stockLevelId: updatedStock.id,
            locationId: location.id,
            variantId: variant.id,
            lotId: segment.lotId,
            type: args.input.type,
            quantityDelta: segment.quantityDelta,
            balanceAfter: runningBalance,
            unitCostCents: segment.unitCostCents,
            reason: args.input.reason.trim(),
            sourceType: "ManualAdjustment",
            actorId: employee.id,
            idempotencyId,
            occurredAt: now,
          },
        });
        entryId ||= entry.id;
      }
      if (runningBalance !== balanceAfter)
        throw new Error(
          "Adjustment lot allocation did not reconcile to stock balance",
        );
      return { id: entryId, status: "posted", reference: lookupKey };
    },
  });
}

export async function transitionInventoryCount(
  _root: unknown,
  args: {
    input: BaseInput & {
      countId: string;
      employeeId: string;
      nextStatus: "counting" | "submitted" | "cancelled";
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (
    !new Set(["counting", "submitted", "cancelled"]).has(args.input.nextStatus)
  ) {
    throw new Error("Unsupported inventory-count transition target");
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageInventory",
    scope: "transitionInventoryCount",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "InventoryCount",
    action: `inventory_count.${args.input.nextStatus}`,
    execute: async (transaction) => {
      const count = await transaction.inventoryCount.findFirst({
        where: {
          id: args.input.countId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
        include: { lines: true },
      });
      if (!count)
        throw new Error(
          "Inventory count not found for this business and store",
        );
      const transition = evaluateTransition(
        INVENTORY_COUNT_TRANSITIONS,
        count.status,
        args.input.nextStatus,
      );
      if (transition.replay) {
        return {
          id: count.id,
          status: count.status,
          reference: count.countNumber,
        };
      }
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!employee)
        throw new Error("Active counter is not assigned to this store");
      if (args.input.nextStatus === "submitted") {
        if (
          !count.lines.length ||
          count.lines.some((line) => line.actualQuantity == null)
        ) {
          throw new Error(
            "Every inventory count line needs an actual quantity before submission",
          );
        }
      }
      const now = new Date();
      const updated = await transaction.inventoryCount.update({
        where: { id: count.id },
        data: {
          status: args.input.nextStatus,
          ...(args.input.nextStatus === "counting"
            ? { startedAt: count.startedAt ?? now }
            : {}),
          ...(args.input.nextStatus === "submitted"
            ? { submittedAt: now }
            : {}),
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.countNumber,
      };
    },
  });
}

export async function approveInventoryCount(
  _root: unknown,
  args: {
    input: BaseInput & { countId: string; employeeId: string };
  },
  context: Context,
): Promise<OperationResult> {
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageInventory",
    scope: "approveInventoryCount",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "InventoryCount",
    action: "inventory_count.approve",
    execute: async (transaction, idempotencyId) => {
      const count = await transaction.inventoryCount.findFirst({
        where: {
          id: args.input.countId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "submitted",
        },
        include: { lines: true },
      });
      if (!count || !count.lines.length || !count.locationId)
        throw new Error(
          "Submitted count requires lines and an inventory location",
        );
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!employee)
        throw new Error("Active approver is not assigned to this store");

      const now = new Date();
      for (const line of count.lines) {
        if (
          line.actualQuantity == null ||
          !line.stockLevelId ||
          !line.variantId
        ) {
          throw new Error(
            "Every count line requires an actual quantity, stock level, and variant",
          );
        }
        const stock = await transaction.stockLevel.findFirst({
          where: {
            id: line.stockLevelId,
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            locationId: count.locationId,
            variantId: line.variantId,
          },
          include: { variant: true },
        });
        if (!stock || !stock.variant)
          throw new Error("Count line stock level is invalid");
        const actual = line.actualQuantity.toString();
        const expectedAtCount = line.expectedQuantity.toString();
        const variance = addQuantities(actual, `-${expectedAtCount}`);
        const targetBalance = addQuantities(
          stock.onHandQuantity.toString(),
          variance,
        );
        if (
          !stock.variant.allowNegativeInventory &&
          compareQuantities(targetBalance, "0") < 0
        ) {
          throw new Error(
            "Count variance plus intervening movements would make inventory negative",
          );
        }
        await transaction.stockLevel.update({
          where: { id: stock.id },
          data: { onHandQuantity: targetBalance, lastCountedAt: now },
        });
        const segments: Array<{
          lotId: string | null;
          quantityDelta: string;
          unitCostCents: number | null;
        }> = [];
        if (compareQuantities(variance, "0") > 0) {
          if (line.unitCostCents == null)
            throw new Error("Count increase is missing its accepted unit cost");
          const lotNumber = line.lotNumber?.trim() || `COUNT-${randomUUID()}`;
          const lot = await transaction.inventoryLot.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              locationId: count.locationId,
              variantId: line.variantId,
              lotNumber,
              lookupKey: `${count.locationId}:${line.variantId}:${lotNumber}`,
              quantityReceived: variance,
              quantityRemaining: variance,
              unitCostCents: line.unitCostCents,
              receivedAt: now,
              expiresAt: line.expiresAt,
              status: "active",
              metadata: { inventoryCountId: count.id },
            },
          });
          segments.push({
            lotId: lot.id,
            quantityDelta: variance,
            unitCostCents: line.unitCostCents,
          });
        } else if (compareQuantities(variance, "0") < 0) {
          const consumed = await consumeInventoryLots(transaction, {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            locationId: count.locationId,
            variantId: line.variantId,
            quantity: variance.slice(1),
            includeExpired: true,
          });
          for (const segment of consumed) {
            if (!segment.lotId && !stock.variant.allowNegativeInventory) {
              throw new Error(
                "Count decrease exceeds available FIFO lot quantity",
              );
            }
            segments.push({
              lotId: segment.lotId,
              quantityDelta: `-${segment.quantity}`,
              unitCostCents: segment.unitCostCents ?? stock.variant.costCents,
            });
          }
        } else {
          segments.push({
            lotId: null,
            quantityDelta: "0.0000",
            unitCostCents: stock.variant.costCents,
          });
        }
        let runningBalance = stock.onHandQuantity.toString();
        let ledgerEntryId = "";
        for (const segment of segments) {
          runningBalance = addQuantities(runningBalance, segment.quantityDelta);
          const ledger = await transaction.inventoryLedgerEntry.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              stockLevelId: stock.id,
              locationId: count.locationId,
              variantId: line.variantId,
              lotId: segment.lotId,
              type: "count_adjustment",
              quantityDelta: segment.quantityDelta,
              balanceAfter: runningBalance,
              unitCostCents: segment.unitCostCents,
              reason: line.reason || `Count ${count.countNumber}`,
              sourceType: "InventoryCount",
              sourceId: count.id,
              actorId: employee.id,
              idempotencyId,
              occurredAt: now,
            },
          });
          ledgerEntryId ||= ledger.id;
        }
        if (runningBalance !== targetBalance)
          throw new Error(
            "Count variance did not preserve intervening inventory movements",
          );
        await transaction.inventoryCountLine.update({
          where: { id: line.id },
          data: { varianceQuantity: variance, ledgerEntryId },
        });
      }

      const updated = await transaction.inventoryCount.update({
        where: { id: count.id },
        data: {
          status: "approved",
          approvedAt: now,
          approvedById: employee.id,
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.countNumber,
      };
    },
  });
}

import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import { assertStorePermission, type Session } from "../access";
import {
  addQuantities,
  compareQuantities,
  normalizeQuantity,
} from "../lib/quantity";
import { evaluateTransition } from "../lib/transitionPolicy";
import { consumeInventoryLots } from "./inventoryPosting";
import type { OperationResult } from "./cashOperations";
import { requireSession, runIdempotentOperation } from "./operationRunner";

const transitions = {
  draft: ["approved", "cancelled"],
  approved: ["shipped", "cancelled"],
  shipped: ["received"],
  received: [],
  cancelled: [],
} as const;

async function transferEmployee(
  transaction: Prisma.TransactionClient,
  input: {
    employeeId: string;
    businessId: string;
    sourceStoreId: string;
    destinationStoreId: string;
  },
) {
  const employee = await transaction.employee.findFirst({
    where: {
      id: input.employeeId,
      businessId: input.businessId,
      status: "active",
      AND: [
        { stores: { some: { id: input.sourceStoreId } } },
        { stores: { some: { id: input.destinationStoreId } } },
      ],
    },
  });
  if (!employee)
    throw new Error("Transfer employee must be active at both stores");
  return employee;
}

export async function draftInventoryTransfer(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      sourceStoreId: string;
      destinationStoreId: string;
      sourceLocationId: string;
      destinationLocationId: string;
      employeeId: string;
      lines: Array<{ variantId: string; quantity: string }>;
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (args.input.sourceStoreId === args.input.destinationStoreId)
    throw new Error("Inter-store transfer requires distinct stores");
  const session = requireSession(context) as Session;
  assertStorePermission(
    session,
    args.input.businessId,
    args.input.sourceStoreId,
    "canManageInventory",
  );
  assertStorePermission(
    session,
    args.input.businessId,
    args.input.destinationStoreId,
    "canManageInventory",
  );
  if (!args.input.lines.length || args.input.lines.length > 200)
    throw new Error("Transfer requires 1-200 lines");
  const lines = args.input.lines.map((line) => ({
    variantId: line.variantId,
    quantity: normalizeQuantity(line.quantity),
  }));
  if (new Set(lines.map((line) => line.variantId)).size !== lines.length)
    throw new Error("A variant may appear only once per transfer");

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageInventory",
    scope: "draftInventoryTransfer",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, lines },
    resourceType: "InventoryTransfer",
    action: "inventory_transfer.draft",
    execute: async (transaction, idempotencyId) => {
      const [
        sourceStore,
        destinationStore,
        sourceLocation,
        destinationLocation,
        variants,
      ] = await Promise.all([
        transaction.store.findFirst({
          where: {
            id: args.input.sourceStoreId,
            businessId: args.input.businessId,
            status: "active",
          },
        }),
        transaction.store.findFirst({
          where: {
            id: args.input.destinationStoreId,
            businessId: args.input.businessId,
            status: "active",
          },
        }),
        transaction.inventoryLocation.findFirst({
          where: {
            id: args.input.sourceLocationId,
            businessId: args.input.businessId,
            storeId: args.input.sourceStoreId,
            status: "active",
          },
        }),
        transaction.inventoryLocation.findFirst({
          where: {
            id: args.input.destinationLocationId,
            businessId: args.input.businessId,
            storeId: args.input.destinationStoreId,
            status: "active",
          },
        }),
        transaction.productVariant.findMany({
          where: {
            businessId: args.input.businessId,
            id: { in: lines.map((line) => line.variantId) },
            status: "active",
            trackInventory: true,
          },
          include: { product: true },
        }),
      ]);
      if (!sourceStore || !destinationStore)
        throw new Error("Both transfer stores must be active in this business");
      if (!sourceLocation || !destinationLocation)
        throw new Error(
          "Transfer locations must be active at their declared stores",
        );
      if (variants.length !== lines.length)
        throw new Error(
          "Every transfer variant must be active, inventory-tracked, and tenant-owned",
        );
      const employee = await transferEmployee(transaction, args.input);
      const transfer = await transaction.inventoryTransfer.create({
        data: {
          businessId: args.input.businessId,
          transferNumber: `XFER-${randomUUID()}`,
          status: "draft",
          sourceStoreId: sourceStore.id,
          destinationStoreId: destinationStore.id,
          sourceLocationId: sourceLocation.id,
          destinationLocationId: destinationLocation.id,
          requestedById: employee.id,
          requestedAt: new Date(),
          notes: args.input.notes?.trim() || "",
          idempotencyId,
        },
      });
      for (const [index, line] of lines.entries()) {
        const variant = variants.find((entry) => entry.id === line.variantId)!;
        await transaction.inventoryTransferLine.create({
          data: {
            businessId: args.input.businessId,
            transferId: transfer.id,
            variantId: variant.id,
            lineNumber: index + 1,
            skuSnapshot: variant.sku,
            titleSnapshot: `${variant.product?.title ?? "Product"} · ${variant.title}`,
            quantityRequested: line.quantity,
            quantityShipped: "0.0000",
            quantityReceived: "0.0000",
          },
        });
      }
      return {
        id: transfer.id,
        status: transfer.status,
        reference: transfer.transferNumber,
      };
    },
  });
}

export async function transitionInventoryTransfer(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      transferId: string;
      employeeId: string;
      nextStatus: "approved" | "shipped" | "received" | "cancelled";
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const session = requireSession(context) as Session;
  const scopedTransfer = await context.prisma.inventoryTransfer.findFirst({
    where: { id: args.input.transferId, businessId: args.input.businessId },
    select: { sourceStoreId: true, destinationStoreId: true },
  });
  if (!scopedTransfer?.sourceStoreId || !scopedTransfer.destinationStoreId)
    throw new Error("Inventory transfer not found");
  assertStorePermission(
    session,
    args.input.businessId,
    scopedTransfer.sourceStoreId,
    "canManageInventory",
  );
  assertStorePermission(
    session,
    args.input.businessId,
    scopedTransfer.destinationStoreId,
    "canManageInventory",
  );
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageInventory",
    scope: `transitionInventoryTransfer:${args.input.nextStatus}`,
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "InventoryTransfer",
    action: `inventory_transfer.${args.input.nextStatus}`,
    execute: async (transaction, idempotencyId) => {
      const transfer = await transaction.inventoryTransfer.findFirst({
        where: { id: args.input.transferId, businessId: args.input.businessId },
        include: {
          lines: {
            orderBy: { lineNumber: "asc" },
            include: {
              variant: true,
              allocations: { include: { sourceLot: true } },
            },
          },
        },
      });
      if (!transfer) throw new Error("Inventory transfer not found");
      const transition = evaluateTransition(
        transitions,
        transfer.status,
        args.input.nextStatus,
      );
      if (transition.replay)
        return {
          id: transfer.id,
          status: transfer.status,
          reference: transfer.transferNumber,
        };
      const employee = await transferEmployee(transaction, {
        employeeId: args.input.employeeId,
        businessId: args.input.businessId,
        sourceStoreId: transfer.sourceStoreId!,
        destinationStoreId: transfer.destinationStoreId!,
      });
      if (!transfer.lines.length)
        throw new Error("Inventory transfer has no lines");
      const now = new Date();

      if (args.input.nextStatus === "approved") {
        for (const line of transfer.lines) {
          const stock = await transaction.stockLevel.findUnique({
            where: {
              lookupKey: `${transfer.sourceLocationId}:${line.variantId}`,
            },
          });
          if (
            !stock ||
            compareQuantities(
              stock.onHandQuantity.toString(),
              line.quantityRequested.toString(),
            ) < 0
          ) {
            throw new Error(
              `Insufficient source inventory for ${line.skuSnapshot}`,
            );
          }
        }
      }

      if (args.input.nextStatus === "shipped") {
        for (const line of transfer.lines) {
          const stock = await transaction.stockLevel.findUnique({
            where: {
              lookupKey: `${transfer.sourceLocationId}:${line.variantId}`,
            },
          });
          if (!stock)
            throw new Error(
              `Source stock position is missing for ${line.skuSnapshot}`,
            );
          const previous = stock.onHandQuantity.toString();
          const balanceAfter = addQuantities(
            previous,
            `-${line.quantityRequested}`,
          );
          if (compareQuantities(balanceAfter, "0") < 0)
            throw new Error(
              `Insufficient source inventory for ${line.skuSnapshot}`,
            );
          await transaction.stockLevel.update({
            where: { id: stock.id },
            data: { onHandQuantity: balanceAfter },
          });
          const segments = await consumeInventoryLots(transaction, {
            businessId: args.input.businessId,
            storeId: transfer.sourceStoreId!,
            locationId: transfer.sourceLocationId!,
            variantId: line.variantId!,
            quantity: line.quantityRequested.toString(),
          });
          if (
            segments.some((segment) => !segment.lotId) &&
            !line.variant?.allowNegativeInventory
          ) {
            throw new Error(
              `Transfer ${line.skuSnapshot} exceeds active, unexpired FIFO lot quantity`,
            );
          }
          let runningBalance = previous;
          for (const [segmentIndex, segment] of segments.entries()) {
            runningBalance = addQuantities(
              runningBalance,
              `-${segment.quantity}`,
            );
            const lot = segment.lotId
              ? await transaction.inventoryLot.findUnique({
                  where: { id: segment.lotId },
                })
              : null;
            await transaction.inventoryTransferLotAllocation.create({
              data: {
                businessId: args.input.businessId,
                lineId: line.id,
                sourceLotId: lot?.id ?? null,
                allocationKey: `${line.id}:${lot?.id ?? `untracked-${segmentIndex}`}`,
                quantity: segment.quantity,
                lotNumberSnapshot: lot?.lotNumber ?? "UNTRACKED",
                expiresAtSnapshot: lot?.expiresAt ?? null,
                unitCostCents:
                  lot?.unitCostCents ?? line.variant?.costCents ?? 0,
              },
            });
            await transaction.inventoryLedgerEntry.create({
              data: {
                businessId: args.input.businessId,
                storeId: transfer.sourceStoreId!,
                stockLevelId: stock.id,
                locationId: transfer.sourceLocationId!,
                variantId: line.variantId!,
                lotId: lot?.id ?? null,
                type: "transfer_out",
                quantityDelta: `-${segment.quantity}`,
                balanceAfter: runningBalance,
                unitCostCents: lot?.unitCostCents ?? line.variant?.costCents,
                reason: `Transfer ${transfer.transferNumber} shipped`,
                sourceType: "InventoryTransfer",
                sourceId: transfer.id,
                actorId: employee.id,
                idempotencyId,
                occurredAt: now,
              },
            });
          }
          if (runningBalance !== balanceAfter)
            throw new Error(
              "Transfer lot allocation did not reconcile to source stock",
            );
          await transaction.inventoryTransferLine.update({
            where: { id: line.id },
            data: { quantityShipped: line.quantityRequested },
          });
        }
      }

      if (args.input.nextStatus === "received") {
        for (const line of transfer.lines) {
          if (
            compareQuantities(
              line.quantityShipped.toString(),
              line.quantityRequested.toString(),
            ) !== 0
          ) {
            throw new Error(
              `Transfer line ${line.lineNumber} was not fully shipped`,
            );
          }
          const lookupKey = `${transfer.destinationLocationId}:${line.variantId}`;
          const existingStock = await transaction.stockLevel.findUnique({
            where: { lookupKey },
          });
          const previous = existingStock?.onHandQuantity.toString() ?? "0.0000";
          const balanceAfter = addQuantities(
            previous,
            line.quantityShipped.toString(),
          );
          const stock = existingStock
            ? await transaction.stockLevel.update({
                where: { id: existingStock.id },
                data: { onHandQuantity: balanceAfter },
              })
            : await transaction.stockLevel.create({
                data: {
                  businessId: args.input.businessId,
                  storeId: transfer.destinationStoreId!,
                  locationId: transfer.destinationLocationId!,
                  variantId: line.variantId!,
                  lookupKey,
                  onHandQuantity: balanceAfter,
                  reservedQuantity: "0.0000",
                  parQuantity: "0.0000",
                  reorderPoint: "0.0000",
                  reorderQuantity: "0.0000",
                },
              });
          let runningBalance = previous;
          for (const [
            allocationIndex,
            allocation,
          ] of line.allocations.entries()) {
            let destinationLotId: string | null = null;
            if (allocation.sourceLot) {
              const destinationLot = await transaction.inventoryLot.create({
                data: {
                  businessId: args.input.businessId,
                  storeId: transfer.destinationStoreId!,
                  locationId: transfer.destinationLocationId!,
                  variantId: line.variantId!,
                  vendorId: allocation.sourceLot.vendorId,
                  lotNumber: allocation.lotNumberSnapshot,
                  lookupKey: `${transfer.destinationLocationId}:${transfer.id}:${line.id}:${allocationIndex}`,
                  quantityReceived: allocation.quantity,
                  quantityRemaining: allocation.quantity,
                  unitCostCents: allocation.unitCostCents,
                  receivedAt: now,
                  expiresAt: allocation.expiresAtSnapshot,
                  status: "active",
                  metadata: {
                    transferId: transfer.id,
                    sourceLotId: allocation.sourceLot.id,
                  },
                },
              });
              destinationLotId = destinationLot.id;
              await transaction.inventoryTransferLotAllocation.update({
                where: { id: allocation.id },
                data: { destinationLotId },
              });
            }
            runningBalance = addQuantities(
              runningBalance,
              allocation.quantity.toString(),
            );
            await transaction.inventoryLedgerEntry.create({
              data: {
                businessId: args.input.businessId,
                storeId: transfer.destinationStoreId!,
                stockLevelId: stock.id,
                locationId: transfer.destinationLocationId!,
                variantId: line.variantId!,
                lotId: destinationLotId,
                type: "transfer_in",
                quantityDelta: allocation.quantity,
                balanceAfter: runningBalance,
                unitCostCents: allocation.unitCostCents,
                reason: `Transfer ${transfer.transferNumber} received`,
                sourceType: "InventoryTransfer",
                sourceId: transfer.id,
                actorId: employee.id,
                idempotencyId,
                occurredAt: now,
              },
            });
          }
          if (runningBalance !== balanceAfter)
            throw new Error(
              "Transfer allocations did not reconcile to destination stock",
            );
          await transaction.inventoryTransferLine.update({
            where: { id: line.id },
            data: { quantityReceived: line.quantityShipped },
          });
        }
      }

      const lifecycleData =
        args.input.nextStatus === "approved"
          ? { approvedById: employee.id, approvedAt: now }
          : args.input.nextStatus === "shipped"
            ? { shippedById: employee.id, shippedAt: now }
            : args.input.nextStatus === "received"
              ? { receivedById: employee.id, receivedAt: now }
              : { cancelledAt: now };
      const updated = await transaction.inventoryTransfer.update({
        where: { id: transfer.id },
        data: {
          status: args.input.nextStatus,
          ...lifecycleData,
          notes: args.input.notes?.trim() || transfer.notes,
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.transferNumber,
      };
    },
  });
}

import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";

import {
  compareQuantities,
  normalizeQuantity,
  quantityToScaledInteger,
} from "../lib/quantity";
import {
  evaluateTransition,
  PURCHASE_ORDER_TRANSITIONS,
} from "../lib/transitionPolicy";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

function lineTotalCents(unitCostCents: number, quantity: string): number {
  if (!Number.isSafeInteger(unitCostCents) || unitCostCents < 0) {
    throw new Error("Purchase-order unit cost must be non-negative integer cents");
  }
  const scaled = quantityToScaledInteger(quantity);
  const total = (BigInt(unitCostCents) * scaled + 5_000n) / 10_000n;
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Purchase-order line total exceeds safe integer range");
  return Number(total);
}

export async function configureVendor(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      name: string;
      vendorNumber: string;
      paymentTerms: "cod" | "net_7" | "net_15" | "net_30" | "net_60" | "prepaid";
      contactName?: string | null;
      email?: string | null;
      phone?: string | null;
      leadTimeDays?: number | null;
      minimumOrderCents?: number | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const name = args.input.name.trim();
  const vendorNumber = args.input.vendorNumber.trim();
  const leadTimeDays = args.input.leadTimeDays ?? 0;
  const minimumOrderCents = args.input.minimumOrderCents ?? 0;
  if (!name || !vendorNumber) throw new Error("Vendor name and number are required");
  if (!Number.isSafeInteger(leadTimeDays) || leadTimeDays < 0 || leadTimeDays > 3650) {
    throw new Error("Vendor lead time must be an integer from 0 to 3650 days");
  }
  if (!Number.isSafeInteger(minimumOrderCents) || minimumOrderCents < 0) {
    throw new Error("Vendor minimum order must be non-negative integer cents");
  }
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManagePurchasing",
    scope: "configureVendor",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, name, vendorNumber, leadTimeDays, minimumOrderCents },
    resourceType: "Vendor",
    action: "vendor.configure",
    execute: async (transaction, idempotencyId) => {
      const lookupKey = `${args.input.businessId}:${vendorNumber}`;
      const existing = await transaction.vendor.findUnique({ where: { lookupKey } });
      const data = {
        name,
        vendorNumber,
        status: "active" as const,
        paymentTerms: args.input.paymentTerms,
        contactName: args.input.contactName?.trim() || "",
        email: args.input.email?.trim().toLowerCase() || "",
        phone: args.input.phone?.trim() || "",
        leadTimeDays,
        minimumOrderCents,
        metadata: { idempotencyId },
      };
      const vendor = existing
        ? await transaction.vendor.update({ where: { id: existing.id }, data })
        : await transaction.vendor.create({
            data: { businessId: args.input.businessId, lookupKey, ...data },
          });
      return { id: vendor.id, status: vendor.status, reference: vendor.vendorNumber };
    },
  });
}

export async function configureVendorItem(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      vendorId: string;
      variantId: string;
      vendorSku: string;
      casePackQuantity: string;
      unitsPerCase: number;
      unitCostCents: number;
      leadTimeDays?: number | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const vendorSku = args.input.vendorSku.trim();
  const casePackQuantity = normalizeQuantity(args.input.casePackQuantity);
  const leadTimeDays = args.input.leadTimeDays ?? 0;
  if (!vendorSku || vendorSku.length > 100) throw new Error("Vendor SKU is required and must not exceed 100 characters");
  if (compareQuantities(casePackQuantity, "0") <= 0) throw new Error("Case-pack quantity must be positive");
  if (!Number.isSafeInteger(args.input.unitsPerCase) || args.input.unitsPerCase < 1 || args.input.unitsPerCase > 1_000_000) throw new Error("Units per case must be a positive integer");
  if (!Number.isSafeInteger(args.input.unitCostCents) || args.input.unitCostCents < 0) throw new Error("Vendor item cost must be non-negative integer cents");
  if (!Number.isSafeInteger(leadTimeDays) || leadTimeDays < 0 || leadTimeDays > 3650) throw new Error("Lead time must be an integer from 0 to 3650 days");
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManagePurchasing",
    scope: "configureVendorItem",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, vendorSku, casePackQuantity, leadTimeDays },
    resourceType: "VendorItem",
    action: "vendor_item.configure",
    execute: async (transaction) => {
      const [vendor, variant] = await Promise.all([
        transaction.vendor.findFirst({ where: { id: args.input.vendorId, businessId: args.input.businessId, status: "active" } }),
        transaction.productVariant.findFirst({ where: { id: args.input.variantId, businessId: args.input.businessId, status: "active" } }),
      ]);
      if (!vendor || !variant) throw new Error("Active vendor or catalog variant not found");
      const lookupKey = `${vendor.id}:${vendorSku}`;
      const item = await transaction.vendorItem.upsert({
        where: { lookupKey },
        update: {
          variantId: variant.id,
          status: "active",
          casePackQuantity,
          unitsPerCase: args.input.unitsPerCase,
          unitCostCents: args.input.unitCostCents,
          leadTimeDays,
        },
        create: {
          businessId: args.input.businessId,
          vendorId: vendor.id,
          variantId: variant.id,
          vendorSku,
          lookupKey,
          status: "active",
          casePackQuantity,
          unitsPerCase: args.input.unitsPerCase,
          unitCostCents: args.input.unitCostCents,
          leadTimeDays,
        },
      });
      return { id: item.id, status: item.status, reference: item.vendorSku };
    },
  });
}

export async function draftPurchaseOrder(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      vendorId: string;
      employeeId: string;
      expectedAt?: string | null;
      notes?: string | null;
      lines: Array<{
        variantId: string;
        vendorItemId?: string | null;
        quantityOrdered: string;
        unitCostCents?: number | null;
      }>;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (!args.input.lines.length || args.input.lines.length > 500) {
    throw new Error("Purchase order requires 1-500 lines");
  }
  const lines = args.input.lines.map((line) => ({
    ...line,
    quantityOrdered: normalizeQuantity(line.quantityOrdered),
  }));
  if (lines.some((line) => compareQuantities(line.quantityOrdered, "0") <= 0)) {
    throw new Error("Purchase-order quantities must be positive");
  }
  if (new Set(lines.map((line) => line.variantId)).size !== lines.length) {
    throw new Error("A variant may appear only once per purchase order");
  }
  const expectedAt = args.input.expectedAt ? new Date(args.input.expectedAt) : null;
  if (expectedAt && !Number.isFinite(expectedAt.getTime())) throw new Error("Expected date must be valid");
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePurchasing",
    scope: "draftPurchaseOrder",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, lines, expectedAt },
    resourceType: "PurchaseOrder",
    action: "purchase_order.create",
    execute: async (transaction, idempotencyId) => {
      const [store, vendor, employee] = await Promise.all([
        transaction.store.findFirst({
          where: { id: args.input.storeId, businessId: args.input.businessId, status: "active" },
        }),
        transaction.vendor.findFirst({
          where: { id: args.input.vendorId, businessId: args.input.businessId, status: "active" },
        }),
        transaction.employee.findFirst({
          where: {
            id: args.input.employeeId,
            businessId: args.input.businessId,
            status: "active",
            stores: { some: { id: args.input.storeId } },
          },
        }),
      ]);
      if (!store || !vendor || !employee) throw new Error("Store, vendor, or purchasing employee is invalid");
      const resolvedLines: Array<{
        variantId: string;
        descriptionSnapshot: string;
        vendorItemId: string | null;
        vendorSkuSnapshot: string;
        quantityOrdered: string;
        unitCostCents: number;
        lineTotalCents: number;
      }> = [];
      for (const line of lines) {
        const variant = await transaction.productVariant.findFirst({
          where: { id: line.variantId, businessId: args.input.businessId, status: "active" },
          include: { product: { select: { title: true } } },
        });
        if (!variant) throw new Error("Purchase-order variant not found");
        const vendorItem = line.vendorItemId
          ? await transaction.vendorItem.findFirst({
              where: {
                id: line.vendorItemId,
                businessId: args.input.businessId,
                vendorId: vendor.id,
                variantId: variant.id,
                status: "active",
              },
            })
          : null;
        if (line.vendorItemId && !vendorItem) throw new Error("Vendor item does not match the vendor and variant");
        const unitCostCents = line.unitCostCents ?? vendorItem?.unitCostCents;
        if (unitCostCents == null) throw new Error("Each purchase-order line requires a unit cost or vendor item");
        resolvedLines.push({
          variantId: variant.id,
          descriptionSnapshot: `${variant.product?.title ?? "Product"} · ${variant.title}`,
          vendorItemId: vendorItem?.id ?? null,
          vendorSkuSnapshot: vendorItem?.vendorSku ?? "",
          quantityOrdered: line.quantityOrdered,
          unitCostCents,
          lineTotalCents: lineTotalCents(unitCostCents, line.quantityOrdered),
        });
      }
      const subtotalCents = resolvedLines.reduce((total, line) => total + line.lineTotalCents, 0);
      if (!Number.isSafeInteger(subtotalCents)) throw new Error("Purchase-order subtotal exceeds safe integer range");
      const purchaseOrder = await transaction.purchaseOrder.create({
        data: {
          businessId: args.input.businessId,
          storeId: store.id,
          vendorId: vendor.id,
          poNumber: `PO-${randomUUID()}`,
          status: "draft",
          currencyCode: store.currencyCode,
          subtotalCents,
          taxCents: 0,
          shippingCents: 0,
          totalCents: subtotalCents,
          expectedAt,
          createdById: employee.id,
          notes: args.input.notes?.trim() || "",
          metadata: { idempotencyId },
        },
      });
      for (const line of resolvedLines) {
        await transaction.purchaseOrderLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: store.id,
            purchaseOrderId: purchaseOrder.id,
            vendorItemId: line.vendorItemId,
            variantId: line.variantId,
            descriptionSnapshot: line.descriptionSnapshot,
            vendorSkuSnapshot: line.vendorSkuSnapshot,
            quantityOrdered: line.quantityOrdered,
            quantityReceived: "0.0000",
            quantityCancelled: "0.0000",
            unitCostCents: line.unitCostCents,
            lineTotalCents: line.lineTotalCents,
          },
        });
      }
      return { id: purchaseOrder.id, status: purchaseOrder.status, reference: purchaseOrder.poNumber };
    },
  });
}

export async function transitionPurchaseOrder(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      purchaseOrderId: string;
      employeeId: string;
      nextStatus: "submitted" | "approved" | "cancelled";
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (!new Set(["submitted", "approved", "cancelled"]).has(args.input.nextStatus)) {
    throw new Error("Unsupported purchase-order transition target");
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePurchasing",
    scope: "transitionPurchaseOrder",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "PurchaseOrder",
    action: `purchase_order.${args.input.nextStatus}`,
    execute: async (transaction) => {
      const purchaseOrder = await transaction.purchaseOrder.findFirst({
        where: {
          id: args.input.purchaseOrderId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
        include: { lines: true },
      });
      if (!purchaseOrder) throw new Error("Purchase order not found for this business and store");
      const transition = evaluateTransition(
        PURCHASE_ORDER_TRANSITIONS,
        purchaseOrder.status,
        args.input.nextStatus,
      );
      if (transition.replay) {
        return {
          id: purchaseOrder.id,
          status: purchaseOrder.status,
          reference: purchaseOrder.poNumber,
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
      if (!employee) throw new Error("Active purchasing employee is not assigned to this store");
      if (args.input.nextStatus !== "cancelled" && !purchaseOrder.lines.length) {
        throw new Error("Purchase order must contain at least one line");
      }

      const subtotalCents = purchaseOrder.lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
      const totalCents = subtotalCents + purchaseOrder.taxCents + purchaseOrder.shippingCents;
      const now = new Date();
      const updated = await transaction.purchaseOrder.update({
        where: { id: purchaseOrder.id },
        data: {
          status: args.input.nextStatus,
          subtotalCents,
          totalCents,
          ...(args.input.nextStatus === "submitted"
            ? { submittedAt: now, orderedAt: purchaseOrder.orderedAt ?? now }
            : {}),
          ...(args.input.nextStatus === "approved"
            ? { approvedAt: now, approvedById: employee.id }
            : {}),
          ...(args.input.nextStatus === "cancelled"
            ? { cancelledAt: now }
            : {}),
        },
      });
      return { id: updated.id, status: updated.status, reference: updated.poNumber };
    },
  });
}

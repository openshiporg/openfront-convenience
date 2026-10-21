import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import type { BaseListTypeInfo, ListHooks } from "@keystone-6/core/types";
import type { Context } from ".keystone/types";

import { fingerprintInput } from "../lib/idempotency";
import { requireRelationshipId, requiredRelationshipHooks } from "./validation";

type VendorItem = {
  id?: { toString(): string } | string | null;
  businessId?: string | null;
  name?: string | null;
  vendorNumber?: string | null;
  status?: string | null;
};

type ResolvedData = Record<string, unknown>;

function normalizeVendorData(resolvedData: ResolvedData, businessId?: string | null) {
  const next = { ...resolvedData };
  for (const field of ["name", "vendorNumber"] as const) {
    if (typeof next[field] === "string") next[field] = next[field].trim();
  }
  const effectiveBusinessId = requireRelationshipId(next.business) ?? businessId ?? null;
  if (effectiveBusinessId && typeof next.vendorNumber === "string" && next.vendorNumber) {
    next.lookupKey = `${effectiveBusinessId}:${next.vendorNumber}`;
  }
  return next;
}

async function emitVendorEvent(
  operation: "create" | "update" | "delete",
  item: VendorItem | null | undefined,
  originalItem: VendorItem | null | undefined,
  context: Context,
) {
  const aggregate = item ?? originalItem;
  if (!aggregate?.id || !aggregate.businessId) return;
  const aggregateId = aggregate.id.toString();
  const payload = {
    operation,
    vendor: {
      id: aggregateId,
      name: aggregate.name ?? "",
      vendorNumber: aggregate.vendorNumber ?? "",
      status: aggregate.status ?? "",
    },
    previous: operation === "update" ? originalItem ?? null : null,
  };
  const topic = `convenience.vendor.${operation}.v1`;
  await context.prisma.outboxEvent.create({
    data: {
      businessId: aggregate.businessId,
      eventKey: `hook:vendor:${aggregateId}:${operation}:${randomUUID()}`,
      topic,
      schemaVersion: 1,
      aggregateType: "Vendor",
      aggregateId,
      action: `vendor.${operation}`,
      payload: payload as Prisma.InputJsonValue,
      payloadHash: fingerprintInput(payload),
      status: "pending",
      attempts: 0,
      totalAttempts: 0,
      replayCount: 0,
      maxAttempts: 8,
      availableAt: new Date(),
      occurredAt: new Date(),
    },
    select: { id: true, topic: true },
  });
}

export const vendorHooks = {
  resolveInput: {
    create: async ({ resolvedData }) => normalizeVendorData(resolvedData),
    update: async ({ resolvedData, item }) =>
      normalizeVendorData(resolvedData, (item as VendorItem).businessId),
  },
  validateInput: async (args) =>
    requiredRelationshipHooks("business").validateInput(args),
  beforeOperation: {
    create: async () => undefined,
    update: async ({ resolvedData }) => {
      if (resolvedData.business !== undefined) {
        throw new Error("Vendor business cannot be reassigned");
      }
    },
    delete: async ({ item, context }) => {
      const vendor = item as VendorItem;
      if (!vendor.id) return;
      const purchaseOrders = await context.prisma.purchaseOrder.count({
        where: { vendorId: vendor.id.toString() },
      });
      if (purchaseOrders) throw new Error("Vendor with purchase orders cannot be deleted");
    },
  },
  afterOperation: async ({ operation, item, originalItem, context }) => {
    await emitVendorEvent(
      operation,
      item as VendorItem | null,
      originalItem as VendorItem | null,
      context as unknown as Context,
    );
  },
} satisfies ListHooks<BaseListTypeInfo>;

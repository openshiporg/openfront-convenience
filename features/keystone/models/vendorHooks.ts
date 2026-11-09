import type { BaseListTypeInfo, ListHooks } from "@keystone-6/core/types";

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
} satisfies ListHooks<BaseListTypeInfo>;

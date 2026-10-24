import type { Context } from ".keystone/types";

import type { OperationResult } from "./cashOperations";
import { runIdempotentOperation } from "./operationRunner";

// Registers and stock locations after onboarding: the same lookup keys
// onboarding uses (`${storeId}:${code}`), so a code updates its existing row.

function code(value: string, label: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(normalized)) {
    throw new Error(`${label} must be lowercase letters, numbers or dashes`);
  }
  return normalized;
}

async function assertStoreOfBusiness(
  transaction: Parameters<Parameters<typeof runIdempotentOperation>[0]["execute"]>[0],
  businessId: string,
  storeId: string,
) {
  const store = await transaction.store.findFirst({ where: { id: storeId, businessId }, select: { id: true } });
  if (!store) throw new Error("Store not found for this business");
}

export async function configureRegister(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      name: string;
      code: string;
      status: "active" | "offline" | "maintenance" | "retired";
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const name = args.input.name.trim();
  if (!name || name.length > 80) throw new Error("Register name is required (80 characters at most)");
  const registerCode = code(args.input.code, "Register code");
  if (!["active", "offline", "maintenance", "retired"].includes(args.input.status)) {
    throw new Error("Register status is not supported");
  }
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageCash",
    scope: "configureRegister",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, name, code: registerCode },
    resourceType: "Register",
    action: "register.configure",
    execute: async (transaction, idempotencyId) => {
      await assertStoreOfBusiness(transaction, args.input.businessId, args.input.storeId);
      const lookupKey = `${args.input.storeId}:${registerCode}`;
      const existing = await transaction.register.findUnique({ where: { lookupKey } });
      if (existing && existing.businessId !== args.input.businessId) throw new Error("Register belongs to another business");
      if (existing && args.input.status !== "active") {
        const open = await transaction.registerSession.count({
          where: { registerId: existing.id, status: { in: ["open", "closing", "suspended"] } },
        });
        if (open) throw new Error("Close the open till session before taking this register out of service");
      }
      const register = existing
        ? await transaction.register.update({
            where: { id: existing.id },
            data: { name, status: args.input.status, metadata: { ...((existing.metadata as object) ?? {}), idempotencyId } },
          })
        : await transaction.register.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              name,
              code: registerCode,
              lookupKey,
              status: args.input.status,
              metadata: { idempotencyId },
            },
          });
      return { id: register.id, status: register.status, reference: register.code };
    },
  });
}

export async function configureInventoryLocation(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      name: string;
      code: string;
      type: "sales_floor" | "back_room" | "cooler" | "freezer" | "kitchen" | "warehouse";
      status: "active" | "inactive";
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const name = args.input.name.trim();
  if (!name || name.length > 80) throw new Error("Location name is required (80 characters at most)");
  const locationCode = code(args.input.code, "Location code");
  if (!["sales_floor", "back_room", "cooler", "freezer", "kitchen", "warehouse"].includes(args.input.type)) {
    throw new Error("Location type is not supported");
  }
  if (!["active", "inactive"].includes(args.input.status)) throw new Error("Location status is not supported");
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageInventory",
    scope: "configureInventoryLocation",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, name, code: locationCode },
    resourceType: "InventoryLocation",
    action: "inventory_location.configure",
    execute: async (transaction, idempotencyId) => {
      await assertStoreOfBusiness(transaction, args.input.businessId, args.input.storeId);
      const lookupKey = `${args.input.storeId}:${locationCode}`;
      const existing = await transaction.inventoryLocation.findUnique({ where: { lookupKey } });
      if (existing && existing.businessId !== args.input.businessId) throw new Error("Location belongs to another business");
      if (existing && args.input.status === "inactive") {
        const stocked = await transaction.stockLevel.count({ where: { locationId: existing.id, onHandQuantity: { not: 0 } } });
        if (stocked) throw new Error("Move or adjust the stock in this location before deactivating it");
        const primary = await transaction.store.count({ where: { primaryInventoryLocationId: existing.id } });
        if (primary) throw new Error("This is the store's primary location");
      }
      const location = existing
        ? await transaction.inventoryLocation.update({
            where: { id: existing.id },
            data: { name, type: args.input.type, status: args.input.status, metadata: { ...((existing.metadata as object) ?? {}), idempotencyId } },
          })
        : await transaction.inventoryLocation.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              name,
              code: locationCode,
              lookupKey,
              type: args.input.type,
              status: args.input.status,
              metadata: { idempotencyId },
            },
          });
      return { id: location.id, status: location.status, reference: location.code };
    },
  });
}

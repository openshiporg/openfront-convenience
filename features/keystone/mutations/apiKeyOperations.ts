import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import type { Context } from ".keystone/types";

import {
  canAccessBusiness,
  canAccessStore,
  isHumanPlatformAdmin,
  permissionKeys,
  type PermissionKey,
  type Session,
} from "../access";
import { requireSession, runIdempotentOperation } from "./operationRunner";

export type ApiKeyOperationResult = {
  id: string;
  status: string;
  replayed: boolean;
  reference: string | null;
  token: string | null;
};

export async function createBusinessApiKey(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      name: string;
      scopes: string[];
      storeIds?: string[] | null;
      allStores?: boolean | null;
      expiresAt?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<ApiKeyOperationResult> {
  const input = args.input;
  if (!input.name.trim()) throw new Error("API key name is required");
  if (!input.scopes.length)
    throw new Error("At least one API key scope is required");
  const validScopes = new Set<string>(permissionKeys);
  const scopes = Array.from(new Set(input.scopes));
  for (const scope of scopes) {
    if (!validScopes.has(scope))
      throw new Error(`Unsupported API key scope: ${scope}`);
  }
  const storeIds = Array.from(new Set(input.storeIds ?? [])).sort();
  const allStores = input.allStores ?? false;
  if (storeIds.length > 100)
    throw new Error("API key scope cannot name more than 100 explicit stores");
  if (allStores === Boolean(storeIds.length)) {
    throw new Error(
      "API key must target explicit stores or all stores, but not both",
    );
  }
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (
    expiresAt &&
    (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())
  ) {
    throw new Error("API key expiry must be a future ISO timestamp");
  }

  const session = requireSession(context) as Session;
  if (session.apiKeyId)
    throw new Error("Machine sessions cannot create API keys");
  if (allStores && !isHumanPlatformAdmin(session)) {
    throw new Error(
      "Only an explicitly approved platform administrator can create an all-store API key",
    );
  }
  for (const scope of scopes) {
    if (!canAccessBusiness(session, input.businessId, scope as PermissionKey)) {
      throw new Error("API key scopes cannot exceed the creator's permissions");
    }
  }
  let plaintextToken: string | null = null;
  const result = await runIdempotentOperation({
    context,
    businessId: input.businessId,
    permission: "canManageApiKeys",
    scope: "createBusinessApiKey",
    idempotencyKey: input.idempotencyKey,
    input: {
      ...input,
      scopes,
      storeIds,
      allStores,
      expiresAt: expiresAt?.toISOString() ?? null,
    },
    resourceType: "ApiKey",
    action: "api_key.create",
    execute: async (transaction) => {
      const stores = await transaction.store.findMany({
        where: {
          businessId: input.businessId,
          status: "active",
          ...(!allStores ? { id: { in: storeIds } } : {}),
        },
        select: { id: true },
        orderBy: { id: "asc" },
        take: allStores ? 10_001 : 101,
      });
      if (allStores && stores.length > 10_000)
        throw new Error(
          "All-store API keys are limited to businesses with at most 10,000 active stores",
        );
      if ((!allStores && stores.length !== storeIds.length) || !stores.length) {
        throw new Error(
          "API key store scope must contain active tenant stores",
        );
      }
      for (const store of stores) {
        if (
          !canAccessStore(
            session,
            input.businessId,
            store.id,
            "canManageApiKeys",
          )
        ) {
          throw new Error(
            "API key store scope cannot exceed the creator's key-management assignments",
          );
        }
        for (const scope of scopes) {
          if (
            !canAccessStore(
              session,
              input.businessId,
              store.id,
              scope as PermissionKey,
            )
          ) {
            throw new Error(
              "API key permissions must be independently held at every target store",
            );
          }
        }
      }
      const prefix = randomBytes(6).toString("hex");
      plaintextToken = `ofc_${prefix}_${randomBytes(32).toString("base64url")}`;
      const secretHash = await bcrypt.hash(plaintextToken, 12);
      const apiKey = await transaction.apiKey.create({
        data: {
          businessId: input.businessId,
          name: input.name.trim(),
          keyPrefix: `ofc_${prefix}`,
          lookupKey: `${input.businessId}:ofc_${prefix}`,
          secretHash,
          status: "active",
          scopes,
          allStores,
          stores: allStores
            ? undefined
            : { connect: storeIds.map((id) => ({ id })) },
          createdById: session.itemId,
          expiresAt,
        },
      });
      return {
        id: apiKey.id,
        status: apiKey.status,
        reference: apiKey.keyPrefix,
      };
    },
  });

  return {
    ...result,
    token: result.replayed ? null : plaintextToken,
  };
}

export async function revokeBusinessApiKey(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      apiKeyId: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<ApiKeyOperationResult> {
  const session = requireSession(context) as Session;
  if (session.apiKeyId)
    throw new Error("Machine sessions cannot revoke API keys");
  const result = await runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageApiKeys",
    scope: "revokeBusinessApiKey",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "ApiKey",
    action: "api_key.revoke",
    execute: async (transaction) => {
      const apiKey = await transaction.apiKey.findFirst({
        where: {
          id: args.input.apiKeyId,
          businessId: args.input.businessId,
        },
        include: { stores: { select: { id: true } } },
      });
      if (!apiKey) throw new Error("API key not found for this business");
      if (
        !isHumanPlatformAdmin(session) &&
        ((apiKey.allStores && apiKey.createdById !== session.itemId) ||
          (!apiKey.allStores &&
            (!apiKey.stores.length ||
              apiKey.stores.some(
                (store) =>
                  !canAccessStore(
                    session,
                    args.input.businessId,
                    store.id,
                    "canManageApiKeys",
                  ),
              ))))
      ) {
        throw new Error(
          "API key scope exceeds the manager's store assignments",
        );
      }
      if (apiKey.status === "revoked") {
        return {
          id: apiKey.id,
          status: apiKey.status,
          reference: apiKey.keyPrefix,
        };
      }
      const updated = await transaction.apiKey.update({
        where: { id: apiKey.id },
        data: { status: "revoked", revokedAt: new Date() },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.keyPrefix,
      };
    },
  });
  return { ...result, token: null };
}

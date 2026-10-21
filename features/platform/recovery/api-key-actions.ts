"use server";

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import type { ApiKeyCreationState } from "./api-key-state";

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

export async function createOfflineApiKeyAction(
  _previous: ApiKeyCreationState,
  formData: FormData,
): Promise<ApiKeyCreationState> {
  const businessId = field(formData, "businessId");
  const storeId = field(formData, "storeId");
  const name = field(formData, "name");
  if (!businessId || !storeId || !name) {
    return { status: "error", token: "", reference: "", message: "Business, store, and key name are required." };
  }
  const response = await keystoneClient<{
    createBusinessApiKey: { id: string; status: string; reference: string | null; token: string | null };
  }>(`
    mutation CreateOfflineApiKey($input: CreateBusinessApiKeyInput!) {
      createBusinessApiKey(input: $input) { id status reference token }
    }
  `, {
    input: {
      businessId,
      name,
      scopes: [
        "canReadSales",
        "canManageSales",
        "canReadCash",
        "canManageCash",
        "canReadInventory",
        "canReadOfflineOperations",
        "canManageOfflineOperations",
      ],
      storeIds: [storeId],
      allStores: false,
      expiresAt: field(formData, "expiresAt") || null,
      idempotencyKey: field(formData, "idempotencyKey"),
    },
  });
  if (!response.success) {
    return { status: "error", token: "", reference: "", message: response.error || "API key creation failed." };
  }
  const result = response.data.createBusinessApiKey;
  if (!result.token) {
    return { status: "error", token: "", reference: result.reference ?? "", message: "Key result was replayed; create a new key to receive token material." };
  }
  revalidatePath("/dashboard/platform/recovery");
  return {
    status: "success",
    token: result.token,
    reference: result.reference ?? "",
    message: "Copy this token now. It will not be shown again.",
  };
}

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import type { PlatformOption } from "./projection";
import { searchValue } from "./projection";

export type PlatformScope = {
  businessId: string | null;
  storeId: string | null;
  businesses: PlatformOption[];
  stores: PlatformOption[];
  timezone: string | null;
  currencyCode: string | null;
};

type SearchRecord = Record<string, string | string[] | undefined>;

/**
 * The business and store a list page works in. Access rules already limit the
 * lists to what the signed-in person may see; this picks one of them the same
 * way the workbench pages do (URL first, then the first one).
 */
export async function getPlatformScope(search: SearchRecord): Promise<PlatformScope> {
  const businessesResponse = await keystoneClient<{ businesses: Array<{ id: string; name: string }> }>(
    `query PlatformScopeBusinesses { businesses(where: { status: { equals: active } }, orderBy: { name: asc }, take: 50) { id name } }`,
  );
  const businesses = businessesResponse.success ? businessesResponse.data.businesses : [];
  const requestedBusiness = searchValue(search, "businessId");
  const businessId = businesses.find((entry) => entry.id === requestedBusiness)?.id ?? businesses[0]?.id ?? null;
  if (!businessId) {
    return { businessId: null, storeId: null, businesses: [], stores: [], timezone: null, currencyCode: null };
  }
  const storesResponse = await keystoneClient<{
    stores: Array<{ id: string; name: string; timezone: string; currencyCode: string }>;
  }>(
    `query PlatformScopeStores($businessId: ID!) {
      stores(where: { business: { id: { equals: $businessId } }, status: { equals: active } }, orderBy: { name: asc }, take: 50) {
        id name timezone currencyCode
      }
    }`,
    { businessId },
  );
  const stores = storesResponse.success ? storesResponse.data.stores : [];
  const requestedStore = searchValue(search, "storeId");
  const store = stores.find((entry) => entry.id === requestedStore) ?? stores[0] ?? null;
  return {
    businessId,
    storeId: store?.id ?? null,
    businesses: businesses.map((entry) => ({ id: entry.id, label: entry.name })),
    stores: stores.map((entry) => ({ id: entry.id, label: entry.name })),
    timezone: store?.timezone ?? null,
    currencyCode: store?.currencyCode ?? null,
  };
}

/** `?businessId=…&storeId=…` so links keep the chosen scope. */
export function scopeQuery(scope: Pick<PlatformScope, "businessId" | "storeId">, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(
    Object.entries({ businessId: scope.businessId ?? "", storeId: scope.storeId ?? "", ...extra }).filter(([, value]) => value),
  );
  const text = params.toString();
  return text ? `?${text}` : "";
}

export function formatMoney(cents: number | string | null | undefined, currency: string | null | undefined): string {
  const value = Number(cents ?? 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(value / 100);
  } catch {
    return (value / 100).toFixed(2);
  }
}

export function formatWhen(value: string | null | undefined, timeZone: string | null | undefined): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timeZone || "UTC" });
  } catch {
    return new Date(value).toISOString();
  }
}

import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { readBasket } from "./basket-cookies";

export type Catalog = { currency: string; onlinePickup: boolean; page: number; pageSize: number; total: number; categories: string[]; products: { id: string; title: string; image: { url: string; alt: string } | null; description: string; category: string; variants: { id: string; title: string; priceCents: number; unitOfMeasure: string; availability: "in_stock" | "ask" | "sold_out" | "untracked" }[] }[] };
export type Basket = { id: string; status: string; currencyCode: string; subtotalCents: number; taxCents: number; totalCents: number; lines: { id: string; titleSnapshot: string; variantTitleSnapshot: string; quantity: string; unitPriceCents: number; subtotalCents?: number; totalCents: number }[] };
export type History = { id: string; receiptNumber: string; source: string; status: string; completedAt: string | null; currencyCode: string; totalCents: number; lines: { titleSnapshot: string; variantTitleSnapshot: string; quantity: string; unitPriceCents: number; totalCents: number }[] }[];
export async function catalog(filters: { search?: string; category?: string; page?: number; productId?: string } = {}) {
  const result = await keystoneClient<{ storefrontCatalog: Catalog }>("query Catalog($search: String, $category: String, $page: Int, $productId: ID) { storefrontCatalog(search: $search, category: $category, page: $page, productId: $productId) }", filters);
  return result.success ? result.data.storefrontCatalog : null;
}
export async function basket() {
  const { cartId, token } = readBasket(await cookies());
  if (!cartId || !token) return null;
  const result = await keystoneClient<{ storefrontBasket: Basket | null }>("query Basket($cartId: ID!, $token: String!) { storefrontBasket(cartId: $cartId, token: $token) }", { cartId, token });
  return result.success ? result.data.storefrontBasket : null;
}
export async function customer() {
  const result = await keystoneClient<{ authenticatedItem: { id: string; name: string; email: string } | null }>("query { authenticatedItem { ... on User { id name email } } }");
  return result.success ? result.data.authenticatedItem : null;
}
export async function history(saleId?: string) {
  const result = await keystoneClient<{ storefrontHistory: History }>("query History($saleId: ID) { storefrontHistory(saleId: $saleId) }", { saleId });
  return result.success ? result.data.storefrontHistory : [];
}
export type Rewards = Array<{ id: string; accountNumber: string; currencyCode: string; status: string; tier: string; pointsBalance: number; lifetimePoints: number; program: { name: string; redemptionPoints: number; redemptionValueCents: number } | null; entries: Array<{ type: string; pointsDelta: number; balanceAfter: number; occurredAt: string | null }> }>;
export async function rewards() {
  const result = await keystoneClient<{ storefrontRewards: Rewards }>("query { storefrontRewards }");
  return result.success ? result.data.storefrontRewards : [];
}
export const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

// Per-request memos: the shell and the page share these reads.
export const firstPage = cache(() => catalog({ page: 1 }));
export const currentCustomer = cache(() => customer());
export const customerHistory = cache(async () => ((await currentCustomer()) ? history() : []));
/** The reorder source: the newest completed web order, never a counter sale or a refunded order. */
export const lastWebOrder = cache(async () => (await customerHistory()).find((order) => order.source === "storefront" && order.status === "completed"));
export const customerRewards = cache(async () => ((await currentCustomer()) ? rewards() : []));

export type PickupOrder = { id: string; receiptNumber: string; status: string; refundedCents: number; pickupStatus: "none" | "ready_for_pickup" | "picked_up"; currencyCode: string; totalCents: number; subtotalCents: number; taxCents: number; completedAt: string | null; lines: { titleSnapshot: string; variantTitleSnapshot: string; quantity: string; subtotalCents: number; totalCents: number }[] };
export async function pickupOrder(link?: { cart?: string; token?: string }): Promise<PickupOrder | null> {
  const jar = await cookies();
  // The emailed receipt link carries the guest's own basket proof; otherwise the browser's cookies hold it.
  const stored = readBasket(jar);
  const cartId = link?.cart || stored.cartId; const token = link?.token || stored.token;
  if (!cartId || !token) return null;
  const result = await keystoneClient<{ storefrontPickupOrder: PickupOrder | null }>("query Order($cartId: ID!, $token: String!) { storefrontPickupOrder(cartId: $cartId, token: $token) }", { cartId, token });
  return result.success ? result.data.storefrontPickupOrder : null;
}

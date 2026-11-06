"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

/** Counter hand-over of an online pickup order. Keystone rechecks the store permission and the order state. */
export async function markPickedUpAction(form: FormData) {
  const saleId = value(form, "saleId");
  const query = new URLSearchParams();
  for (const key of ["businessId", "storeId"]) if (value(form, key)) query.set(key, value(form, key));
  const path = `/dashboard/platform/sales/${encodeURIComponent(saleId)}`;
  const result = await keystoneClient(`mutation MarkPickedUp($saleId: ID!) { markSalePickedUp(saleId: $saleId) }`, { saleId });
  query.set(result.success ? "notice" : "error", result.success ? "Marked picked up" : result.error || "Could not mark this order picked up");
  revalidatePath(path);
  redirect(`${path}?${query.toString()}`);
}

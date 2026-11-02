import type { Catalog, History } from "./data";

/** The lines of a past receipt the shop still sells online, matched to today's catalog by name and size. */
export function reorderable(order: History[number], data: Catalog) {
  const items: { variantId: string; quantity: number; title: string; variantTitle: string; priceCents: number }[] = [];
  for (const line of order.lines) {
    const product = data.products.find((entry) => entry.title === line.titleSnapshot);
    const variant = product?.variants.find((entry) => entry.title === line.variantTitleSnapshot) ?? (product?.variants.length === 1 ? product.variants[0] : undefined);
    if (!product || !variant || variant.priceCents <= 0 || variant.availability === "ask") continue;
    const quantity = Math.max(1, Math.min(99, Math.round(Number(line.quantity)) || 1));
    items.push({ variantId: variant.id, quantity, title: product.title, variantTitle: variant.title, priceCents: variant.priceCents });
  }
  return items;
}

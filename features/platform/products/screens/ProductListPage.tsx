import Link from "next/link";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { CountBoxes, StatusText, Td, Th, Tr } from "../../components/cv-ui";
import { QueueListShell, cellLinkClass, monoCellClass } from "../../stock/components/table-kit";
import { loadPlatformList } from "../../lib/list-query";
import { quantityText } from "../../lib/labels";
import type { PlatformSearch } from "../../lib/projection";
import { formatMoney, getPlatformScope, scopeQuery } from "../../lib/scope";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "discontinued", label: "Discontinued" },
  { value: "archived", label: "Archived" },
];

type ProductRow = {
  id: string;
  title: string;
  status: string;
  regulatedSaleType: string;
  minimumAge: number | null;
  preparedFood: boolean;
  categories: Array<{ name: string }>;
  variantsCount: number;
  variants: Array<{ sku: string; defaultPriceCents: number; stockLevels: Array<{ onHandQuantity: string }> }>;
};

/** Catalog-wide counts for the strip, independent of the tab, search and page. */
async function loadCounts(businessId: string | null) {
  if (!businessId) return null;
  const base = { business: { id: { equals: businessId } } };
  const response = await keystoneClient<{ active: number; negative: number; noPrice: number }>(
    `query PlatformProductCounts($active: ProductWhereInput!, $negative: ProductWhereInput!, $noPrice: ProductWhereInput!) {
      active: productsCount(where: $active)
      negative: productsCount(where: $negative)
      noPrice: productsCount(where: $noPrice)
    }`,
    {
      active: { AND: [base, { status: { equals: "active" } }] },
      negative: { AND: [base, { variants: { some: { stockLevels: { some: { onHandQuantity: { lt: "0" } } } } } }] },
      noPrice: { AND: [base, { status: { equals: "active" } }, { variants: { some: { defaultPriceCents: { lte: 0 } } } }] },
    },
  );
  return response.success ? response.data : null;
}

export async function ProductListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const [result, counts] = await Promise.all([loadPlatformList<ProductRow>({
    path: "products",
    search,
    scopeWhere: { business: { id: { equals: scope.businessId ?? "" } } },
    statuses: STATUSES,
    selection: `id title status regulatedSaleType minimumAge preparedFood
      categories(take: 2) { name }
      variantsCount
      variants(take: 12, orderBy: { sku: asc }) { sku defaultPriceCents stockLevels { onHandQuantity } }`,
  }), loadCounts(scope.businessId)]);
  const q = scopeQuery(scope);
  return (
    <QueueListShell
      title="Products"
      scope={scope}
      basePath="/dashboard/platform/products"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "product", plural: "products" }}
      empty="No products"
      queue={
        counts ? (
          <CountBoxes
            items={[
              { label: "Active", value: counts.active },
              { label: "Negative on hand", value: counts.negative, variance: counts.negative ? -1 : null },
              { label: "No price", value: counts.noPrice },
            ]}
          />
        ) : null
      }
      head={
        <>
          <Th priority={2}>SKU</Th>
          <Th>Product</Th>
          <Th priority={3}>Category</Th>
          <Th align="right" priority={3}>
            Variants
          </Th>
          <Th align="right">Price</Th>
          <Th align="right" priority={2}>
            On hand
          </Th>
          <Th>Status</Th>
        </>
      }
    >
      {result.items.map((product) => {
        const prices = product.variants.map((variant) => variant.defaultPriceCents);
        const low = prices.length ? Math.min(...prices) : 0;
        const high = prices.length ? Math.max(...prices) : 0;
        const tracked = product.variants.some((variant) => variant.stockLevels.length);
        const onHand = product.variants.reduce(
          (sum, variant) => sum + variant.stockLevels.reduce((total, level) => total + Number(level.onHandQuantity), 0),
          0,
        );
        const tags = [
          product.regulatedSaleType !== "none" ? `${product.minimumAge ?? ""}+ ${product.regulatedSaleType.replaceAll("_", " ")}` : null,
          product.preparedFood ? "Made in store" : null,
        ].filter(Boolean);
        return (
          <Tr key={product.id}>
            <Td priority={2} className={monoCellClass}>
              {product.variants[0]?.sku ?? "—"}
            </Td>
            <Td className="max-w-[28rem] truncate whitespace-nowrap">
              <Link className={cellLinkClass} href={`/dashboard/platform/products/${product.id}${q}`}>
                {product.title}
              </Link>
              {tags.length ? <span className="ml-2 text-xs text-muted-foreground">{tags.join(" · ")}</span> : null}
            </Td>
            <Td priority={3} className="max-w-[14rem] truncate whitespace-nowrap text-muted-foreground">
              {product.categories.map((category) => category.name).join(", ") || "—"}
            </Td>
            <Td align="right" priority={3} className="text-muted-foreground">
              {product.variantsCount}
            </Td>
            <Td align="right" className="whitespace-nowrap">
              {low === high ? formatMoney(low, scope.currencyCode) : `${formatMoney(low, scope.currencyCode)}–${formatMoney(high, scope.currencyCode)}`}
            </Td>
            <Td align="right" priority={2} className={onHand < 0 ? "font-medium text-[oklch(0.52_0.19_27)] dark:text-red-400" : undefined}>
              {tracked ? quantityText(onHand.toFixed(4)) : "—"}
            </Td>
            <Td>
              <StatusText status={product.status} />
            </Td>
          </Tr>
        );
      })}
    </QueueListShell>
  );
}

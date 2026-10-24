import { ListRow, PlatformListShell } from "../../components/PlatformListShell";
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

export async function ProductListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const result = await loadPlatformList<ProductRow>({
    path: "products",
    search,
    scopeWhere: { business: { id: { equals: scope.businessId ?? "" } } },
    statuses: STATUSES,
    selection: `id title status regulatedSaleType minimumAge preparedFood
      categories(take: 2) { name }
      variantsCount
      variants(take: 12, orderBy: { sku: asc }) { sku defaultPriceCents stockLevels { onHandQuantity } }`,
  });
  return (
    <PlatformListShell
      title="Products"
      scope={scope}
      basePath="/dashboard/platform/products"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "product", plural: "products" }}
      empty="No products"
    >
      {result.items.map((product) => {
        const prices = product.variants.map((variant) => variant.defaultPriceCents);
        const low = prices.length ? Math.min(...prices) : 0;
        const high = prices.length ? Math.max(...prices) : 0;
        const onHand = product.variants.reduce(
          (sum, variant) => sum + variant.stockLevels.reduce((total, level) => total + Number(level.onHandQuantity), 0),
          0,
        );
        return (
          <ListRow
            key={product.id}
            href={`/dashboard/platform/products/${product.id}${scopeQuery(scope)}`}
            title={product.title}
            status={product.status}
            meta={[
              product.categories.map((category) => category.name).join(", ") || "No category",
              `${product.variantsCount} ${product.variantsCount === 1 ? "variant" : "variants"}`,
              product.variants[0]?.sku,
              product.regulatedSaleType !== "none" ? `${product.minimumAge ?? ""}+ ${product.regulatedSaleType.replaceAll("_", " ")}` : null,
              product.preparedFood ? "Made in store" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            figure={low === high ? formatMoney(low, scope.currencyCode) : `${formatMoney(low, scope.currencyCode)} – ${formatMoney(high, scope.currencyCode)}`}
            figureMeta={`${quantityText(onHand.toFixed(4))} on hand`}
          />
        );
      })}
    </PlatformListShell>
  );
}

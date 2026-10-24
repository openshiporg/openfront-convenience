import Link from "next/link";

import { ListRow, PlatformListShell } from "../../components/PlatformListShell";
import { Count, pillClass, trackClass } from "../../components/cv-ui";
import { quantityText } from "../../lib/labels";
import { loadPlatformList } from "../../lib/list-query";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";

type StockRow = {
  id: string;
  onHandQuantity: string;
  reservedQuantity: string;
  reorderPoint: string;
  parQuantity: string;
  lastCountedAt: string | null;
  location: { name: string } | null;
  variant: { title: string; sku: string; unitOfMeasure: string; product: { id: string; title: string } | null } | null;
};

type LotRow = {
  id: string;
  lotNumber: string;
  quantityRemaining: string;
  unitCostCents: number;
  expiresAt: string | null;
  status: string;
  location: { name: string } | null;
  variant: { sku: string; product: { id: string; title: string } | null } | null;
};

const VIEWS = [
  { value: "all", label: "All stock" },
  { value: "low", label: "Low" },
  { value: "lots", label: "Expiring lots" },
];

/**
 * Stock positions with low-stock and expiring-lot views. "Low" compares each
 * position with its own reorder point, which Keystone filters can't express, so
 * that view filters the store's positions after reading them.
 */
export async function StockListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const view = VIEWS.some((entry) => entry.value === searchValue(search, "view")) ? searchValue(search, "view") : "all";
  const storeWhere = { store: { id: { equals: scope.storeId ?? "" } } };
  const soon = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const lots = await loadPlatformList<LotRow>({
    path: "inventory-lots",
    search: view === "lots" ? search : {},
    scopeWhere: { AND: [storeWhere, { status: { equals: "active" } }, { expiresAt: { lte: soon } }] },
    pageSize: view === "lots" ? 25 : 5,
    selection: `id lotNumber quantityRemaining unitCostCents expiresAt status location { name } variant { sku product { id title } }`,
  });
  const stock = await loadPlatformList<StockRow>({
    path: "stock-levels",
    search: view === "lots" ? {} : { ...search, ...(view === "low" ? { pageSize: "100" } : {}) },
    scopeWhere: storeWhere,
    pageSize: view === "low" ? 100 : 25,
    selection: `id onHandQuantity reservedQuantity reorderPoint parQuantity lastCountedAt
      location { name }
      variant { title sku unitOfMeasure product { id title } }`,
  });
  const lowItems = stock.items.filter((row) => Number(row.onHandQuantity) <= Number(row.reorderPoint));
  const result = view === "lots" ? lots : view === "low" ? { ...stock, items: lowItems, count: lowItems.length } : stock;
  const viewHref = (value: string) => `/dashboard/platform/stock${scopeQuery(scope, value === "all" ? {} : { view: value })}`;
  return (
    <PlatformListShell
      title="Stock"
      scope={scope}
      state={lots.count ? { tone: "warn", label: `${lots.count} ${lots.count === 1 ? "lot expires" : "lots expire"} within 14 days` } : undefined}
      basePath="/dashboard/platform/stock"
      search={search}
      result={result as typeof stock}
      entity={view === "lots" ? { singular: "lot", plural: "lots" } : { singular: "stock position", plural: "stock positions" }}
      empty={view === "lots" ? "No lots expire within 14 days" : view === "low" ? "Nothing at or below its reorder point" : "No stock positions"}
      actions={
        <nav aria-label="View" className={trackClass}>
          {VIEWS.map((entry) => (
            <Link key={entry.value} href={viewHref(entry.value)} data-active={view === entry.value} aria-current={view === entry.value ? "page" : undefined} className={pillClass}>
              {entry.label}
              {entry.value === "lots" ? <Count>{lots.count}</Count> : entry.value === "low" ? <Count>{lowItems.length}</Count> : null}
            </Link>
          ))}
        </nav>
      }
    >
      {view === "lots"
        ? lots.items.map((lot) => (
            <ListRow
              key={lot.id}
              href={`/dashboard/platform/products/${lot.variant?.product?.id ?? ""}${scopeQuery(scope)}`}
              title={`${lot.variant?.product?.title ?? "Item"} · lot ${lot.lotNumber}`}
              state={lot.expiresAt && new Date(lot.expiresAt) < new Date() ? { tone: "danger", label: "Expired" } : { tone: "warn", label: "Expiring" }}
              meta={`${lot.location?.name ?? ""} · ${lot.variant?.sku ?? ""} · expires ${formatWhen(lot.expiresAt, scope.timezone)}`}
              figure={quantityText(lot.quantityRemaining)}
              figureMeta={`${formatMoney(lot.unitCostCents, scope.currencyCode)} each`}
            />
          ))
        : (view === "low" ? lowItems : stock.items).map((row) => {
            const low = Number(row.onHandQuantity) <= Number(row.reorderPoint);
            return (
              <ListRow
                key={row.id}
                href={`/dashboard/platform/products/${row.variant?.product?.id ?? ""}${scopeQuery(scope)}`}
                title={`${row.variant?.product?.title ?? "Item"} — ${row.variant?.title ?? ""}`}
                state={low ? { tone: "warn", label: "Low" } : null}
                meta={[
                  row.location?.name,
                  row.variant?.sku,
                  `reorder at ${quantityText(row.reorderPoint)}`,
                  Number(row.reservedQuantity) ? `${quantityText(row.reservedQuantity)} reserved` : null,
                  row.lastCountedAt ? `counted ${formatWhen(row.lastCountedAt, scope.timezone)}` : "never counted",
                ]
                  .filter(Boolean)
                  .join(" · ")}
                figure={`${quantityText(row.onHandQuantity)} ${row.variant?.unitOfMeasure ?? ""}`}
                figureMeta="On hand"
              />
            );
          })}
    </PlatformListShell>
  );
}

import Link from "next/link";

import { Count, DataTable, Td, Th, Tr, pillClass, trackClass } from "../../components/cv-ui";
import { quantityText } from "../../lib/labels";
import { loadPlatformList } from "../../lib/list-query";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";
import {
  EXPIRY_WINDOW_DAYS,
  LOT_SELECTION,
  STOCK_SELECTION,
  StockPositionRow,
  StockPositionsHead,
  StockQueueHead,
  StockQueueRows,
  expiringLotsWhere,
  loadStockQueue,
  lotState,
  stockCondition,
  type LotRow,
  type StockRow,
} from "../components/stock-queue";
import { QueueListShell, QueueSection, StateText, cellLinkClass, monoCellClass } from "../components/table-kit";

const VIEWS = [
  { value: "all", label: "All stock" },
  { value: "low", label: "Needs stock" },
  { value: "lots", label: "Expiring lots" },
];

const QUEUE_LIMIT = 10;

/**
 * Stock positions with a queue (negative, reorder, low, expiring) and views for
 * positions that need stock and expiring lots. Conditions compare each position
 * with its own reorder point and par, which Keystone filters can't express, so
 * the "Needs stock" view filters the store's positions after reading them.
 */
export async function StockListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const view = VIEWS.some((entry) => entry.value === searchValue(search, "view")) ? searchValue(search, "view") : "all";
  const storeWhere = { store: { id: { equals: scope.storeId ?? "" } } };
  const [queue, lots, stock] = await Promise.all([
    loadStockQueue(scope.storeId),
    loadPlatformList<LotRow>({
      path: "inventory-lots",
      search: view === "lots" ? search : {},
      scopeWhere: expiringLotsWhere(scope.storeId),
      pageSize: view === "lots" ? 25 : 5,
      selection: LOT_SELECTION,
    }),
    loadPlatformList<StockRow>({
      path: "stock-levels",
      search: view === "lots" ? {} : { ...search, ...(view === "low" ? { pageSize: "100" } : {}) },
      scopeWhere: storeWhere,
      pageSize: view === "low" ? 100 : 25,
      selection: STOCK_SELECTION,
    }),
  ]);
  const lowItems = stock.items.filter((row) => stockCondition(row) !== "ok");
  const result = view === "lots" ? lots : view === "low" ? { ...stock, items: lowItems, count: lowItems.length } : stock;
  const viewHref = (value: string) => `/dashboard/platform/stock${scopeQuery(scope, value === "all" ? {} : { view: value })}`;
  const queueCount = queue.short.length + queue.expiring.length;
  const state = queue.counts.negative
    ? { tone: "danger" as const, label: `${queue.counts.negative} negative on hand` }
    : lots.count
      ? { tone: "warn" as const, label: `${lots.count} ${lots.count === 1 ? "lot expires" : "lots expire"} within ${EXPIRY_WINDOW_DAYS} days` }
      : undefined;
  return (
    <QueueListShell
      title="Stock"
      scope={scope}
      state={state}
      basePath="/dashboard/platform/stock"
      search={search}
      result={result as typeof stock}
      entity={view === "lots" ? { singular: "lot", plural: "lots" } : { singular: "stock position", plural: "stock positions" }}
      empty={view === "lots" ? `No lots expire within ${EXPIRY_WINDOW_DAYS} days` : view === "low" ? "Every position is OK" : "No stock positions"}
      queue={
        <QueueSection title="Needs you" count={queueCount} empty="Nothing negative, at reorder, low or expiring">
          <DataTable>
            <thead>
              <tr>
                <StockQueueHead />
              </tr>
            </thead>
            <tbody>
              <StockQueueRows short={queue.short} expiring={queue.expiring} scope={scope} timeZone={scope.timezone} limit={QUEUE_LIMIT} />
            </tbody>
          </DataTable>
          {queueCount > QUEUE_LIMIT ? (
            <p className="text-xs text-muted-foreground">
              Showing {QUEUE_LIMIT} of {queueCount}.{" "}
              <Link className="font-medium text-foreground underline underline-offset-2" href={viewHref("low")}>
                Needs stock
              </Link>
              {" · "}
              <Link className="font-medium text-foreground underline underline-offset-2" href={viewHref("lots")}>
                Expiring lots
              </Link>
            </p>
          ) : null}
        </QueueSection>
      }
      head={
        view === "lots" ? (
          <>
            <Th>Lot</Th>
            <Th priority={2}>SKU</Th>
            <Th>Item</Th>
            <Th priority={3}>Location</Th>
            <Th align="right">Remaining</Th>
            <Th align="right" priority={3}>
              Unit cost
            </Th>
            <Th priority={2}>Expires</Th>
            <Th>Status</Th>
          </>
        ) : (
          <StockPositionsHead />
        )
      }
      actions={
        <nav aria-label="View" className={trackClass}>
          {VIEWS.map((entry) => (
            <Link key={entry.value} href={viewHref(entry.value)} data-active={view === entry.value} aria-current={view === entry.value ? "page" : undefined} className={pillClass}>
              {entry.label}
              {entry.value === "lots" ? <Count>{lots.count}</Count> : entry.value === "low" ? <Count>{queue.short.length}</Count> : null}
            </Link>
          ))}
        </nav>
      }
    >
      {view === "lots"
        ? lots.items.map((lot) => (
            <Tr key={lot.id}>
              <Td className={monoCellClass}>{lot.lotNumber}</Td>
              <Td priority={2} className={monoCellClass}>
                {lot.variant?.sku ?? "—"}
              </Td>
              <Td>
                <Link className={cellLinkClass} href={`/dashboard/platform/products/${lot.variant?.product?.id ?? ""}${scopeQuery(scope)}`}>
                  {lot.variant?.product?.title ?? "Item"}
                </Link>
              </Td>
              <Td priority={3} className="text-muted-foreground">
                {lot.location?.name ?? "—"}
              </Td>
              <Td align="right">{quantityText(lot.quantityRemaining)}</Td>
              <Td align="right" priority={3} className="text-muted-foreground">
                {formatMoney(lot.unitCostCents, scope.currencyCode)}
              </Td>
              <Td priority={2} className="whitespace-nowrap text-xs text-muted-foreground">
                {formatWhen(lot.expiresAt, scope.timezone)}
              </Td>
              <Td>
                <StateText {...lotState(lot)} />
              </Td>
            </Tr>
          ))
        : (view === "low" ? lowItems : stock.items).map((row) => (
            <StockPositionRow key={row.id} row={row} scope={scope} timeZone={scope.timezone} />
          ))}
    </QueueListShell>
  );
}

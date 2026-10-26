// One stock vocabulary for Inventory, Stock and the product page:
//   Negative  on hand below zero (danger)
//   Reorder   on hand at or below the reorder point
//   Low       above the reorder point but under par
//   OK        everything else
// Lots add Expired / Expiring. The queue orders negative, then reorder and low,
// then expiring lots.

import Link from "next/link";

import { Td, Th, Tr, type DotTone } from "../../components/cv-ui";
import { quantityText } from "../../lib/labels";
import { loadPlatformList } from "../../lib/list-query";
import { formatWhen, scopeQuery } from "../../lib/scope";
import { StateText, cellLinkClass, monoCellClass } from "./table-kit";

export type StockCondition = "negative" | "reorder" | "low" | "ok";

export const STOCK_CONDITIONS: Record<StockCondition, { label: string; tone: DotTone; rank: number }> = {
  negative: { label: "Negative", tone: "danger", rank: 0 },
  reorder: { label: "Reorder", tone: "warn", rank: 1 },
  low: { label: "Low", tone: "info", rank: 2 },
  ok: { label: "OK", tone: "ok", rank: 3 },
};

export function stockCondition(level: { onHandQuantity: string; reorderPoint: string; parQuantity?: string | null }): StockCondition {
  const onHand = Number(level.onHandQuantity);
  if (onHand < 0) return "negative";
  if (onHand <= Number(level.reorderPoint)) return "reorder";
  if (onHand < Number(level.parQuantity ?? 0)) return "low";
  return "ok";
}

export function StockConditionText({ condition }: { condition: StockCondition }) {
  const entry = STOCK_CONDITIONS[condition];
  return <StateText tone={entry.tone} label={entry.label} />;
}

export type StockRow = {
  id: string;
  onHandQuantity: string;
  reservedQuantity: string;
  reorderPoint: string;
  parQuantity: string;
  lastCountedAt: string | null;
  location: { name: string } | null;
  variant: { title: string; sku: string; unitOfMeasure: string; product: { id: string; title: string } | null } | null;
};

export type LotRow = {
  id: string;
  lotNumber: string;
  quantityRemaining: string;
  unitCostCents: number;
  expiresAt: string | null;
  status: string;
  location: { name: string } | null;
  variant: { sku: string; product: { id: string; title: string } | null } | null;
};

export const STOCK_SELECTION = `id onHandQuantity reservedQuantity reorderPoint parQuantity lastCountedAt
  location { name }
  variant { title sku unitOfMeasure product { id title } }`;

export const LOT_SELECTION = `id lotNumber quantityRemaining unitCostCents expiresAt status location { name } variant { sku product { id title } }`;

export const EXPIRY_WINDOW_DAYS = 14;

export const expiringLotsWhere = (storeId: string | null) => ({
  AND: [
    { store: { id: { equals: storeId ?? "" } } },
    { status: { equals: "active" } },
    { expiresAt: { lte: new Date(Date.now() + EXPIRY_WINDOW_DAYS * 86_400_000).toISOString() } },
  ],
});

export const lotState = (lot: Pick<LotRow, "expiresAt">): { tone: DotTone; label: string } =>
  lot.expiresAt && new Date(lot.expiresAt) < new Date() ? { tone: "danger", label: "Expired" } : { tone: "warn", label: "Expiring" };

const itemName = (row: StockRow) =>
  [row.variant?.product?.title ?? "Item", row.variant?.title].filter(Boolean).join(" — ");

/**
 * Reads the store's stock positions (up to 100) and its lots expiring within the
 * window, the same lists the Stock page reads, and builds the queue from them.
 */
export async function loadStockQueue(storeId: string | null) {
  const [stock, lots] = await Promise.all([
    loadPlatformList<StockRow>({
      path: "stock-levels",
      search: { pageSize: "100" },
      scopeWhere: { store: { id: { equals: storeId ?? "" } } },
      pageSize: 100,
      selection: STOCK_SELECTION,
    }),
    loadPlatformList<LotRow>({
      path: "inventory-lots",
      search: {},
      scopeWhere: expiringLotsWhere(storeId),
      pageSize: 25,
      selection: LOT_SELECTION,
    }),
  ]);
  const short = stock.items
    .map((row) => ({ row, condition: stockCondition(row) }))
    .filter((entry) => entry.condition !== "ok")
    .sort(
      (a, b) =>
        STOCK_CONDITIONS[a.condition].rank - STOCK_CONDITIONS[b.condition].rank ||
        Number(a.row.onHandQuantity) - Number(b.row.onHandQuantity),
    );
  const expiring = [...lots.items].sort(
    (a, b) => new Date(a.expiresAt ?? 0).getTime() - new Date(b.expiresAt ?? 0).getTime(),
  );
  const counts = {
    negative: short.filter((entry) => entry.condition === "negative").length,
    reorder: short.filter((entry) => entry.condition === "reorder").length,
    low: short.filter((entry) => entry.condition === "low").length,
    expiring: lots.count,
  };
  return { stock, lots, short, expiring, counts, error: stock.error ?? lots.error };
}

export function StockQueueHead() {
  return (
    <>
      <Th>SKU</Th>
      <Th>Item</Th>
      <Th priority={3}>Location</Th>
      <Th align="right">On hand</Th>
      <Th align="right" priority={2}>
        Par
      </Th>
      <Th>Status</Th>
    </>
  );
}

/** Queue rows: short positions first, then expiring lots. */
export function StockQueueRows({
  short,
  expiring,
  scope,
  timeZone,
  limit,
}: {
  short: Array<{ row: StockRow; condition: StockCondition }>;
  expiring: LotRow[];
  scope: { businessId: string | null; storeId: string | null };
  timeZone: string | null;
  limit?: number;
}) {
  const q = scopeQuery(scope);
  const rows = [
    ...short.map((entry) => ({ kind: "stock" as const, ...entry })),
    ...expiring.map((lot) => ({ kind: "lot" as const, lot })),
  ].slice(0, limit ?? Infinity);
  return (
    <>
      {rows.map((entry) =>
        entry.kind === "stock" ? (
          <Tr key={`s-${entry.row.id}`}>
            <Td className={monoCellClass}>{entry.row.variant?.sku ?? "—"}</Td>
            <Td className="max-w-[24rem] truncate whitespace-nowrap">
              <Link className={cellLinkClass} href={`/dashboard/platform/products/${entry.row.variant?.product?.id ?? ""}${q}`}>
                {itemName(entry.row)}
              </Link>
            </Td>
            <Td priority={3} className="text-muted-foreground">
              {entry.row.location?.name ?? "—"}
            </Td>
            <Td align="right" className={entry.condition === "negative" ? "font-medium text-[oklch(0.52_0.19_27)] dark:text-red-400" : undefined}>
              {quantityText(entry.row.onHandQuantity)}
            </Td>
            <Td align="right" priority={2} className="text-muted-foreground">
              {Number(entry.row.parQuantity) ? quantityText(entry.row.parQuantity) : "—"}
            </Td>
            <Td>
              <StockConditionText condition={entry.condition} />
            </Td>
          </Tr>
        ) : (
          <Tr key={`l-${entry.lot.id}`}>
            <Td className={monoCellClass}>{entry.lot.variant?.sku ?? "—"}</Td>
            <Td className="max-w-[24rem] truncate whitespace-nowrap">
              <Link className={cellLinkClass} href={`/dashboard/platform/products/${entry.lot.variant?.product?.id ?? ""}${q}`}>
                {entry.lot.variant?.product?.title ?? "Item"}
              </Link>
              <span className="ml-2 font-mono text-xs text-muted-foreground">lot {entry.lot.lotNumber}</span>
            </Td>
            <Td priority={3} className="text-muted-foreground">
              {entry.lot.location?.name ?? "—"}
            </Td>
            <Td align="right">{quantityText(entry.lot.quantityRemaining)}</Td>
            <Td align="right" priority={2} className="text-muted-foreground">
              —
            </Td>
            <Td>
              <span className="inline-flex items-baseline gap-x-1.5 whitespace-nowrap">
                <StateText {...lotState(entry.lot)} />
                <span className="text-xs text-muted-foreground max-sm:hidden">{formatWhen(entry.lot.expiresAt, timeZone)}</span>
              </span>
            </Td>
          </Tr>
        ),
      )}
    </>
  );
}

export function StockPositionsHead() {
  return (
    <>
      <Th>SKU</Th>
      <Th>Item</Th>
      <Th priority={3}>Location</Th>
      <Th align="right">On hand</Th>
      <Th align="right" priority={2}>
        Reorder at
      </Th>
      <Th align="right" priority={2}>
        Par
      </Th>
      <Th priority={3}>Last counted</Th>
      <Th>Status</Th>
    </>
  );
}

export function StockPositionRow({
  row,
  scope,
  timeZone,
}: {
  row: StockRow;
  scope: { businessId: string | null; storeId: string | null };
  timeZone: string | null;
}) {
  const condition = stockCondition(row);
  return (
    <Tr>
      <Td className={monoCellClass}>{row.variant?.sku ?? "—"}</Td>
      <Td className="max-w-[24rem] truncate whitespace-nowrap">
        <Link className={cellLinkClass} href={`/dashboard/platform/products/${row.variant?.product?.id ?? ""}${scopeQuery(scope)}`}>
          {itemName(row)}
        </Link>
        {Number(row.reservedQuantity) ? (
          <span className="ml-2 text-xs text-muted-foreground">{quantityText(row.reservedQuantity)} reserved</span>
        ) : null}
      </Td>
      <Td priority={3} className="text-muted-foreground">
        {row.location?.name ?? "—"}
      </Td>
      <Td align="right" className={condition === "negative" ? "whitespace-nowrap font-medium text-[oklch(0.52_0.19_27)] dark:text-red-400" : "whitespace-nowrap"}>
        {quantityText(row.onHandQuantity)}
        <span className="ml-1 font-sans text-xs text-muted-foreground">{row.variant?.unitOfMeasure ?? ""}</span>
      </Td>
      <Td align="right" priority={2} className="text-muted-foreground">
        {quantityText(row.reorderPoint)}
      </Td>
      <Td align="right" priority={2} className="text-muted-foreground">
        {Number(row.parQuantity) ? quantityText(row.parQuantity) : "—"}
      </Td>
      <Td priority={3} className="whitespace-nowrap text-xs text-muted-foreground">
        {row.lastCountedAt ? formatWhen(row.lastCountedAt, timeZone) : "Never"}
      </Td>
      <Td>
        <StockConditionText condition={condition} />
      </Td>
    </Tr>
  );
}

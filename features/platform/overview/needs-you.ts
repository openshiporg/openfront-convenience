import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import type { DotTone } from "../components/cv-ui";
import { shortRef } from "../lib/labels";
import { employeeName, type EmployeeRef } from "../lib/people";
import type { PlatformProjection } from "../lib/projection";
import { formatMoney, formatWhen } from "../lib/scope";

/** One thing waiting on the manager tonight, with where to go to deal with it. */
export type QueueItem = {
  key: string;
  rank: number;
  tone: DotTone;
  state: string;
  title: string;
  reference?: string;
  detail: string;
  figure?: string;
  figureTone?: "short" | "plain";
  href: string;
  area: string;
};

type Scope = Pick<PlatformProjection, "businessId" | "storeId" | "timezone" | "currencyCode" | "rows">;

type Session = {
  id: string;
  sessionNumber: string;
  status: string;
  overShortCents: number | null;
  expectedCashCents: number;
  openedAt: string | null;
  closedAt: string | null;
  register: { name: string } | null;
  employee: EmployeeRef;
};

type Alert = {
  id: string;
  alertNumber: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  detectedAt: string | null;
};

type Level = {
  id: string;
  onHandQuantity: string;
  reorderPoint: string;
  variant: { title: string; sku: string; product: { id: string; title: string } | null } | null;
};

type FuelTxn = {
  id: string;
  transactionNumber: string;
  status: string;
  totalCents: number | null;
  authorizedCents: number | null;
  requestedAt: string | null;
  pump: { pumpNumber: string } | null;
};

type Pack = {
  id: string;
  packNumber: string;
  status: string;
  varianceCents: number | null;
  closedAt: string | null;
  game: { name: string } | null;
};

type Settlement = {
  id: string;
  settlementNumber: string;
  status: string;
  tradingDate: string;
  varianceCents: number | null;
};

const SEVERITY_RANK: Record<string, number> = { critical: 1, warning: 4, info: 8 };

/** Each source is read on its own, so one the signed-in person can't see simply drops out. */
async function read<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await keystoneClient<T>(query, variables);
    return response.success ? response.data : null;
  } catch {
    return null;
  }
}

function variantName(level: Level): string {
  const product = level.variant?.product?.title?.trim();
  const title = level.variant?.title?.trim() ?? "";
  if (!product) return title || "Item";
  if (!title || title.toLowerCase() === product.toLowerCase()) return product;
  return `${product} — ${title}`;
}

/**
 * What needs the manager tonight, most severe first: short drawers, critical
 * exceptions, negative stock, days not closed, unconfirmed fuel dispenses, lottery
 * packs to settle, then warnings and low stock.
 */
export async function loadNeedsYou(scope: Scope, q: string): Promise<QueueItem[]> {
  const { businessId, storeId, timezone } = scope;
  if (!businessId || !storeId) return [];
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, scope.currencyCode);
  const store = { store: { id: { equals: storeId } } };
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const staleOpen = Date.now() - 12 * 3600 * 1000;
  const link = (path: string) => `/dashboard/platform/${path}${q}`;

  const [sessions, alerts, negative, levels, fuel, packs, settlements] = await Promise.all([
    read<{ registerSessions: Session[] }>(
      `query NeedsYouDrawers($where: RegisterSessionWhereInput!) {
        registerSessions(where: $where, orderBy: { openedAt: asc }, take: 30) {
          id sessionNumber status overShortCents expectedCashCents openedAt closedAt
          register { name } employee { employeeNumber user { name } }
        }
      }`,
      {
        where: {
          AND: [
            store,
            {
              OR: [
                { status: { in: ["open", "closing", "suspended"] } },
                { AND: [{ status: { equals: "closed" } }, { closedAt: { gte: since } }, { NOT: [{ overShortCents: { equals: 0 } }] }] },
              ],
            },
          ],
        },
      },
    ),
    read<{ operationalAlerts: Alert[] }>(
      `query NeedsYouAlerts($where: OperationalAlertWhereInput!) {
        operationalAlerts(where: $where, orderBy: { detectedAt: asc }, take: 40) {
          id alertNumber title message severity status detectedAt
        }
      }`,
      {
        where: {
          business: { id: { equals: businessId } },
          status: { in: ["open", "acknowledged"] },
          OR: [{ store: { id: { equals: storeId } } }, { store: null }],
        },
      },
    ),
    read<{ stockLevels: Level[]; stockLevelsCount: number }>(
      `query NeedsYouNegative($where: StockLevelWhereInput!) {
        stockLevels(where: $where, orderBy: { onHandQuantity: asc }, take: 5) {
          id onHandQuantity reorderPoint variant { title sku product { id title } }
        }
        stockLevelsCount(where: $where)
      }`,
      { where: { ...store, onHandQuantity: { lt: "0" } } },
    ),
    read<{ stockLevels: Level[] }>(
      `query NeedsYouLow($where: StockLevelWhereInput!) {
        stockLevels(where: $where, orderBy: { onHandQuantity: asc }, take: 200) {
          id onHandQuantity reorderPoint variant { title sku product { id title } }
        }
      }`,
      { where: { ...store, reorderPoint: { gt: "0" }, onHandQuantity: { gte: "0" } } },
    ),
    read<{ fuelTransactions: FuelTxn[] }>(
      `query NeedsYouFuel($where: FuelTransactionWhereInput!) {
        fuelTransactions(where: $where, orderBy: { requestedAt: asc }, take: 20) {
          id transactionNumber status totalCents authorizedCents requestedAt pump { pumpNumber }
        }
      }`,
      { where: { ...store, status: { in: ["requested", "authorized", "dispensing", "stopped"] } } },
    ),
    read<{ lotteryPacks: Pack[] }>(
      `query NeedsYouPacks($where: LotteryPackWhereInput!) {
        lotteryPacks(where: $where, orderBy: { closedAt: asc }, take: 20) {
          id packNumber status varianceCents closedAt game { name }
        }
      }`,
      { where: { ...store, status: { equals: "closed" } } },
    ),
    read<{ lotterySettlements: Settlement[] }>(
      `query NeedsYouSettlements($where: LotterySettlementWhereInput!) {
        lotterySettlements(where: $where, orderBy: { tradingDate: asc }, take: 10) {
          id settlementNumber status tradingDate varianceCents
        }
      }`,
      { where: { ...store, status: { in: ["in_review", "disputed"] } } },
    ),
  ]);

  const items: QueueItem[] = [];

  for (const session of sessions?.registerSessions ?? []) {
    const name = session.register?.name ?? "Till";
    const who = employeeName(session.employee);
    const variance = session.overShortCents ?? 0;
    if (session.status === "closed") {
      if (!variance) continue;
      items.push({
        key: `till-${session.id}`,
        rank: variance < 0 ? 0 : 5,
        tone: variance < 0 ? "danger" : "warn",
        state: variance < 0 ? "Short" : "Over",
        title: `${name} drawer`,
        reference: shortRef(session.sessionNumber),
        detail: `${who} · closed ${formatWhen(session.closedAt, timezone)}`,
        figure: `${variance < 0 ? "−" : "+"}${money(Math.abs(variance))}`,
        figureTone: variance < 0 ? "short" : "plain",
        href: link(`tills/${session.id}`),
        area: "Tills",
      });
      continue;
    }
    const opened = session.openedAt ? new Date(session.openedAt).getTime() : Date.now();
    const stale = opened < staleOpen;
    if (session.status === "open" && !stale) continue;
    items.push({
      key: `till-${session.id}`,
      rank: session.status === "closing" ? 3 : stale ? 4 : 6,
      tone: "warn",
      state: session.status === "closing" ? "Counting" : session.status === "suspended" ? "Suspended" : "Open 12h+",
      title: `${name} drawer`,
      reference: shortRef(session.sessionNumber),
      detail: `${who} · opened ${formatWhen(session.openedAt, timezone)}`,
      figure: money(session.expectedCashCents),
      href: link(`tills/${session.id}`),
      area: "Tills",
    });
  }

  for (const alert of alerts?.operationalAlerts ?? []) {
    const severity = alert.severity || "info";
    items.push({
      key: `alert-${alert.id}`,
      rank: (SEVERITY_RANK[severity] ?? 8) + (alert.status === "acknowledged" ? 1 : 0),
      tone: severity === "critical" ? "danger" : severity === "warning" ? "warn" : "info",
      state: `${severity[0].toUpperCase()}${severity.slice(1)}${alert.status === "acknowledged" ? ", acknowledged" : ""}`,
      title: alert.title || "Exception",
      reference: alert.alertNumber,
      detail: alert.message || formatWhen(alert.detectedAt, timezone),
      href: link("exceptions"),
      area: "Exceptions",
    });
  }

  const negativeCount = negative?.stockLevelsCount ?? 0;
  for (const level of negative?.stockLevels ?? []) {
    items.push({
      key: `neg-${level.id}`,
      rank: 2,
      tone: "danger",
      state: "Negative",
      title: variantName(level),
      reference: level.variant?.sku || undefined,
      detail: "On hand below zero",
      figure: String(Number(level.onHandQuantity)),
      figureTone: "short",
      href: level.variant?.product ? link(`products/${level.variant.product.id}`) : link("stock"),
      area: "Stock",
    });
  }
  if (negativeCount > 5) {
    items.push({
      key: "neg-more",
      rank: 2,
      tone: "danger",
      state: "Negative",
      title: `${negativeCount - 5} more items below zero`,
      detail: "On hand below zero",
      href: link("stock"),
      area: "Stock",
    });
  }

  const low = (levels?.stockLevels ?? []).filter((level) => Number(level.onHandQuantity) <= Number(level.reorderPoint));
  if (low.length) {
    items.push({
      key: "low-stock",
      rank: 7,
      tone: "warn",
      state: "Low",
      title: `${low.length}${low.length === 200 ? "+" : ""} ${low.length === 1 ? "item" : "items"} at or below reorder point`,
      detail: low
        .slice(0, 3)
        .map((level) => variantName(level))
        .join(", "),
      href: link("stock"),
      area: "Stock",
    });
  }

  for (const day of scope.rows) {
    if (!["draft", "in_review", "reopened", "out_of_date"].includes(day.status)) continue;
    items.push({
      key: `day-${day.id}`,
      rank: day.status === "out_of_date" || day.status === "reopened" ? 2 : 3,
      tone: day.status === "draft" ? "warn" : day.status === "in_review" ? "warn" : "danger",
      state: day.status === "in_review" ? "Not closed" : day.status === "draft" ? "Draft" : day.status === "reopened" ? "Reopened" : "Out of date",
      title: `Day ${day.title}`,
      detail: day.detail,
      figure: day.metric ? day.metric.replace(/\s*net$/, "") : undefined,
      href: link("reconciliation"),
      area: "Close the day",
    });
  }

  for (const txn of fuel?.fuelTransactions ?? []) {
    items.push({
      key: `fuel-${txn.id}`,
      rank: txn.status === "stopped" ? 3 : 4,
      tone: "warn",
      state: txn.status === "stopped" ? "Stopped" : "Unconfirmed",
      title: txn.pump?.pumpNumber ? `Pump ${txn.pump.pumpNumber} dispense` : "Fuel dispense",
      reference: shortRef(txn.transactionNumber),
      detail: `${txn.status[0].toUpperCase()}${txn.status.slice(1)} · ${formatWhen(txn.requestedAt, timezone)}`,
      figure: money(txn.totalCents || txn.authorizedCents),
      href: link("fuel"),
      area: "Fuel",
    });
  }

  for (const pack of packs?.lotteryPacks ?? []) {
    const variance = pack.varianceCents ?? 0;
    items.push({
      key: `pack-${pack.id}`,
      rank: variance < 0 ? 2 : 5,
      tone: variance < 0 ? "danger" : "warn",
      state: variance < 0 ? "Short" : "To settle",
      title: `${pack.game?.name ?? "Lottery"} pack`,
      reference: pack.packNumber,
      detail: `Closed ${formatWhen(pack.closedAt, timezone)}`,
      figure: variance ? `${variance < 0 ? "−" : "+"}${money(Math.abs(variance))}` : undefined,
      figureTone: variance < 0 ? "short" : "plain",
      href: link("lottery"),
      area: "Lottery",
    });
  }

  for (const settlement of settlements?.lotterySettlements ?? []) {
    const variance = settlement.varianceCents ?? 0;
    items.push({
      key: `settle-${settlement.id}`,
      rank: settlement.status === "disputed" ? 2 : 5,
      tone: settlement.status === "disputed" ? "danger" : "warn",
      state: settlement.status === "disputed" ? "Disputed" : "In review",
      title: `Lottery settlement ${settlement.tradingDate}`,
      reference: settlement.settlementNumber,
      detail: "Settlement awaiting approval",
      figure: variance ? `${variance < 0 ? "−" : "+"}${money(Math.abs(variance))}` : undefined,
      figureTone: variance < 0 ? "short" : "plain",
      href: link("lottery"),
      area: "Lottery",
    });
  }

  // Stable: within a rank the sources keep their oldest-first order.
  return items.map((item, index) => ({ item, index })).sort((a, b) => a.item.rank - b.item.rank || a.index - b.index).map(({ item }) => item);
}

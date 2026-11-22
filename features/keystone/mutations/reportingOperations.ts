import type { Context } from ".keystone/types";

import {
  assertBusinessPermission,
  assertStorePermission,
  hasUnrestrictedStoreAccess,
  storeIdsForPermission,
  type Session,
} from "../access";
import { normalizeTradingDate, tradingDatePeriodBounds } from "../lib/reconciliation";
import { summarizeStoreDays } from "../lib/reporting";
import { requireSession } from "./operationRunner";

const serializedTotalKeys = [
  "grossSalesCents",
  "discountCents",
  "taxCents",
  "totalSalesCents",
  "refundCents",
  "netReceiptsCents",
  "cashTenderCents",
  "nonCashTenderCents",
  "fuelSalesCents",
  "lotteryNetCents",
  "moneyServiceNetCents",
  "cashOverShortCents",
  "depositedCashCents",
  "saleCount",
  "refundCount",
  "exceptionCount",
] as const;

function serializeTotals<T extends Record<string, unknown>>(totals: T) {
  return Object.fromEntries(Object.entries(totals).map(([key, value]) => [
    key,
    serializedTotalKeys.includes(key as (typeof serializedTotalKeys)[number]) ? String(value) : value,
  ]));
}

export async function convenienceReportingSummary(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      startDate: string;
      endDate: string;
      storeIds?: string[] | null;
      currencyCode?: string | null;
    };
  },
  context: Context,
) {
  const session = requireSession(context) as Session;
  assertBusinessPermission(session, args.input.businessId, "canReadReporting");

  const currencyCode = args.input.currencyCode?.trim().toUpperCase() || null;
  if (currencyCode && !/^[A-Z]{3}$/.test(currencyCode)) {
    throw new Error("Reporting currency must be a three-letter code");
  }
  const startDate = normalizeTradingDate(args.input.startDate);
  const endDate = normalizeTradingDate(args.input.endDate);
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  if (end < start) throw new Error("Reporting end date must not precede start date");
  if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) {
    throw new Error("Reporting date range cannot exceed 366 days");
  }

  const requestedStoreIds = [...new Set(args.input.storeIds?.filter(Boolean) ?? [])].sort();
  for (const storeId of requestedStoreIds) {
    assertStorePermission(session, args.input.businessId, storeId, "canReadReporting");
  }
  const unrestrictedStores = hasUnrestrictedStoreAccess(session);
  const storeIds = requestedStoreIds.length
    ? requestedStoreIds
    : unrestrictedStores
      ? []
      : storeIdsForPermission(session, "canReadReporting", args.input.businessId);
  if (!unrestrictedStores && !storeIds.length) throw new Error("Access denied for reporting stores");
  if (storeIds.length) {
    const matchedStores = await context.prisma.store.count({
      where: { businessId: args.input.businessId, id: { in: storeIds } },
    });
    if (matchedStores !== storeIds.length) {
      throw new Error("One or more reporting stores do not belong to this business");
    }
  }

  const [business, days] = await Promise.all([
    context.prisma.business.findUnique({
      where: { id: args.input.businessId },
      select: { defaultCurrencyCode: true },
    }),
    context.prisma.storeDay.findMany({
      where: {
        businessId: args.input.businessId,
        tradingDate: { gte: startDate, lte: endDate },
        status: { in: ["reconciled", "locked"] },
        ...(storeIds.length ? { storeId: { in: storeIds } } : {}),
        ...(currencyCode ? { currencyCode } : {}),
      },
    include: { store: { select: { id: true, name: true } } },
      orderBy: [{ tradingDate: "asc" }, { storeId: "asc" }],
      take: 10_001,
    }),
  ]);
  if (!business) throw new Error("Reporting business no longer exists");
  const currencies = new Set(days.map((day) => day.currencyCode));
  if (!currencyCode && currencies.size > 1) {
    throw new Error("Reporting spans multiple currencies; select one currency before consolidating amounts");
  }
  const resolvedCurrencyCode = currencyCode ?? [...currencies][0] ?? business.defaultCurrencyCode;
  if (days.length > 10_000) {
    throw new Error("Reporting result exceeds 10,000 store days; narrow the date or store scope");
  }

  const summary = summarizeStoreDays(days.map((day) => {
    if (!day.store) throw new Error("A reconciled store day is missing its store");
    return {
      storeId: day.store.id,
      storeName: day.store.name,
      grossSalesCents: day.grossSalesCents,
      discountCents: day.discountCents,
      taxCents: day.taxCents,
      totalSalesCents: day.totalSalesCents,
      refundCents: day.refundCents,
      netReceiptsCents: day.netReceiptsCents,
      cashTenderCents: day.cashTenderCents,
      nonCashTenderCents: day.nonCashTenderCents,
      fuelSalesCents: day.fuelSalesCents,
      lotteryNetCents: day.lotteryNetCents,
      moneyServiceNetCents: day.moneyServiceNetCents,
      cashOverShortCents: day.cashOverShortCents,
      depositedCashCents: day.depositedCashCents,
      saleCount: day.saleCount,
      refundCount: day.refundCount,
      exceptionCount: day.exceptionCount,
    };
  }));

  return {
    businessId: args.input.businessId,
    startDate,
    endDate,
    currencyCode: resolvedCurrencyCode,
    ...serializeTotals(summary),
    stores: summary.stores.map(serializeTotals),
  };
}


const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", credit_card: "Card", debit_card: "Debit card", mobile_wallet: "Mobile wallet", gift_card: "Gift card",
  ebt_snap: "EBT / SNAP", fleet_card: "Fleet card", house_account: "House account", loyalty: "Points", other: "Other",
};

/**
 * What sold, read straight from the sales in the period (store-local days), so the
 * owner sees today's numbers before the day is closed. Money is before tax and after
 * discounts, the way a department report reads at the incumbents.
 */
export async function convenienceSalesReport(
  _root: unknown,
  args: { input: { businessId: string; startDate: string; endDate: string; storeIds?: string[] | null } },
  context: Context,
) {
  const session = requireSession(context) as Session;
  assertBusinessPermission(session, args.input.businessId, "canReadReporting");
  const startDate = normalizeTradingDate(args.input.startDate);
  const endDate = normalizeTradingDate(args.input.endDate);
  if (endDate < startDate) throw new Error("Reporting end date must not precede start date");
  if (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`) > 366 * 86_400_000) {
    throw new Error("Reporting date range cannot exceed 366 days");
  }
  const requested = [...new Set(args.input.storeIds?.filter(Boolean) ?? [])];
  for (const storeId of requested) assertStorePermission(session, args.input.businessId, storeId, "canReadReporting");
  const allowed = requested.length
    ? requested
    : hasUnrestrictedStoreAccess(session)
      ? null
      : storeIdsForPermission(session, "canReadReporting", args.input.businessId);
  if (allowed && !allowed.length) throw new Error("Access denied for reporting stores");
  const stores = await context.prisma.store.findMany({
    where: { businessId: args.input.businessId, ...(allowed ? { id: { in: allowed } } : {}) },
    select: { id: true, timezone: true, currencyCode: true },
    take: 500,
  });
  const periods = stores.map((store) => ({
    storeId: store.id,
    from: tradingDatePeriodBounds(startDate, store.timezone || "UTC").periodStartedAt,
    to: tradingDatePeriodBounds(endDate, store.timezone || "UTC").periodEndedAt,
  }));
  const inPeriod = (field: "completedAt" | "processedAt") => periods.map((period) => ({ storeId: period.storeId, [field]: { gte: period.from, lt: period.to } }));
  if (!periods.length) {
    return { startDate, endDate, currencyCode: "USD", saleCount: 0, itemSalesCents: 0, taxCents: 0, totalCents: 0, refundCents: 0, refundCount: 0, units: 0, truncated: false, categories: [], items: [], tenders: [], sources: [] };
  }
  const LIMIT = 20_000;
  const counted = { status: { in: ["completed", "partially_refunded", "refunded"] as ("completed" | "partially_refunded" | "refunded")[] } };
  const [sales, lines, tenders, refunds] = await Promise.all([
    context.prisma.sale.findMany({
      where: { businessId: args.input.businessId, ...counted, OR: inPeriod("completedAt") },
      select: { source: true, totalCents: true, taxCents: true },
      take: LIMIT,
    }),
    context.prisma.saleLine.findMany({
      where: { businessId: args.input.businessId, sale: { ...counted, OR: inPeriod("completedAt") } },
      select: {
        titleSnapshot: true, variantTitleSnapshot: true, quantity: true, subtotalCents: true, discountCents: true, taxCents: true, totalCents: true, taxInclusive: true,
        variantId: true, product: { select: { categories: { select: { name: true }, orderBy: { name: "asc" }, take: 1 } } },
      },
      take: LIMIT,
    }),
    context.prisma.tender.findMany({
      where: { businessId: args.input.businessId, status: { in: ["captured", "partially_refunded", "refunded"] }, sale: { ...counted, OR: inPeriod("completedAt") } },
      select: { method: true, amountCents: true, changeCents: true },
      take: LIMIT,
    }),
    context.prisma.refund.findMany({
      where: { businessId: args.input.businessId, status: "completed", OR: inPeriod("processedAt") },
      select: { amountCents: true },
      take: LIMIT,
    }),
  ]);
  const bump = <T extends { units: number; salesCents: number }>(map: Map<string, T>, key: string, start: T, units: number, cents: number) => {
    const row = map.get(key) ?? start;
    row.units += units; row.salesCents += cents; map.set(key, row);
  };
  const categories = new Map<string, { name: string; units: number; salesCents: number }>();
  const items = new Map<string, { name: string; detail: string; units: number; salesCents: number }>();
  let itemSalesCents = 0; let units = 0;
  for (const line of lines) {
    // Before tax, after discount: a tax-inclusive line carries its tax inside the total.
    const net = line.taxInclusive ? line.totalCents - line.taxCents : line.subtotalCents - line.discountCents;
    const quantity = Number(line.quantity);
    itemSalesCents += net; units += quantity;
    const category = line.product?.categories[0]?.name || "Uncategorized";
    bump(categories, category, { name: category, units: 0, salesCents: 0 }, quantity, net);
    bump(items, line.variantId ?? `${line.titleSnapshot}|${line.variantTitleSnapshot}`, { name: line.titleSnapshot, detail: line.variantTitleSnapshot ?? "", units: 0, salesCents: 0 }, quantity, net);
  }
  const byMethod = new Map<string, { method: string; label: string; count: number; amountCents: number }>();
  for (const tender of tenders) {
    const row = byMethod.get(tender.method) ?? { method: tender.method, label: METHOD_LABELS[tender.method] ?? tender.method, count: 0, amountCents: 0 };
    row.count += 1; row.amountCents += tender.amountCents - (tender.changeCents ?? 0); byMethod.set(tender.method, row);
  }
  const bySource = new Map<string, { source: string; label: string; count: number; totalCents: number }>();
  for (const sale of sales) {
    const online = sale.source === "storefront" || sale.source === "mobile";
    const key = online ? "online" : "counter";
    const row = bySource.get(key) ?? { source: key, label: online ? "Online pickup" : "At the counter", count: 0, totalCents: 0 };
    row.count += 1; row.totalCents += sale.totalCents; bySource.set(key, row);
  }
  const round = (value: number) => Math.round(value * 10_000) / 10_000;
  const bySales = <T extends { salesCents: number }>(left: T, right: T) => right.salesCents - left.salesCents;
  return {
    startDate,
    endDate,
    currencyCode: stores[0]?.currencyCode || "USD",
    saleCount: sales.length,
    itemSalesCents,
    taxCents: sales.reduce((total, sale) => total + sale.taxCents, 0),
    totalCents: sales.reduce((total, sale) => total + sale.totalCents, 0),
    refundCents: refunds.reduce((total, refund) => total + refund.amountCents, 0),
    refundCount: refunds.length,
    units: round(units),
    truncated: [sales, lines, tenders, refunds].some((rows) => rows.length >= LIMIT),
    categories: [...categories.values()].sort(bySales).map((row) => ({ ...row, units: round(row.units) })),
    items: [...items.values()].sort(bySales).slice(0, 25).map((row) => ({ ...row, units: round(row.units) })),
    tenders: [...byMethod.values()].sort((left, right) => right.amountCents - left.amountCents),
    sources: [...bySource.values()].sort((left, right) => right.totalCents - left.totalCents),
  };
}

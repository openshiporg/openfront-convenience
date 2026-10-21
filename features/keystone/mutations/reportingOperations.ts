import type { Context } from ".keystone/types";

import {
  assertBusinessPermission,
  assertStorePermission,
  hasUnrestrictedStoreAccess,
  storeIdsForPermission,
  type Session,
} from "../access";
import { normalizeTradingDate } from "../lib/reconciliation";
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

export type StoreDayReportingRow = {
  storeId: string;
  storeName: string;
  grossSalesCents: number;
  discountCents: number;
  taxCents: number;
  totalSalesCents: number;
  refundCents: number;
  netReceiptsCents: number;
  cashTenderCents: number;
  nonCashTenderCents: number;
  fuelSalesCents: number;
  lotteryNetCents: number;
  moneyServiceNetCents: number;
  cashOverShortCents: number;
  depositedCashCents: number;
  saleCount: number;
  refundCount: number;
  exceptionCount: number;
};

type ReportingTotals = Omit<StoreDayReportingRow, "storeId" | "storeName"> & {
  dayCount: number;
};

const totalKeys = [
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

function emptyTotals(): ReportingTotals {
  return {
    dayCount: 0,
    grossSalesCents: 0,
    discountCents: 0,
    taxCents: 0,
    totalSalesCents: 0,
    refundCents: 0,
    netReceiptsCents: 0,
    cashTenderCents: 0,
    nonCashTenderCents: 0,
    fuelSalesCents: 0,
    lotteryNetCents: 0,
    moneyServiceNetCents: 0,
    cashOverShortCents: 0,
    depositedCashCents: 0,
    saleCount: 0,
    refundCount: 0,
    exceptionCount: 0,
  };
}

function addRow(totals: ReportingTotals, row: StoreDayReportingRow): void {
  totals.dayCount += 1;
  for (const key of totalKeys) {
    if (!Number.isSafeInteger(row[key])) throw new Error(`${key} must be a safe integer`);
    totals[key] += row[key];
    if (!Number.isSafeInteger(totals[key])) {
      throw new Error(`${key} total exceeds safe integer range`);
    }
  }
}

export function summarizeStoreDays(rows: StoreDayReportingRow[]) {
  const business = emptyTotals();
  const stores = new Map<string, ReportingTotals & { storeId: string; storeName: string }>();

  for (const row of rows) {
    addRow(business, row);
    const store = stores.get(row.storeId) ?? {
      storeId: row.storeId,
      storeName: row.storeName,
      ...emptyTotals(),
    };
    addRow(store, row);
    stores.set(row.storeId, store);
  }

  return {
    ...business,
    stores: [...stores.values()].sort((left, right) =>
      left.storeName.localeCompare(right.storeName) || left.storeId.localeCompare(right.storeId)),
  };
}

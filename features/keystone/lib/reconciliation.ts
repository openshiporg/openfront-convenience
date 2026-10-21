import { addQuantities, normalizeQuantity } from "./quantity";

type SaleAmounts = {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
};

type RefundAmount = {
  amountCents: number;
  taxCents?: number;
  tenderMethod?: string;
};
type TenderAmount = {
  method: string;
  amountCents: number;
  refundedCents?: number;
};
type RegisterSessionAmounts = {
  openingCashCents: number;
  expectedCashCents: number;
  countedCashCents: number | null;
};
type DepositAmount = { amountCents: number };

function assertSafeCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function sumCents(values: number[], label: string): number {
  let total = 0;
  for (const value of values) {
    assertSafeCents(value, label);
    total += value;
    if (!Number.isSafeInteger(total))
      throw new Error(`${label} total exceeds safe integer range`);
  }
  return total;
}

export function normalizeTradingDate(value: string): string {
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error("Trading date must use YYYY-MM-DD format");
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error("Trading date must be a valid calendar date");
  }
  return normalized;
}

export function tradingDateAtInstant(instant: Date, timezone: string): string {
  if (!Number.isFinite(instant.getTime()))
    throw new Error("Trading-date instant must be valid");
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(instant);
  } catch {
    throw new Error("Store timezone must be a valid IANA timezone");
  }
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const result = `${value("year")}-${value("month")}-${value("day")}`;
  return normalizeTradingDate(result);
}

function nextTradingDate(tradingDate: string): string {
  const date = new Date(`${normalizeTradingDate(tradingDate)}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function firstInstantOfTradingDate(
  tradingDate: string,
  timezone: string,
): Date {
  const normalized = normalizeTradingDate(tradingDate);
  const anchor = Date.parse(`${normalized}T00:00:00.000Z`);
  let low = anchor - 36 * 60 * 60 * 1000;
  let high = anchor + 36 * 60 * 60 * 1000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (tradingDateAtInstant(new Date(middle), timezone) < normalized) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  const result = new Date(low);
  if (tradingDateAtInstant(result, timezone) !== normalized) {
    throw new Error(
      `Trading date ${normalized} does not exist in store timezone ${timezone}`,
    );
  }
  return result;
}

export function tradingDatePeriodBounds(
  tradingDate: string,
  timezone: string,
): { periodStartedAt: Date; periodEndedAt: Date } {
  const normalized = normalizeTradingDate(tradingDate);
  return {
    periodStartedAt: firstInstantOfTradingDate(normalized, timezone),
    periodEndedAt: firstInstantOfTradingDate(
      nextTradingDate(normalized),
      timezone,
    ),
  };
}

export function assertTradingDateMatchesPeriodStart(
  tradingDate: string,
  periodStartedAt: Date,
  timezone: string,
  label: string,
): void {
  const expected = tradingDateAtInstant(periodStartedAt, timezone);
  if (tradingDate !== expected) {
    throw new Error(
      `${label} trading date must match the period start in the store timezone (${expected})`,
    );
  }
}

export function assertPeriodWithinTradingDate(
  tradingDate: string,
  periodStartedAt: Date,
  periodEndedAt: Date,
  timezone: string,
  label: string,
): void {
  assertTradingDateMatchesPeriodStart(
    tradingDate,
    periodStartedAt,
    timezone,
    label,
  );
  if (periodEndedAt <= periodStartedAt)
    throw new Error(`${label} period must be positive`);
  const finalIncludedInstant = new Date(periodEndedAt.getTime() - 1);
  const endingTradingDate = tradingDateAtInstant(
    finalIncludedInstant,
    timezone,
  );
  if (endingTradingDate !== tradingDate) {
    throw new Error(
      `${label} period must remain within one store trading date`,
    );
  }
}

export function calculateStoreDayTotals({
  sales,
  refunds,
  tenders,
  registerSessions,
  deposits,
}: {
  sales: SaleAmounts[];
  refunds: RefundAmount[];
  tenders: TenderAmount[];
  registerSessions: RegisterSessionAmounts[];
  deposits: DepositAmount[];
}) {
  const grossSalesCents = sumCents(
    sales.map((sale) => sale.subtotalCents),
    "Gross sales",
  );
  const discountCents = sumCents(
    sales.map((sale) => sale.discountCents),
    "Discount",
  );
  const saleTaxCents = sumCents(
    sales.map((sale) => sale.taxCents),
    "Tax",
  );
  const refundTaxCents = sumCents(
    refunds.map((refund) => refund.taxCents ?? 0),
    "Refund tax",
  );
  const taxCents = saleTaxCents - refundTaxCents;
  const totalSalesCents = sumCents(
    sales.map((sale) => sale.totalCents),
    "Total sales",
  );
  const refundCents = sumCents(
    refunds.map((refund) => refund.amountCents),
    "Refund",
  );
  const openingCashCents = sumCents(
    registerSessions.map((session) => session.openingCashCents),
    "Opening cash",
  );
  const expectedCashCents = sumCents(
    registerSessions.map((session) => session.expectedCashCents),
    "Expected cash",
  );
  const countedCashCents = sumCents(
    registerSessions.map((session) => session.countedCashCents ?? 0),
    "Counted cash",
  );
  const depositedCashCents = sumCents(
    deposits.map((deposit) => deposit.amountCents),
    "Deposited cash",
  );

  let cashTenderCents = 0;
  let nonCashTenderCents = 0;
  for (const tender of tenders) {
    assertSafeCents(tender.amountCents, "Tender amount");
    assertSafeCents(tender.refundedCents ?? 0, "Tender refund");
    const net = tender.amountCents - (tender.refundedCents ?? 0);
    if (tender.method === "cash") cashTenderCents += net;
    else nonCashTenderCents += net;
  }
  for (const refund of refunds) {
    if (!refund.tenderMethod) continue;
    if (refund.tenderMethod === "cash") cashTenderCents -= refund.amountCents;
    else nonCashTenderCents -= refund.amountCents;
  }
  if (
    !Number.isSafeInteger(cashTenderCents) ||
    !Number.isSafeInteger(nonCashTenderCents)
  ) {
    throw new Error("Tender flow total exceeds safe integer range");
  }

  return {
    grossSalesCents,
    discountCents,
    taxCents,
    totalSalesCents,
    refundCents,
    netReceiptsCents: totalSalesCents - refundCents,
    cashTenderCents,
    nonCashTenderCents,
    openingCashCents,
    expectedCashCents,
    countedCashCents,
    cashOverShortCents: countedCashCents - expectedCashCents,
    depositedCashCents,
    undepositedCashCents:
      countedCashCents - openingCashCents - depositedCashCents,
  };
}

export function calculateFuelVariance({
  openingGallons,
  deliveryGallons,
  dispensedGallons,
  closingGallons,
}: {
  openingGallons: string;
  deliveryGallons: string[];
  dispensedGallons: string[];
  closingGallons: string;
}) {
  const opening = normalizeQuantity(openingGallons);
  const delivered = deliveryGallons.reduce(
    (total, quantity) => addQuantities(total, normalizeQuantity(quantity)),
    "0.0000",
  );
  const dispensed = dispensedGallons.reduce(
    (total, quantity) => addQuantities(total, normalizeQuantity(quantity)),
    "0.0000",
  );
  const measuredClosing = normalizeQuantity(closingGallons);
  const expectedClosing = addQuantities(
    addQuantities(opening, delivered),
    `-${dispensed}`,
  );
  const variance = addQuantities(measuredClosing, `-${expectedClosing}`);

  return {
    openingGallons: opening,
    deliveredGallons: delivered,
    dispensedGallons: dispensed,
    expectedClosingGallons: expectedClosing,
    measuredClosingGallons: measuredClosing,
    varianceGallons: variance,
  };
}

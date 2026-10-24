import { QUANTITY_SCALE_FACTOR, quantityToScaledInteger } from "./quantity";

export function assertCents(value: number, label: string, allowNegative = false) {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe whole number of cents`);
  }
  if (!allowNegative && value < 0) {
    throw new Error(`${label} cannot be negative`);
  }
}

function divideAndRound(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  return sign * ((absolute + denominator / 2n) / denominator);
}

export function multiplyCentsByQuantity(unitPriceCents: number, quantity: string | number): number {
  assertCents(unitPriceCents, "Unit price");
  const scaledQuantity = quantityToScaledInteger(quantity);
  if (scaledQuantity < 0n) throw new Error("Quantity cannot be negative");

  const result = divideAndRound(BigInt(unitPriceCents) * scaledQuantity, QUANTITY_SCALE_FACTOR);
  const asNumber = Number(result);
  assertCents(asNumber, "Calculated amount");
  return asNumber;
}

export function assertBasisPoints(basisPoints: number, label = "Basis points"): void {
  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0 || basisPoints > 100_000) {
    throw new Error(`${label} must be a safe integer between 0 and 100000`);
  }
}

export function calculateBasisPoints(amountCents: number, basisPoints: number): number {
  assertCents(amountCents, "Amount");
  assertBasisPoints(basisPoints);
  return Number(divideAndRound(BigInt(amountCents) * BigInt(basisPoints), 10_000n));
}

/**
 * Tax rates are fractions (0.08875 = 8.875%), as in E-commerce. They become exact
 * integer parts per million before any money math; six decimal places of a
 * fraction is four of a percent, finer than any jurisdiction publishes.
 */
export function rateToPpm(rate: number, label = "Tax rate"): number {
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new Error(`${label} must be a fraction from 0 to 1 (0.08875 is 8.875%)`);
  }
  return Math.round(rate * 1_000_000);
}

export function calculateLineAmounts({
  unitPriceCents,
  quantity,
  discountCents = 0,
  taxRate = 0,
  taxInclusive = false,
}: {
  unitPriceCents: number;
  quantity: string | number;
  discountCents?: number;
  taxRate?: number;
  taxInclusive?: boolean;
}) {
  assertCents(discountCents, "Discount");
  const taxPpm = rateToPpm(taxRate);
  const subtotalCents = multiplyCentsByQuantity(unitPriceCents, quantity);
  if (discountCents > subtotalCents) {
    throw new Error("Discount cannot exceed line subtotal");
  }

  const discountedCents = subtotalCents - discountCents;
  const taxCents = taxInclusive
    ? Number(divideAndRound(
        BigInt(discountedCents) * BigInt(taxPpm),
        BigInt(1_000_000 + taxPpm),
      ))
    : Number(divideAndRound(BigInt(discountedCents) * BigInt(taxPpm), 1_000_000n));
  const taxableCents = discountedCents - (taxInclusive ? taxCents : 0);

  return {
    subtotalCents,
    discountCents,
    taxableCents,
    taxCents,
    totalCents: taxInclusive ? discountedCents : discountedCents + taxCents,
  };
}

export function sumAppliedTenders(tenders: Array<{ amountCents: number }>): number {
  return tenders.reduce((total, tender) => {
    assertCents(tender.amountCents, "Tender amount");
    const next = total + tender.amountCents;
    assertCents(next, "Tender total");
    return next;
  }, 0);
}

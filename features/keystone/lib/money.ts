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

export function calculateLineAmounts({
  unitPriceCents,
  quantity,
  discountCents = 0,
  taxRateBasisPoints = 0,
  taxInclusive = false,
}: {
  unitPriceCents: number;
  quantity: string | number;
  discountCents?: number;
  taxRateBasisPoints?: number;
  taxInclusive?: boolean;
}) {
  assertCents(discountCents, "Discount");
  assertBasisPoints(taxRateBasisPoints);
  const subtotalCents = multiplyCentsByQuantity(unitPriceCents, quantity);
  if (discountCents > subtotalCents) {
    throw new Error("Discount cannot exceed line subtotal");
  }

  const discountedCents = subtotalCents - discountCents;
  const taxCents = taxInclusive
    ? Number(divideAndRound(
        BigInt(discountedCents) * BigInt(taxRateBasisPoints),
        BigInt(10_000 + taxRateBasisPoints),
      ))
    : calculateBasisPoints(discountedCents, taxRateBasisPoints);
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

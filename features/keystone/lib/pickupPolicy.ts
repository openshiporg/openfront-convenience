import { fingerprintInput } from "./idempotency";

// Online pickup carts: pure rules, enforced server-side at payment start, at
// settlement and at webhook recording. Age-restricted goods are in-store only.

export type PickupPolicyLine = {
  id: string;
  quantity: { toString(): string };
  totalCents: number;
  variantId: string | null;
  ageRestricted?: boolean | null;
  variant?: {
    status: string;
    sellBy?: string;
    product?: { status: string; regulatedSaleType: string; minimumAge?: number | null } | null;
  } | null;
};

export function assertPickupEligible(lines: PickupPolicyLine[]): void {
  if (!lines.length) throw new Error("Your basket is empty");
  for (const line of lines) {
    const product = line.variant?.product;
    if (!line.variant || !product || line.variant.status !== "active" || product.status !== "active") {
      throw new Error("An item in your basket is no longer available");
    }
    // Live classification, not the cart-time snapshot: a product made restricted after it was added is still refused.
    if (product.regulatedSaleType !== "none" || line.ageRestricted || (product.minimumAge ?? 0) > 0) {
      throw new Error("Age-restricted items can only be bought in store");
    }
  }
}

export function pickupRevision(lines: PickupPolicyLine[], totalCents: number): string {
  return fingerprintInput({
    totalCents,
    lines: [...lines].sort((a, b) => a.id.localeCompare(b.id)).map(line => [line.id, line.variantId, line.quantity.toString(), line.totalCents]),
  });
}

/** Money is integer minor units; both amount and currency must match exactly. */
export function assertPaymentMatches(expected: { amountCents: number; currencyCode: string }, actual: { amountCents: unknown; currencyCode: unknown }): void {
  if (!Number.isSafeInteger(expected.amountCents) || expected.amountCents <= 0) throw new Error("Order total is invalid");
  if (!Number.isSafeInteger(actual.amountCents) || actual.amountCents !== expected.amountCents) {
    throw new Error("Payment amount does not match the order total");
  }
  if (typeof actual.currencyCode !== "string" || actual.currencyCode.toUpperCase() !== expected.currencyCode.toUpperCase()) {
    throw new Error("Payment currency does not match the order currency");
  }
}

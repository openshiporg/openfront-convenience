export function effectiveTenderRefundedCents(
  tenderAmountCents: number,
  legacySummaryCents: number,
  completedAllocationCents: number,
): number {
  for (const [label, amount] of [
    ["Tender amount", tenderAmountCents],
    ["Tender refund summary", legacySummaryCents],
    ["Completed refund allocations", completedAllocationCents],
  ] as const) {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new Error(`${label} must be non-negative integer cents`);
    }
  }
  const refunded = Math.max(legacySummaryCents, completedAllocationCents);
  if (tenderAmountCents < refunded) {
    throw new Error("Recorded tender refunds exceed the captured tender amount");
  }
  return refunded;
}

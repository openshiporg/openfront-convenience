export function allocateDiscountByCapacity(
  discountCents: number,
  capacities: number[],
): number[] {
  if (!Number.isSafeInteger(discountCents) || discountCents < 0) {
    throw new Error("Discount allocation requires non-negative integer cents");
  }
  if (
    capacities.some(
      (capacity) => !Number.isSafeInteger(capacity) || capacity < 0,
    )
  ) {
    throw new Error("Discount capacities must be non-negative integer cents");
  }

  const totalCapacity = capacities.reduce(
    (sum, capacity) => sum + BigInt(capacity),
    0n,
  );
  if (totalCapacity > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Eligible promotion amount exceeds safe integer cents");
  }
  let remainingDiscount = BigInt(discountCents);
  let remainingCapacity = totalCapacity;
  if (remainingDiscount > remainingCapacity) {
    throw new Error("Discount exceeds eligible line capacity");
  }

  const allocations = capacities.map((capacity) => {
    const capacityBigInt = BigInt(capacity);
    if (capacityBigInt === 0n || remainingDiscount === 0n) return 0;
    const allocation =
      capacityBigInt === remainingCapacity
        ? remainingDiscount
        : (remainingDiscount * capacityBigInt) / remainingCapacity;
    const bounded = allocation > capacityBigInt ? capacityBigInt : allocation;
    remainingDiscount -= bounded;
    remainingCapacity -= capacityBigInt;
    return Number(bounded);
  });

  if (
    remainingDiscount !== 0n ||
    allocations.reduce((sum, amount) => sum + amount, 0) !== discountCents
  ) {
    throw new Error("Discount allocation did not conserve the benefit");
  }
  return allocations;
}

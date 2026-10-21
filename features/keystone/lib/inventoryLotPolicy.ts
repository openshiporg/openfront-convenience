import {
  quantityToScaledInteger,
  scaledIntegerToQuantity,
} from "./quantity";

export type LotBalance = {
  id: string;
  quantityRemaining: string | number;
};

export type LotAllocation = {
  lotId: string;
  quantity: string;
};

export function planLotConsumption(
  requestedQuantity: string | number,
  lots: LotBalance[],
): {
  allocations: LotAllocation[];
  unallocatedQuantity: string;
} {
  let remaining = quantityToScaledInteger(requestedQuantity);
  if (remaining < 0n) throw new Error("Requested lot quantity cannot be negative");

  const allocations: LotAllocation[] = [];
  for (const lot of lots) {
    if (remaining === 0n) break;
    const available = quantityToScaledInteger(lot.quantityRemaining);
    if (available < 0n) throw new Error("Lot quantity cannot be negative");
    if (available === 0n) continue;

    const allocated = available < remaining ? available : remaining;
    allocations.push({
      lotId: lot.id,
      quantity: scaledIntegerToQuantity(allocated),
    });
    remaining -= allocated;
  }

  return {
    allocations,
    unallocatedQuantity: scaledIntegerToQuantity(remaining),
  };
}

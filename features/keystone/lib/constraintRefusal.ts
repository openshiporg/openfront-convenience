// A database rule (CHECK or partial unique index) that refused a write is a business refusal,
// not a crash: say which rule in words the cashier or manager can act on. Any other error is
// returned unchanged, so driver and Prisma text stays masked by the GraphQL error filter.

// Prisma reports a partial unique index as P2002 with the model and column, not the index name.
const UNIQUE_REFUSALS: Record<string, string> = {
  "RegisterSession:register": "Register already has an active session",
  "Shift:employee": "Employee already has an open shift",
  "FuelTransaction:nozzle": "This nozzle already has a fuel transaction in progress",
  "ProductBarcode:variant": "This item already has a primary barcode",
};

const CHECK_REFUSALS: Array<[RegExp, string]> = [
  [/^PromotionRule_percentage_check$/, "A percentage promotion can take at most 100% off"],
  [/_window_check$/, "The end must be after the start"],
  [/^(Sale|Tender)_refund_within_\w+_check$/, "Refund exceeds the amount paid"],
  [/^FuelTank_within_capacity_check$/, "Fuel volume would exceed the tank capacity"],
  [/^LotteryPack_ticket_range_check$/, "Lottery tickets fall outside this pack's range"],
  [/^PurchaseOrderLine_received_within_ordered_check$/, "Receiving exceeds the quantity ordered"],
  [/^InventoryTransferLine_flow_check$/, "Transfer quantities exceed what was requested or shipped"],
  [/^InventoryLot_remaining_within_received_check$/, "Lot quantity exceeds what was received"],
  [/^RegisterSession_bounds_check$/, "Register cash cannot go below zero"],
  [/_bounds_check$|_positive_check$|_nonnegative_check$/, "Amounts and quantities cannot be negative"],
];

function constraintName(error: unknown): { kind: "unique" | "check"; name: string } | null {
  const e = error as { code?: string; meta?: Record<string, unknown>; message?: string } | null;
  if (!e || typeof e !== "object") return null;
  if (e.code === "P2002") {
    const target = e.meta?.target;
    const columns = Array.isArray(target) ? target.join(",") : String(target ?? "");
    return { kind: "unique", name: `${String(e.meta?.modelName ?? "")}:${columns}` };
  }
  const text = [e.message ?? "", JSON.stringify(e.meta ?? {})].join(" ");
  const check = text.match(/check constraint \\?"([A-Za-z0-9_]+_check)\\?"/);
  return check ? { kind: "check", name: check[1] } : null;
}

/** A readable refusal for a known database rule, or null when the error is something else. */
export function constraintRefusal(error: unknown): Error | null {
  const found = constraintName(error);
  if (!found) return null;
  if (found.kind === "unique") {
    const message = UNIQUE_REFUSALS[found.name];
    return message ? new Error(message) : null;
  }
  for (const [pattern, message] of CHECK_REFUSALS) if (pattern.test(found.name)) return new Error(message);
  return null;
}

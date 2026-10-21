export type TransitionMap = Readonly<Record<string, readonly string[]>>;

export const REGISTER_SESSION_TRANSITIONS = {
  open: ["closing", "suspended"],
  closing: ["closed", "open"],
  suspended: ["open", "closed"],
  closed: [],
} as const satisfies TransitionMap;

export const PURCHASE_ORDER_TRANSITIONS = {
  draft: ["submitted", "cancelled"],
  submitted: ["approved", "cancelled"],
  approved: ["partially_received", "received", "cancelled"],
  partially_received: ["received", "cancelled"],
  received: [],
  cancelled: [],
} as const satisfies TransitionMap;

export const RECEIVING_TRANSITIONS = {
  draft: ["posted", "cancelled"],
  posted: [],
  cancelled: [],
} as const satisfies TransitionMap;

export const INVENTORY_COUNT_TRANSITIONS = {
  draft: ["counting", "cancelled"],
  counting: ["submitted", "cancelled"],
  submitted: ["approved", "counting", "cancelled"],
  approved: [],
  cancelled: [],
} as const satisfies TransitionMap;

export const CART_TRANSITIONS = {
  open: ["held", "converted", "abandoned", "voided"],
  held: ["open", "converted", "abandoned", "voided"],
  converted: [],
  abandoned: [],
  voided: [],
} as const satisfies TransitionMap;

export const SALE_TRANSITIONS = {
  open: ["completed", "voided"],
  completed: ["partially_refunded", "refunded", "voided"],
  partially_refunded: ["refunded"],
  refunded: [],
  voided: [],
} as const satisfies TransitionMap;

export const TENDER_TRANSITIONS = {
  pending: ["authorized", "captured", "failed", "cancelled"],
  authorized: ["captured", "cancelled", "failed"],
  captured: ["partially_refunded", "refunded"],
  partially_refunded: ["refunded"],
  refunded: [],
  failed: [],
  cancelled: [],
} as const satisfies TransitionMap;

export const REFUND_TRANSITIONS = {
  requested: ["approved", "rejected", "cancelled"],
  approved: ["processing", "completed", "cancelled"],
  processing: ["completed", "failed"],
  completed: [],
  failed: ["processing", "cancelled"],
  rejected: [],
  cancelled: [],
} as const satisfies TransitionMap;

export const RETURN_TRANSITIONS = {
  requested: ["approved", "rejected", "cancelled"],
  approved: ["received", "cancelled"],
  received: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
} as const satisfies TransitionMap;

export const PREP_BATCH_TRANSITIONS = {
  planned: ["in_progress", "cancelled"],
  in_progress: ["completed", "discarded", "cancelled"],
  completed: ["discarded"],
  discarded: [],
  cancelled: [],
} as const satisfies TransitionMap;

export const FUEL_TRANSACTION_TRANSITIONS = {
  requested: ["authorized", "declined", "cancelled"],
  authorized: ["dispensing", "cancelled"],
  dispensing: ["completed", "stopped"],
  completed: ["refunded"],
  stopped: ["completed", "cancelled"],
  refunded: [],
  declined: [],
  cancelled: [],
} as const satisfies TransitionMap;

export const STORE_DAY_TRANSITIONS = {
  draft: ["in_review"],
  in_review: ["reconciled", "locked"],
  reconciled: ["locked", "reopened"],
  locked: [],
  reopened: ["in_review", "reconciled", "locked"],
} as const satisfies TransitionMap;

export const FUEL_RECONCILIATION_TRANSITIONS = {
  draft: ["in_review"],
  in_review: ["approved", "locked", "disputed"],
  approved: ["locked", "disputed"],
  locked: [],
  disputed: ["in_review"],
} as const satisfies TransitionMap;

export const BANK_DEPOSIT_TRANSITIONS = {
  prepared: ["in_transit", "deposited", "voided"],
  in_transit: ["deposited", "voided"],
  deposited: ["verified"],
  verified: [],
  voided: [],
} as const satisfies TransitionMap;

export function evaluateTransition(
  transitions: TransitionMap,
  currentStatus: string,
  nextStatus: string,
): { replay: boolean } {
  if (currentStatus === nextStatus) return { replay: true };

  const allowed = transitions[currentStatus];
  if (!allowed?.includes(nextStatus)) {
    throw new Error(`Cannot transition from ${currentStatus} to ${nextStatus}`);
  }

  return { replay: false };
}

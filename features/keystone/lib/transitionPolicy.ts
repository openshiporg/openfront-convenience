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
  captured: ["partially_refunded", "refunded", "cancelled"],
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

/** Keystone validateInput hook (create+update): even a trusted writer cannot make a status move the lifecycle forbids. */
export function transitionGuard(transitions: TransitionMap, label: string) {
  return {
    validateInput({ operation, item, resolvedData, addValidationError }: { operation: string; item?: any; resolvedData?: any; addValidationError(message: string): void }) {
      if (operation !== "update") return;
      const next = resolvedData?.status;
      if (next === undefined || next === null || next === item?.status) return;
      if (!transitions[item?.status as string]?.includes(next)) {
        addValidationError(`${label} cannot move from ${item?.status} to ${next}`);
      }
    },
  };
}

/** Run several validateInput hooks as one (Keystone allows a single hook per list). */
export function combineValidateInput(...hooks: Array<{ validateInput(args: any): any }>) {
  return {
    async validateInput(args: any) {
      for (const hook of hooks) await hook.validateInput(args);
    },
  };
}

/** Compare-and-set a status inside a transaction: the row must still be in `from`, so a racing writer fails loudly. */
export async function moveStatus(
  delegate: { updateMany(args: any): Promise<{ count: number }> },
  transitions: TransitionMap,
  where: Record<string, unknown>,
  from: string,
  to: string,
  data: Record<string, unknown> = {},
  label = "Record",
) {
  if (evaluateTransition(transitions, from, to).replay) return false;
  const moved = await delegate.updateMany({ where: { ...where, status: from }, data: { ...data, status: to } });
  if (moved.count !== 1) throw new Error(`${label} changed while moving from ${from} to ${to}; refresh and retry`);
  return true;
}

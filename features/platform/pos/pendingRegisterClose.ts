import {
  parseRegisterCloseIntent,
  type RegisterCloseIntent,
} from "@/features/keystone/lib/registerCloseIntent";

export const registerCloseStorageKey = "ofc:register-close:intent:v1";
export type CloseIdentity = {
  userId: string;
  businessId: string;
  storeId: string;
};
export type CloseReceipt = {
  id: string;
  status: "closed";
  reference: string | null;
};
export type CloseJournal = {
  version: 1;
  pending: RegisterCloseIntent | null;
  history: Array<{ intent: RegisterCloseIntent; receipt: CloseReceipt }>;
};
type IntentStorage = Pick<Storage, "getItem" | "setItem">;
type Ports = {
  read: (intent: RegisterCloseIntent) => Promise<unknown>;
  submit: (intent: RegisterCloseIntent) => Promise<unknown>;
};
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
export function sameCloseIdentity(
  intent: RegisterCloseIntent,
  identity: CloseIdentity,
): boolean {
  return (
    intent.originalScope.userId === identity.userId &&
    intent.originalScope.machineId === null &&
    intent.businessId === identity.businessId &&
    intent.storeId === identity.storeId
  );
}
export function closeReceipt(
  value: unknown,
  intent: RegisterCloseIntent,
): CloseReceipt | null {
  const response = object(value);
  if (
    !response ||
    response.state !== "succeeded" ||
    response.retryable !== false ||
    response.id !== intent.registerSessionId ||
    response.status !== "closed" ||
    !(
      response.reference === null ||
      (typeof response.reference === "string" &&
        response.reference.length > 0 &&
        response.reference.length <= 256)
    )
  )
    return null;
  return {
    id: intent.registerSessionId,
    status: "closed",
    reference: response.reference,
  };
}
export function readCloseJournal(
  storage: IntentStorage,
  identity: CloseIdentity,
): { raw: string | null; journal: CloseJournal } {
  const raw = storage.getItem(registerCloseStorageKey);
  if (raw === null)
    return { raw, journal: { version: 1, pending: null, history: [] } };
  if (raw.length > 100_000)
    throw new Error(
      "Retained register-close history needs review; no new command sent",
    );
  const value = object(JSON.parse(raw));
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.history) ||
    Object.keys(value).some(
      (key) => !["version", "pending", "history"].includes(key),
    )
  )
    throw new Error(
      "Retained register-close data is invalid; no new command sent",
    );
  const pending =
    value.pending === null ? null : parseRegisterCloseIntent(value.pending);
  if (pending && !sameCloseIdentity(pending, identity))
    throw new Error(
      "An unresolved close belongs to another original account or store. Return to that scope; do not rekey",
    );
  const history = value.history.map((entry) => {
    const item = object(entry);
    if (!item) throw new Error("Retained close history is invalid");
    const intent = parseRegisterCloseIntent(item.intent),
      receipt = object(item.receipt);
    const parsed = closeReceipt(
      { ...receipt, state: "succeeded", retryable: false },
      intent,
    );
    if (!parsed) throw new Error("Retained close history is invalid");
    return { intent, receipt: parsed };
  });
  return { raw, journal: { version: 1, pending, history } };
}
function roundtrip(
  storage: IntentStorage,
  identity: CloseIdentity,
  before: string | null,
  journal: CloseJournal,
): void {
  if (storage.getItem(registerCloseStorageKey) !== before)
    throw new Error("Retained close changed or disappeared; no command sent");
  const raw = JSON.stringify(journal);
  storage.setItem(registerCloseStorageKey, raw);
  if (
    storage.getItem(registerCloseStorageKey) !== raw ||
    JSON.stringify(readCloseJournal(storage, identity).journal) !== raw
  )
    throw new Error(
      "Private intent storage did not roundtrip; no command sent",
    );
}
/** Call under the owned browser Web Lock. No polling, automatic retry, rekey,
 * secret storage or not-found→NEW conversion. Storage is principal-bound UI
 * isolation, NOT encryption or a server authority token. */
export async function performRegisterClose(
  storage: IntentStorage,
  identity: CloseIdentity,
  mode: "new" | "read" | "retry",
  candidate: RegisterCloseIntent | null,
  ports: Ports,
): Promise<{ journal: CloseJournal; confirmed: boolean }> {
  const loaded = readCloseJournal(storage, identity);
  let journal = loaded.journal;
  let intent = journal.pending;
  if (mode === "new") {
    if (intent || !candidate)
      throw new Error(
        "Retrieve the original pending close; no replacement key permitted",
      );
    intent = parseRegisterCloseIntent(candidate);
    if (!sameCloseIdentity(intent, identity))
      throw new Error("Original close account/store changed; no command sent");
    journal = { ...journal, pending: intent };
  } else {
    if (!intent || !candidate)
      throw new Error(
        "No retained original close is available; no command sent",
      );
    if (
      JSON.stringify(parseRegisterCloseIntent(candidate)) !==
      JSON.stringify(intent)
    )
      throw new Error(
        "Retained original close changed or disappeared; no command sent",
      );
  }
  roundtrip(storage, identity, loaded.raw, journal); // BEFORE ANY NETWORK I/O.
  let outcome: unknown;
  try {
    outcome = await ports.read(intent);
  } catch {
    outcome = null;
  }
  let receipt = closeReceipt(outcome, intent);
  if (!receipt && mode !== "read") {
    // Explicit SAME retry only. Even not_found/processing/unknown is not
    // rollback proof; the backend reauthorizes and enforces the original body.
    try {
      await ports.submit(intent);
    } catch {
      /* ambiguous: keep original */
    }
    try {
      outcome = await ports.read(intent);
    } catch {
      outcome = null;
    }
    receipt = closeReceipt(outcome, intent);
  }
  if (!receipt) return { journal, confirmed: false };
  const raw = JSON.stringify(journal);
  // Only confirmed receipts can leave pending. Keep recent client history;
  // older confirmed evidence remains in authoritative server audit/receipt
  // history. Never evict an unresolved intent or rotate its key.
  journal = {
    version: 1,
    pending: null,
    history: [...journal.history, { intent, receipt }].slice(-10),
  };
  roundtrip(storage, identity, raw, journal);
  return { journal, confirmed: true };
}

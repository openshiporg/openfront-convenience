"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  parseRegisterCloseIntent,
  type RegisterCloseIntent,
} from "@/features/keystone/lib/registerCloseIntent";
import {
  performRegisterClose,
  readCloseJournal,
  sameCloseIdentity,
  type CloseJournal,
} from "./pendingRegisterClose";
import {
  readRetainedRegisterClose,
  submitRetainedRegisterClose,
} from "./register-close-actions";

export function DurableRegisterClose({
  userId,
  businessId,
  storeId,
  children,
}: {
  userId: string;
  businessId: string;
  storeId: string;
  children: ReactNode;
}) {
  const identity = { userId, businessId, storeId };
  const identityKey = JSON.stringify(identity);
  const activeIdentity = useRef(identityKey);
  activeIdentity.current = identityKey;
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [journal, setJournal] = useState<CloseJournal | null>(null);
  const [message, setMessage] = useState(
    "Loading retained close",
  );
  const router = useRouter();
  const pending =
    journal?.pending && sameCloseIdentity(journal.pending, identity)
      ? journal.pending
      : null;
  const foreign = Boolean(journal?.pending && !pending);
  useEffect(() => {
    setReady(false);
    setJournal(null);
    try {
      if (!userId || !businessId || !storeId)
        throw new Error(
          "Current account and store are unavailable; no close sent",
        );
      if (!navigator.locks?.request)
        throw new Error(
          "Secure-context browser coordination is unavailable; no close sent",
        );
      const loaded = readCloseJournal(window.localStorage, {
        userId,
        businessId,
        storeId,
      });
      setJournal(loaded.journal);
      setReady(true);
      setMessage(
        loaded.journal.pending
          ? "Pending confirmation"
          : "Ready",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Private intent storage is unavailable; no close sent",
      );
    }
  }, [userId, businessId, storeId]);

  async function act(
    mode: "new" | "read" | "retry",
    candidate: RegisterCloseIntent | null,
  ) {
    if (busyRef.current || !ready || foreign) return;
    busyRef.current = true;
    setBusy(true);
    const originalIdentity = identityKey;
    try {
      const result = await navigator.locks.request(
        "ofc:register-close:intent:v1",
        () =>
          performRegisterClose(window.localStorage, identity, mode, candidate, {
            read: readRetainedRegisterClose,
            submit: submitRetainedRegisterClose,
          }),
      );
      if (activeIdentity.current !== originalIdentity) return;
      setJournal(result.journal);
      setMessage(
        result.confirmed
          ? "Original close confirmed"
          : "Pending confirmation",
      );
      if (result.confirmed) router.refresh();
    } catch (error) {
      if (activeIdentity.current !== originalIdentity) return;
      // Never turn a missing/changed journal into an empty ready NEW form.
      // Keep the known attempt in memory as well; storage durability is now
      // explicitly unavailable and no further operation is enabled.
      setReady(false);
      if (candidate)
        setJournal((previous) => ({
          version: 1,
          pending: candidate,
          history: previous?.history ?? [],
        }));
      setMessage(
        `${error instanceof Error ? error.message : "Close is unconfirmed."} Storage/intent needs review; the displayed attempt is retained in memory, not certified durable. No NEW or SAME operation is enabled.`,
      );
    } finally {
      busyRef.current = false;
      if (activeIdentity.current === originalIdentity) setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busyRef.current || pending || foreign) return;
    const form = new FormData(event.currentTarget);
    try {
      const registerSessionId = String(
        form.get("registerSessionId") ?? "",
      ).trim();
      const count = String(form.get("countedCashCents") ?? "").trim();
      if (!/^\d+$/.test(count))
        throw new Error(
          "Counted cash must be a non-negative integer number of cents",
        );
      const command = parseRegisterCloseIntent({
        businessId,
        storeId,
        registerSessionId,
        countedCashCents: Number(count),
        notes: String(form.get("notes") ?? "").trim() || null,
        idempotencyKey: window.crypto.randomUUID(),
        originalScope: {
          version: 1,
          purpose: "closeRegisterSession",
          userId,
          machineId: null,
          businessId,
          storeId,
          resourceId: registerSessionId,
        },
      });
      void act("new", command);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Close details are invalid; no command sent",
      );
    }
  }
  return (
    <div className="grid min-w-0 gap-3">
      <p
        role="status"
        aria-live="polite"
        className="text-xs leading-5 text-muted-foreground"
      >
        {message}
      </p>
      {pending ? (
        <div className="grid gap-2 border p-3 text-xs">
          <p>
            Original till: {pending.registerSessionId} · counted{" "}
            {pending.countedCashCents} cents
          </p>
          <p className="break-words">{pending.notes || "No closing notes"}</p>
          <p className="break-all">Retained key: {pending.idempotencyKey}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!ready || busy}
              onClick={() => void act("read", pending)}
              className="border px-3 py-2 disabled:opacity-50"
            >
              Retrieve SAME (read only)
            </button>
            <button
              type="button"
              disabled={!ready || busy}
              onClick={() => void act("retry", pending)}
              className="border px-3 py-2 disabled:opacity-50"
            >
              Retry SAME
            </button>
          </div>
        </div>
      ) : null}
      <form onSubmit={submit} className="grid gap-3">
        <fieldset
          disabled={!ready || busy || Boolean(pending) || foreign}
          className="grid min-w-0 gap-3 sm:grid-cols-2"
        >
          {children}
        </fieldset>
        <button
          type="submit"
          disabled={!ready || busy || Boolean(pending) || foreign}
          className="border px-3 py-2 text-sm disabled:opacity-50"
        >
          {busy ? "Checking original close…" : "Save intent and close register"}
        </button>
      </form>
      {journal?.history
        .filter((entry) => sameCloseIdentity(entry.intent, identity))
        .map((entry) => (
          <p key={entry.intent.idempotencyKey} className="text-xs">
            {entry.receipt.reference || entry.receipt.id} · original count{" "}
            {entry.intent.countedCashCents} cents · confirmed closed
          </p>
        ))}
    </div>
  );
}

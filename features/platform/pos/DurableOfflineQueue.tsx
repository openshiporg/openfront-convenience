"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  syncDurableOfflineQueue,
  type DurableOfflineOperation,
} from "./offline-actions";
import { buttonClass, dangerButtonClass, inputClass, panelClass, primaryButtonClass } from "../components/cv-ui";
import { centsFromInput } from "../lib/form-values";

// Typed in dollars; an unreadable amount becomes NaN so the operation is rejected, not mis-entered.
const safeCents = (value: string) => {
  try {
    return centsFromInput(value);
  } catch {
    return Number.NaN;
  }
};

type Option = { id: string; label: string; detail?: string | null };
type StoredOperation = DurableOfflineOperation & { id: string; scope: string };

const DATABASE = "openfront-convenience-pos";
const STORE = "offline-operations";

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function stored(scope: string): Promise<StoredOperation[]> {
  const db = await database();
  return new Promise<StoredOperation[]>((resolve, reject) => {
    const request = db
      .transaction(STORE, "readonly")
      .objectStore(STORE)
      .getAll();
    request.onsuccess = () =>
      resolve(
        (request.result as StoredOperation[])
          .filter((entry) => entry.scope === scope)
          .sort((left, right) => left.sequence - right.sequence),
      );
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

async function persistNext(
  scope: string,
  sequenceFloor: number,
  operationType: DurableOfflineOperation["operationType"],
  payload: Record<string, unknown>,
): Promise<StoredOperation> {
  const db = await database();
  return new Promise<StoredOperation>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const objectStore = transaction.objectStore(STORE);
    const request = objectStore.getAll();
    let operation: StoredOperation | null = null;
    request.onsuccess = () => {
      const current = (request.result as StoredOperation[]).filter(
        (entry) => entry.scope === scope,
      );
      const sequence =
        Math.max(sequenceFloor, ...current.map((entry) => entry.sequence)) + 1;
      operation = {
        id: `${scope}:${sequence}`,
        scope,
        sequence,
        operationType,
        operationIdempotencyKey: `web-pos-${crypto.randomUUID()}`,
        payload,
      };
      objectStore.put(operation);
    };
    transaction.oncomplete = () =>
      operation
        ? resolve(operation)
        : reject(new Error("Offline operation was not created"));
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}

async function rebaseStored(
  scope: string,
  sequenceFloor: number,
): Promise<StoredOperation[]> {
  const db = await database();
  return new Promise<StoredOperation[]>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    const objectStore = transaction.objectStore(STORE);
    const request = objectStore.getAll();
    let rebased: StoredOperation[] = [];
    request.onsuccess = () => {
      const current = (request.result as StoredOperation[])
        .filter((entry) => entry.scope === scope)
        .sort((left, right) => left.sequence - right.sequence);
      for (const operation of current) objectStore.delete(operation.id);
      rebased = current.map((operation, index) => ({
        ...operation,
        id: `${scope}:${sequenceFloor + index + 1}`,
        sequence: sequenceFloor + index + 1,
      }));
      for (const operation of rebased) objectStore.put(operation);
    };
    transaction.oncomplete = () => resolve(rebased);
    transaction.onerror = () => reject(transaction.error);
  }).finally(() => db.close());
}

async function removeStored(operations: StoredOperation[]): Promise<void> {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE, "readwrite");
    for (const operation of operations)
      transaction.objectStore(STORE).delete(operation.id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export function DurableOfflineQueue({
  businessId,
  storeId,
  devices,
  carts,
  cartLines,
  variants,
  employees,
}: {
  businessId: string;
  storeId: string;
  devices: Option[];
  carts: Option[];
  cartLines: Option[];
  variants: Option[];
  employees: Option[];
}) {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "");
  const [cartId, setCartId] = useState(carts[0]?.id ?? "");
  const [cartLineId, setCartLineId] = useState(cartLines[0]?.id ?? "");
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [barcode, setBarcode] = useState("");
  const [quantity, setQuantity] = useState("1.0000");
  const [amountCents, setAmountCents] = useState("");
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [managerPin, setManagerPin] = useState("");
  const [correctionReason, setCorrectionReason] =
    useState("Offline correction");
  const [queue, setQueue] = useState<StoredOperation[]>([]);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [acknowledgedSequence, setAcknowledgedSequence] = useState(0);
  const scope = useMemo(
    () => `${businessId}:${storeId}:${deviceId}`,
    [businessId, storeId, deviceId],
  );
  const serverSequence =
    Number(devices.find((device) => device.id === deviceId)?.detail ?? 0) || 0;

  useEffect(() => {
    const local =
      Number(
        window.localStorage.getItem(`ofc-offline-sequence:${scope}`) ?? 0,
      ) || 0;
    setAcknowledgedSequence(Math.max(serverSequence, local));
  }, [scope, serverSequence]);

  const reload = useCallback(async () => {
    if (!deviceId) return setQueue([]);
    setQueue(await stored(scope));
  }, [deviceId, scope]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const enqueue = useCallback(
    async (
      operationType: DurableOfflineOperation["operationType"],
      payload: Record<string, unknown>,
    ) => {
      if (!deviceId || !cartId)
        return setMessage("Choose an offline device and cart first.");
      // One read/write transaction serializes sequence allocation across tabs.
      const sharedAcknowledgedSequence =
        Number(
          window.localStorage.getItem(`ofc-offline-sequence:${scope}`) ?? 0,
        ) || 0;
      const operation = await persistNext(
        scope,
        Math.max(
          serverSequence,
          acknowledgedSequence,
          sharedAcknowledgedSequence,
        ),
        operationType,
        payload,
      );
      await reload();
      setMessage(
        `Queued ${operationType} as sequence ${operation.sequence}. It survives browser restart.`,
      );
    },
    [acknowledgedSequence, cartId, deviceId, reload, scope, serverSequence],
  );

  const synchronize = useCallback(async () => {
    if (!deviceId || syncing) return;
    const operations = await stored(scope);
    if (!operations.length || !navigator.onLine) return;
    if (
      operations.some((operation) =>
        ["updatePosCartLine", "removePosCartLine"].includes(
          operation.operationType,
        ),
      ) &&
      !managerPin
    ) {
      setMessage(
        "Enter the manager PIN to authorize queued corrections before sync.",
      );
      return;
    }
    setSyncing(true);
    try {
      const first = operations[0].sequence;
      const last = operations.at(-1)!.sequence;
      const response = await syncDurableOfflineQueue({
        businessId,
        storeId,
        deviceId,
        batchNumber: `WEB-${first}-${last}`,
        idempotencyKey: `web-offline:${deviceId}:${first}:${last}`,
        operations: operations.map(
          ({ sequence, operationType, operationIdempotencyKey, payload }) => ({
            sequence,
            operationType,
            operationIdempotencyKey,
            payload: ["updatePosCartLine", "removePosCartLine"].includes(
              operationType,
            )
              ? { ...payload, managerPin }
              : payload,
          }),
        ),
      });
      if (!response.success)
        return setMessage(response.error ?? "Offline sync failed");
      const serverAcknowledgement = Number(
        response.result?.acknowledgedSequence ?? 0,
      );
      if (
        !Number.isSafeInteger(serverAcknowledgement) ||
        serverAcknowledgement < 0
      )
        throw new Error(
          "Offline sync returned an invalid server acknowledgement",
        );
      const acknowledgedFloor = Math.max(
        acknowledgedSequence,
        serverAcknowledgement,
      );
      window.localStorage.setItem(
        `ofc-offline-sequence:${scope}`,
        String(acknowledgedFloor),
      );
      setAcknowledgedSequence(acknowledgedFloor);
      if (response.result?.status !== "conflict") {
        await removeStored(operations);
      } else {
        // Refresh the server projection while retaining the explicit server
        // acknowledgement so an immediate rebase cannot race the refresh.
        router.refresh();
      }
      await reload();
      setMessage(`Offline sync ${response.result?.status ?? "completed"}.`);
    } finally {
      setSyncing(false);
    }
  }, [
    acknowledgedSequence,
    businessId,
    deviceId,
    managerPin,
    reload,
    router,
    scope,
    storeId,
    syncing,
  ]);

  const rebase = useCallback(async () => {
    const localAcknowledged =
      Number(
        window.localStorage.getItem(`ofc-offline-sequence:${scope}`) ?? 0,
      ) || 0;
    const floor = Math.max(
      serverSequence,
      acknowledgedSequence,
      localAcknowledged,
    );
    const rebased = await rebaseStored(scope, floor);
    await reload();
    setMessage(
      rebased.length
        ? `Rebased ${rebased.length} retained operation${rebased.length === 1 ? "" : "s"} above server sequence ${floor}.`
        : "No retained operations to rebase.",
    );
  }, [acknowledgedSequence, reload, scope, serverSequence]);

  const discard = useCallback(async () => {
    const operations = await stored(scope);
    if (!operations.length) return;
    if (
      !window.confirm(
        `Abandon ${operations.length} retained offline operation${operations.length === 1 ? "" : "s"}? Export evidence first if it is needed for review.`,
      )
    )
      return;
    await removeStored(operations);
    await reload();
    setMessage(
      "Retained offline operations were explicitly abandoned on this terminal.",
    );
  }, [reload, scope]);

  const exportQueue = useCallback(async () => {
    const operations = await stored(scope);
    const artifact = JSON.stringify(
      { exportedAt: new Date().toISOString(), scope, operations },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([artifact], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `offline-queue-${deviceId || "device"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(
      `Exported ${operations.length} retained operation${operations.length === 1 ? "" : "s"} for review.`,
    );
  }, [deviceId, scope]);

  useEffect(() => {
    const online = () => {
      void synchronize();
    };
    window.addEventListener("online", online);
    if (navigator.onLine) void synchronize();
    return () => window.removeEventListener("online", online);
  }, [synchronize]);

  if (!devices.length) return null;
  const controlClass = inputClass;
  return (
    <section
      className={panelClass}
      aria-labelledby="offline-pos-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="offline-pos-heading" className="font-semibold">
            Durable offline terminal queue
          </h2>
        </div>
        <button
          type="button"
          className={buttonClass}
          disabled={syncing || !queue.length}
          onClick={() => void synchronize()}
        >
          {syncing ? "Syncing…" : `Sync ${queue.length} queued`}
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <label className="text-xs font-medium">
          Terminal
          <select
            className={controlClass}
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
          >
            {devices.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Basket
          <select
            className={controlClass}
            value={cartId}
            onChange={(event) => setCartId(event.target.value)}
          >
            {carts.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Existing line
          <select
            className={controlClass}
            value={cartLineId}
            onChange={(event) => setCartLineId(event.target.value)}
          >
            {cartLines.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Variant
          <select
            className={controlClass}
            value={variantId}
            onChange={(event) => setVariantId(event.target.value)}
          >
            {variants.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Barcode / PLU
          <input
            className={controlClass}
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
          />
        </label>
        <label className="text-xs font-medium">
          Quantity
          <input
            className={controlClass}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="text-xs font-medium">
          Cash sale total
          <input
            className={`${controlClass} font-mono`}
            value={amountCents}
            onChange={(event) => setAmountCents(event.target.value)}
            inputMode="decimal"
            placeholder="0.00"
          />
        </label>
        <label className="text-xs font-medium">
          Correction manager
          <select
            className={controlClass}
            value={employeeId}
            onChange={(event) => setEmployeeId(event.target.value)}
          >
            {employees.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          Correction reason
          <input
            className={controlClass}
            value={correctionReason}
            onChange={(event) => setCorrectionReason(event.target.value)}
          />
        </label>
        <label className="text-xs font-medium">
          Manager PIN (held in memory only)
          <input
            className={controlClass}
            type="password"
            inputMode="numeric"
            value={managerPin}
            onChange={(event) => setManagerPin(event.target.value)}
          />
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={() =>
            void enqueue("addPosCartLine", {
              cartId,
              barcode: barcode || null,
              variantId: barcode ? null : variantId,
              quantity,
            })
          }
        >
          Queue scan
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() =>
            void enqueue("updatePosCartLine", {
              cartId,
              cartLineId,
              quantity,
              employeeId,
              reason: correctionReason,
            })
          }
        >
          Queue quantity
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() =>
            void enqueue("removePosCartLine", {
              cartId,
              cartLineId,
              employeeId,
              reason: correctionReason,
            })
          }
        >
          Queue remove
        </button>
        {(["held", "open", "voided"] as const).map((nextStatus) => (
          <button
            key={nextStatus}
            type="button"
            className={buttonClass}
            onClick={() =>
              void enqueue("transitionPosCart", {
                cartId,
                nextStatus,
                reason:
                  nextStatus === "voided" ? "Offline operator void" : null,
              })
            }
          >
            Queue {nextStatus}
          </button>
        ))}
        <button
          type="button"
          className={primaryButtonClass}
          onClick={() =>
            void enqueue("completePosSale", {
              cartId,
              tenders: [
                {
                  method: "cash",
                  amountCents: safeCents(amountCents),
                  tenderedCents: safeCents(amountCents),
                },
              ],
            })
          }
        >
          Queue cash completion
        </button>
      </div>
      {queue.length ? (
        <div className="mt-4 space-y-3 border-t pt-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonClass}
              onClick={() => void exportQueue()}
            >
              Export retained evidence
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => void rebase()}
            >
              Rebase above server sequence
            </button>
            <button
              type="button"
              className={dangerButtonClass}
              onClick={() => void discard()}
            >
              Abandon retained operations
            </button>
          </div>
          <ol className="grid gap-2" aria-label="Retained offline operations">
            {queue.map((operation) => (
              <li
                key={operation.id}
                className="min-w-0 border bg-background p-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    Sequence {operation.sequence} · {operation.operationType}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {operation.operationIdempotencyKey.slice(0, 24)}
                  </span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-muted-foreground">
                    Inspect retained payload
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {JSON.stringify(operation.payload, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <p className="mt-3 text-xs" role="status">
        {message ||
          `${queue.length} operation${queue.length === 1 ? "" : "s"} queued locally.`}
      </p>
    </section>
  );
}

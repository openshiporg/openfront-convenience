"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import type { PlatformOption } from "../lib/projection";
import {
  fastAddPosLine,
  fastCompleteExactCash,
  fastCreatePosCart,
  fastLoadPosCart,
  fastReadPosOperationOutcome,
  type FastPosCartSummary,
  type FastPosOperationOutcome,
  type FastPosOperationScope,
  type FastPosResult,
} from "./fast-pos-actions";

function operationKey(label: string): string {
  return `fast-pos-${label}-${crypto.randomUUID()}`;
}

function optionMatchesScan(option: PlatformOption, scan: string): boolean {
  const candidate = scan.trim().toLowerCase();
  if (!candidate) return false;
  return [option.id, option.label, ...(option.detail || "").split("·")].some(
    (value) => value.trim().toLowerCase() === candidate,
  );
}

function optionMatchesBarcode(option: PlatformOption, scan: string): boolean {
  const candidate = scan.trim().toLowerCase();
  if (!candidate) return false;
  // Projection detail starts with SKU; remaining identifiers are actual active
  // barcode values, which must survive local option matching and retries.
  return (option.detail || "")
    .split("·")
    .slice(1)
    .some((value) => value.trim().toLowerCase() === candidate);
}

type PendingPosIntent =
  | {
      scope: "createPosCart";
      idempotencyKey: string;
      registerSessionId: string;
      cashierId: string;
    }
  | {
      scope: "addPosCartLine";
      idempotencyKey: string;
      cartId: string;
      barcode: string | null;
      variantId: string | null;
      quantity: string;
    }
  | {
      scope: "completePosSale";
      idempotencyKey: string;
      cartId: string;
      amountCents: number;
    };

function parsePendingIntent(value: string): PendingPosIntent | null {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (
      typeof parsed.idempotencyKey !== "string" ||
      typeof parsed.scope !== "string"
    ) {
      return null;
    }
    if (
      parsed.scope === "createPosCart" &&
      typeof parsed.registerSessionId === "string" &&
      typeof parsed.cashierId === "string"
    ) {
      return parsed as PendingPosIntent;
    }
    if (
      parsed.scope === "addPosCartLine" &&
      typeof parsed.cartId === "string" &&
      (typeof parsed.barcode === "string" || parsed.barcode === null) &&
      (typeof parsed.variantId === "string" || parsed.variantId === null) &&
      typeof parsed.quantity === "string"
    ) {
      return parsed as PendingPosIntent;
    }
    if (
      parsed.scope === "completePosSale" &&
      typeof parsed.cartId === "string" &&
      Number.isSafeInteger(parsed.amountCents) &&
      Number(parsed.amountCents) >= 0
    ) {
      return parsed as PendingPosIntent;
    }
    return null;
  } catch {
    return null;
  }
}

function outcomeScope(scope: PendingPosIntent["scope"]): FastPosOperationScope {
  return scope;
}

export function FastCheckoutStation({
  businessId,
  storeId,
  carts: initialCarts,
  registerSessions,
  employees,
  variants,
}: {
  businessId: string;
  storeId: string;
  carts: PlatformOption[];
  registerSessions: PlatformOption[];
  employees: PlatformOption[];
  variants: PlatformOption[];
}) {
  const storageKey = `openfront-fast-pos:${businessId}:${storeId}:cart`;
  const pendingStorageKey = `${storageKey}:pending-operation`;
  const [pendingIntent, setPendingIntent] = useState<PendingPosIntent | null>(
    null,
  );
  const pendingIntentRef = useRef<PendingPosIntent | null>(null);
  const restoredIntentRef = useRef(false);
  const checkPendingOutcomeRef = useRef<() => void>(() => {});
  const [pendingOutcome, setPendingOutcome] =
    useState<FastPosOperationOutcome["state"]>("unknown");
  const [pendingCanRetry, setPendingCanRetry] = useState(false);
  const [carts, setCarts] = useState(initialCarts);
  const [cartId, setCartId] = useState(initialCarts[0]?.id ?? "");
  const [registerSessionId, setRegisterSessionId] = useState(
    registerSessions[0]?.id ?? "",
  );
  const [cashierId, setCashierId] = useState(employees[0]?.id ?? "");
  const [scan, setScan] = useState("");
  const [variantId, setVariantId] = useState(variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [summary, setSummary] = useState<FastPosCartSummary | null>(null);
  const [message, setMessage] = useState(
    "Ready",
  );
  const [saleId, setSaleId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCarts(initialCarts);
    setCartId((current) =>
      initialCarts.some((cart) => cart.id === current)
        ? current
        : (initialCarts[0]?.id ?? ""),
    );
  }, [initialCarts]);

  useEffect(() => {
    const serialized = window.localStorage.getItem(pendingStorageKey);
    if (!serialized) return;
    const restored = parsePendingIntent(serialized);
    if (restored) {
      pendingIntentRef.current = restored;
      restoredIntentRef.current = true;
      setPendingIntent(restored);
    } else {
      window.localStorage.removeItem(pendingStorageKey);
    }
  }, [pendingStorageKey]);

  useEffect(() => {
    const retained = window.localStorage.getItem(storageKey);
    if (retained && carts.some((cart) => cart.id === retained)) {
      const frame = requestAnimationFrame(() => setCartId(retained));
      return () => cancelAnimationFrame(frame);
    }
  }, [carts, storageKey]);

  useEffect(() => {
    if (cartId) window.localStorage.setItem(storageKey, cartId);
  }, [cartId, storageKey]);

  useEffect(() => {
    let current = true;
    if (!cartId) {
      return () => {
        current = false;
      };
    }
    startTransition(async () => {
      const result = await fastLoadPosCart({ businessId, storeId, cartId });
      if (!current) return;
      setSummary(result.cart);
      setMessage(result.message);
    });
    return () => {
      current = false;
    };
  }, [businessId, cartId, storeId]);

  const selectedCart = useMemo(
    () => carts.find((cart) => cart.id === cartId) ?? null,
    [cartId, carts],
  );
  const selectedVariantId = variants.some((option) => option.id === variantId)
    ? variantId
    : (variants[0]?.id ?? "");

  const focusScanner = () =>
    requestAnimationFrame(() => scanRef.current?.focus());

  const clearPendingIntent = () => {
    pendingIntentRef.current = null;
    setPendingIntent(null);
    setPendingOutcome("unknown");
    setPendingCanRetry(false);
    window.localStorage.removeItem(pendingStorageKey);
  };

  const applyCartSummary = (cart: FastPosCartSummary) => {
    setSummary(cart);
    setCarts((current) => [
      {
        id: cart.id,
        label: cart.reference,
        detail: `${cart.lineCount} lines · ${cart.totalCents} cents`,
      },
      ...current.filter((item) => item.id !== cart.id),
    ]);
  };

  const settleIntent = async (
    intent: PendingPosIntent,
    result?: FastPosResult,
    outcome?: FastPosOperationOutcome,
  ) => {
    if (!result?.ok && outcome?.state !== "succeeded") {
      setPendingOutcome(outcome?.state ?? "unknown");
      setPendingCanRetry(Boolean(outcome?.retryable));
      setMessage(
        outcome?.state === "not_found"
          ? "No committed result exists for this request. Retry the same operation or discard it before entering a new action."
          : outcome?.state === "processing"
            ? "This request is still processing. Check its status again before retrying."
            : result?.message ||
              "The request outcome is unknown. Keep this action pending and check again before scanning another item.",
      );
      return;
    }

    const committed = outcome?.state === "succeeded";
    if (intent.scope === "createPosCart") {
      const cart =
        result?.cart ??
        (committed && outcome?.id
          ? (
              await fastLoadPosCart({
                businessId,
                storeId,
                cartId: outcome.id,
              })
            ).cart
          : null);
      if (cart) {
        applyCartSummary(cart);
        setCartId(cart.id);
        setSaleId(null);
      }
      setMessage(
        result?.message ||
          (cart
            ? `${cart.reference} is ready to scan.`
            : "Basket started; refresh the basket list."),
      );
    } else if (intent.scope === "addPosCartLine") {
      const cart =
        result?.cart ??
        (committed
          ? (
              await fastLoadPosCart({
                businessId,
                storeId,
                cartId: intent.cartId,
              })
            ).cart
          : null);
      if (cart) applyCartSummary(cart);
      setScan("");
      setMessage(result?.message || "Item added to the basket.");
    } else {
      const completedSaleId = result?.saleId || outcome?.id || null;
      setSaleId(completedSaleId);
      setSummary(null);
      setCarts((current) =>
        current.filter((cart) => cart.id !== intent.cartId),
      );
      const next = carts.find((cart) => cart.id !== intent.cartId)?.id ?? "";
      setCartId(next);
      if (next) window.localStorage.setItem(storageKey, next);
      else window.localStorage.removeItem(storageKey);
      setMessage(
        result?.message ||
          `${outcome?.reference || "Sale"} completed${outcome?.status ? ` (${outcome.status})` : ""}.`,
      );
    }
    clearPendingIntent();
    focusScanner();
  };

  const readIntentOutcome = async (intent: PendingPosIntent) =>
    fastReadPosOperationOutcome({
      businessId,
      storeId,
      scope: outcomeScope(intent.scope),
      idempotencyKey: intent.idempotencyKey,
    });

  const runIntent = (intent: PendingPosIntent) => {
    startTransition(async () => {
      let result: FastPosResult | undefined;
      try {
        if (intent.scope === "createPosCart") {
          result = await fastCreatePosCart({
            businessId,
            storeId,
            registerSessionId: intent.registerSessionId,
            cashierId: intent.cashierId,
            idempotencyKey: intent.idempotencyKey,
          });
        } else if (intent.scope === "addPosCartLine") {
          result = await fastAddPosLine({
            businessId,
            storeId,
            cartId: intent.cartId,
            barcode: intent.barcode,
            variantId: intent.variantId,
            quantity: intent.quantity,
            idempotencyKey: intent.idempotencyKey,
          });
        } else {
          result = await fastCompleteExactCash({
            businessId,
            storeId,
            cartId: intent.cartId,
            amountCents: intent.amountCents,
            idempotencyKey: intent.idempotencyKey,
          });
        }
      } catch {
        // The request may have committed before the response was lost; resolve
        // by its durable key instead of creating a new operation.
      }
      if (result?.ok) {
        await settleIntent(intent, result);
        return;
      }
      if (result) setMessage(result.message);
      const outcome = await readIntentOutcome(intent);
      await settleIntent(intent, result, outcome);
    });
  };

  const beginIntent = (intent: PendingPosIntent) => {
    if (pendingIntentRef.current) return;
    pendingIntentRef.current = intent;
    setPendingIntent(intent);
    setPendingOutcome("unknown");
    setPendingCanRetry(false);
    window.localStorage.setItem(pendingStorageKey, JSON.stringify(intent));
    runIntent(intent);
  };

  const checkPendingOutcome = () => {
    const intent = pendingIntentRef.current;
    if (!intent) return;
    startTransition(async () => {
      const outcome = await readIntentOutcome(intent);
      await settleIntent(intent, undefined, outcome);
    });
  };
  checkPendingOutcomeRef.current = checkPendingOutcome;

  const retryPendingIntent = () => {
    const intent = pendingIntentRef.current;
    if (
      intent &&
      pendingCanRetry &&
      (pendingOutcome === "not_found" || pendingOutcome === "processing")
    ) {
      runIntent(intent);
    }
  };

  const discardUncommittedIntent = () => {
    if (pendingOutcome !== "not_found") return;
    if (
      window.confirm(
        "The server reports no committed result for this operation. Discard it and allow a new POS action?",
      )
    ) {
      clearPendingIntent();
      setMessage("Uncommitted operation discarded. You can continue checkout.");
    }
  };

  const startBasket = () => {
    beginIntent({
      scope: "createPosCart",
      registerSessionId,
      cashierId,
      idempotencyKey: operationKey("cart"),
    });
  };

  const addItem = () => {
    if (!cartId) return;
    const scanValue = scan.trim();
    const matchedVariant = variants.find((option) =>
      optionMatchesScan(option, scanValue),
    );
    const matchedBarcode = variants.some((option) =>
      optionMatchesBarcode(option, scanValue),
    );
    beginIntent({
      scope: "addPosCartLine",
      cartId,
      barcode:
        scanValue && (!matchedVariant || matchedBarcode) ? scanValue : null,
      variantId: matchedVariant?.id || (!scanValue ? selectedVariantId : null),
      quantity,
      idempotencyKey: operationKey("line"),
    });
  };

  const refreshSelectedCart = () => {
    if (!cartId) return;
    startTransition(async () => {
      const result = await fastLoadPosCart({ businessId, storeId, cartId });
      setSummary(result.cart);
      if (result.cart) applyCartSummary(result.cart);
      setMessage(result.message);
    });
  };

  const completeExactCash = () => {
    if (!cartId || !summary || summary.id !== cartId || !summary.linesLoaded)
      return;
    beginIntent({
      scope: "completePosSale",
      cartId,
      amountCents: summary.totalCents,
      idempotencyKey: operationKey("exact-cash"),
    });
  };

  useEffect(() => {
    if (!pendingIntent?.idempotencyKey || !restoredIntentRef.current) return;
    restoredIntentRef.current = false;
    checkPendingOutcomeRef.current();
  }, [pendingIntent?.idempotencyKey]);

  return (
    <section
      className="grid min-w-0 gap-4 rounded-lg border bg-card p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_18rem]"
      aria-labelledby="fast-checkout-heading"
    >
      <div className="min-w-0 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Express lane
          </p>
          <h2 id="fast-checkout-heading" className="text-xl font-semibold">
            Scanner-focused checkout
          </h2>
        </div>

        {pendingIntent ? (
          <div
            className="space-y-2 rounded-md border border-amber-500/50 bg-amber-500/5 p-3"
            role="status"
          >
            <p className="text-sm font-medium">
              POS action awaiting confirmation
            </p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={checkPendingOutcome}
                disabled={pending}
                className="h-9 border bg-background px-3 text-sm disabled:opacity-50"
              >
                Check result
              </button>
              {pendingCanRetry ? (
                <button
                  type="button"
                  onClick={retryPendingIntent}
                  disabled={pending}
                  className="h-9 bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  Retry same operation
                </button>
              ) : null}
              {pendingOutcome === "not_found" ? (
                <button
                  type="button"
                  onClick={discardUncommittedIntent}
                  disabled={pending}
                  className="h-9 border bg-background px-3 text-sm disabled:opacity-50"
                >
                  Discard uncommitted action
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid min-w-0 gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs font-medium">
            Open basket
            <select
              value={cartId}
              disabled={Boolean(pendingIntent)}
              onChange={(event) => {
                setCartId(event.target.value);
                setSummary(null);
                setSaleId(null);
                focusScanner();
              }}
              className="h-11 min-w-0 border bg-background px-2 text-sm"
            >
              <option value="">Start or choose a basket</option>
              {carts.map((cart) => (
                <option key={cart.id} value={cart.id}>
                  {cart.label} {cart.detail ? `· ${cart.detail}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Open till
            <select
              value={registerSessionId}
              disabled={Boolean(pendingIntent)}
              onChange={(event) => setRegisterSessionId(event.target.value)}
              className="h-11 min-w-0 border bg-background px-2 text-sm"
            >
              {registerSessions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Cashier
            <select
              value={cashierId}
              disabled={Boolean(pendingIntent)}
              onChange={(event) => setCashierId(event.target.value)}
              className="h-11 min-w-0 border bg-background px-2 text-sm"
            >
              {employees.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={startBasket}
          disabled={
            pending ||
            Boolean(pendingIntent) ||
            !registerSessionId ||
            !cashierId
          }
          className="h-11 border bg-background px-4 text-sm font-medium disabled:opacity-50"
        >
          New basket
        </button>

        <form
          className={`grid min-w-0 gap-3 sm:items-end ${
            variants.length
              ? "sm:grid-cols-[minmax(0,1fr)_9rem_6rem_auto]"
              : "sm:grid-cols-[minmax(0,1fr)_6rem_auto]"
          }`}
          onSubmit={(event) => {
            event.preventDefault();
            addItem();
          }}
        >
          <label className="grid min-w-0 gap-1 text-xs font-medium">
            Scan barcode / enter PLU
            <input
              ref={scanRef}
              value={scan}
              disabled={Boolean(pendingIntent)}
              onChange={(event) => setScan(event.target.value)}
              autoFocus
              autoComplete="off"
              inputMode="numeric"
              placeholder="Scan, then Enter"
              className="h-12 min-w-0 border bg-background px-3 text-base"
            />
          </label>
          {variants.length > 0 ? (
            <label className="grid min-w-0 gap-1 text-xs font-medium">
              Item fallback
              <select
                value={selectedVariantId}
                disabled={Boolean(pendingIntent)}
                onChange={(event) => setVariantId(event.target.value)}
                className="h-12 min-w-0 border bg-background px-2 text-sm"
              >
                {variants.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-xs font-medium">
            Quantity
            <input
              value={quantity}
              disabled={Boolean(pendingIntent)}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="decimal"
              className="h-12 min-w-0 border bg-background px-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={
              pending ||
              Boolean(pendingIntent) ||
              !cartId ||
              (!scan.trim() && !selectedVariantId)
            }
            className="h-12 bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </div>

      <aside className="flex min-w-0 flex-col justify-between gap-4 rounded-md bg-muted/40 p-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Current basket
          </p>
          <p className="truncate text-base font-semibold">
            {summary?.reference || selectedCart?.label || "No basket selected"}
          </p>
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            ${((summary?.totalCents ?? 0) / 100).toFixed(2)}
          </p>
          <p className="text-sm text-muted-foreground">
            {summary?.lineCount ?? 0} line
            {(summary?.lineCount ?? 0) === 1 ? "" : "s"}
          </p>
          <div className="mt-3 max-h-64 overflow-y-auto border-t">
            {summary?.lines.map((line) => (
              <div
                key={line.id}
                className="flex items-start justify-between gap-3 border-b py-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{line.title}</p>
                  <p className="text-muted-foreground">
                    {line.quantity} {line.unitOfMeasure} × $
                    {(line.unitPriceCents / 100).toFixed(2)}
                    {line.discountCents
                      ? ` · discount $${(line.discountCents / 100).toFixed(2)}`
                      : ""}
                    {line.taxCents
                      ? ` · tax $${(line.taxCents / 100).toFixed(2)}`
                      : ""}
                  </p>
                </div>
                <span className="shrink-0 font-medium tabular-nums">
                  ${(line.totalCents / 100).toFixed(2)}
                </span>
              </div>
            ))}
            {summary?.lineCount === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">
                No items yet.
              </p>
            ) : null}
            {summary && !summary.linesLoaded ? (
              <div className="space-y-2 py-2">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  The complete item list is unavailable; exact-cash checkout is
                  disabled until it is reviewed.
                </p>
                <button
                  type="button"
                  onClick={refreshSelectedCart}
                  disabled={pending}
                  className="h-8 border bg-background px-2 text-xs disabled:opacity-50"
                >
                  Refresh item list
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <div className="space-y-3">
          <button
            type="button"
            onClick={completeExactCash}
            disabled={
              pending ||
              Boolean(pendingIntent) ||
              !cartId ||
              summary?.id !== cartId ||
              !summary.linesLoaded ||
              summary.lineCount < 1
            }
            className="h-12 w-full bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Exact cash · server total
          </button>
          {saleId ? (
            <a
              href={`/dashboard/platform/pos/receipt/${encodeURIComponent(saleId)}?businessId=${encodeURIComponent(businessId)}&storeId=${encodeURIComponent(storeId)}`}
              className="block text-center text-sm font-medium underline underline-offset-4"
            >
              Open receipt
            </a>
          ) : null}
          <p className="text-xs text-muted-foreground" role="status">
            {pending ? "Posting…" : message}
          </p>
        </div>
      </aside>
    </section>
  );
}

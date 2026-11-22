"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  Dot,
  buttonClass,
  dangerButtonClass,
  inputClass,
  panelClass,
  primaryButtonClass,
  type DotTone,
} from "../components/cv-ui";
import { quantityText, shortRef } from "../lib/labels";
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
import { PlatformSelect } from "../components/PlatformSelect";

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
      tenderedCents?: number;
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
      Number(parsed.amountCents) >= 0 &&
      (parsed.tenderedCents === undefined || Number.isSafeInteger(parsed.tenderedCents))
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
  employees: allEmployees,
  selfEmployeeId = "",
  variants,
  currencyCode,
}: {
  currencyCode: string;
  businessId: string;
  storeId: string;
  carts: PlatformOption[];
  registerSessions: PlatformOption[];
  employees: PlatformOption[];
  selfEmployeeId?: string;
  variants: PlatformOption[];
}) {
  // The server accepts only the signed-in employee as cashier, so offer no one else.
  const employees = useMemo(() => {
    const own = allEmployees.filter((option) => option.id === selfEmployeeId);
    return own.length ? own : allEmployees;
  }, [allEmployees, selfEmployeeId]);
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
  const [cashGiven, setCashGiven] = useState("");
  const [changeDue, setChangeDue] = useState<number | null>(null);
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
        label: shortRef(cart.reference),
        detail: `${cart.lineCount} ${cart.lineCount === 1 ? "line" : "lines"} · ${money(cart.totalCents)}`,
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
      if (result && outcome?.state === "not_found") {
        // The server answered with a refusal and holds no result for this key:
        // nothing is in doubt, so show the reason and free the register.
        clearPendingIntent();
        setMessage(result.message || "Not committed");
        focusScanner();
        return;
      }
      setPendingOutcome(outcome?.state ?? "unknown");
      setPendingCanRetry(Boolean(outcome?.retryable));
      setMessage(
        outcome?.state === "not_found"
          ? "Not committed"
          : outcome?.state === "processing"
            ? "Still processing"
            : result?.message ||
              "Outcome unknown",
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
            ? `${cart.reference} open`
            : "Basket started"),
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
      setMessage(result?.message || "Item added");
    } else {
      const completedSaleId = result?.saleId || outcome?.id || null;
      setSaleId(completedSaleId);
      setChangeDue(intent.tenderedCents != null ? intent.tenderedCents - intent.amountCents : null);
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
          `Sale completed · ${shortRef(outcome?.reference) || "receipt ready"}`,
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
            tenderedCents: intent.tenderedCents,
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
      setMessage("Discarded");
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

  // Cash handed over, in dollars. Empty means the customer paid the exact total.
  const cashGivenCents = /^\d{1,6}(\.\d{0,2})?$/.test(cashGiven.trim()) ? Math.round(Number(cashGiven) * 100) : null;
  const cashTotal = summary?.totalCents ?? 0;
  const cashShort = cashGiven.trim() !== "" && (cashGivenCents === null || cashGivenCents < cashTotal);
  const completeExactCash = () => {
    if (!cartId || !summary || summary.id !== cartId || !summary.linesLoaded)
      return;
    if (cashShort) return;
    beginIntent({
      scope: "completePosSale",
      cartId,
      amountCents: summary.totalCents,
      ...(cashGivenCents !== null && cashGivenCents > summary.totalCents ? { tenderedCents: cashGivenCents } : {}),
      idempotencyKey: operationKey("exact-cash"),
    });
    setCashGiven("");
  };

  useEffect(() => {
    if (!pendingIntent?.idempotencyKey || !restoredIntentRef.current) return;
    restoredIntentRef.current = false;
    checkPendingOutcomeRef.current();
  }, [pendingIntent?.idempotencyKey]);

  const field = "grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground";
  const compact = `${inputClass} h-9 max-sm:h-11`;
  const money = (cents: number) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2);
    }
  };
  const lineCount = summary?.lineCount ?? 0;
  const basketState: { tone: DotTone; label: string } = pendingIntent
    ? { tone: "warn", label: "Awaiting confirmation" }
    : cartId
      ? { tone: "ok", label: shortRef(summary?.reference) || selectedCart?.label || "Basket open" }
      : { tone: "muted", label: "No basket" };

  return (
    <section
      className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]"
      aria-labelledby="fast-checkout-heading"
    >
      <div className={`${panelClass} min-w-0 space-y-4`}>
        <form
          className={`grid min-w-0 gap-3 sm:items-end ${
            variants.length
              ? "sm:grid-cols-[minmax(0,1fr)_10rem_6rem_auto]"
              : "sm:grid-cols-[minmax(0,1fr)_6rem_auto]"
          }`}
          onSubmit={(event) => {
            event.preventDefault();
            addItem();
          }}
        >
          <label className={field}>
            Barcode or PLU
            <input
              ref={scanRef}
              value={scan}
              disabled={Boolean(pendingIntent)}
              onChange={(event) => setScan(event.target.value)}
              autoFocus
              autoComplete="off"
              inputMode="numeric"
              placeholder="Scan, then Enter"
              className={`${inputClass} h-12 font-mono text-base max-sm:h-12`}
            />
          </label>
          {variants.length > 0 ? (
            <label className={field}>
              Item
              <PlatformSelect
                value={selectedVariantId}
                disabled={Boolean(pendingIntent)}
                onValueChange={setVariantId}
                options={variants.map((option) => ({ value: option.id, label: option.label }))}
                className="h-12 rounded-[4px] text-[13px] max-sm:text-base"
              />
            </label>
          ) : null}
          <label className={field}>
            Qty
            <input
              value={quantity}
              disabled={Boolean(pendingIntent)}
              onChange={(event) => setQuantity(event.target.value)}
              inputMode="decimal"
              className={`${inputClass} h-12 text-center font-mono tabular-nums max-sm:h-12`}
            />
          </label>
          <button
            type="submit"
            disabled={pending || Boolean(pendingIntent) || !cartId || (!scan.trim() && !selectedVariantId)}
            className={`${primaryButtonClass} h-12 min-h-12 px-6`}
          >
            Add
          </button>
        </form>

        {pendingIntent ? (
          <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-4" role="status">
            <p className="flex items-baseline gap-2 text-sm font-medium">
              <Dot tone="warn" />
              Action awaiting confirmation
            </p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={checkPendingOutcome} disabled={pending} className={buttonClass}>
                Check result
              </button>
              {pendingCanRetry ? (
                <button type="button" onClick={retryPendingIntent} disabled={pending} className={primaryButtonClass}>
                  Retry same operation
                </button>
              ) : null}
              {pendingOutcome === "not_found" ? (
                <button type="button" onClick={discardUncommittedIntent} disabled={pending} className={dangerButtonClass}>
                  Discard uncommitted action
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="min-w-0 space-y-2 border-t pt-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="fast-checkout-heading" className="text-[14px] font-semibold">
              Register
            </h2>
            <span className="inline-flex items-baseline gap-1.5 text-[13px] text-muted-foreground">
              <Dot tone={basketState.tone} />
              {basketState.label}
            </span>
          </div>
          <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className={field}>
              Basket
              <PlatformSelect
                value={cartId}
                disabled={Boolean(pendingIntent)}
                onValueChange={(next) => {
                  setCartId(next);
                  setSummary(null);
                  setSaleId(null);
                  focusScanner();
                }}
                placeholder="Choose a basket"
                options={carts.map((cart) => ({ value: cart.id, label: cart.detail ? `${cart.label} · ${cart.detail}` : cart.label }))}
                className={"h-9 rounded-[4px] text-[13px] max-sm:h-11 max-sm:text-base"}
              />
            </label>
            <label className={field}>
              Till
              <PlatformSelect
                value={registerSessionId}
                disabled={Boolean(pendingIntent)}
                onValueChange={setRegisterSessionId}
                placeholder="No open till"
                options={registerSessions.map((option) => ({ value: option.id, label: option.label }))}
                className="h-9 rounded-[4px] text-[13px] max-sm:h-11 max-sm:text-base"
              />
            </label>
            <label className={field}>
              Cashier
              <PlatformSelect
                value={cashierId}
                disabled={Boolean(pendingIntent)}
                onValueChange={setCashierId}
                placeholder="No cashier"
                options={employees.map((option) => ({ value: option.id, label: option.label }))}
                className="h-9 rounded-[4px] text-[13px] max-sm:h-11 max-sm:text-base"
              />
            </label>
            <button
              type="button"
              onClick={startBasket}
              disabled={pending || Boolean(pendingIntent) || !registerSessionId || !cashierId}
              className={buttonClass}
            >
              New basket
            </button>
          </div>
        </div>
      </div>

      <aside
        aria-label="Current basket"
        className="flex min-w-0 flex-col rounded-md border bg-background"
      >
        <div className="min-w-0 px-4 pb-4 pt-3">
          <div className="flex items-baseline justify-between gap-3 border-b border-dashed pb-2 text-[12px] text-muted-foreground">
            <span className="break-all font-mono">{shortRef(summary?.reference) || selectedCart?.label || "No basket"}</span>
            <span className="tabular-nums">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {summary?.lines.map((line) => (
              <div key={line.id} className="flex items-start justify-between gap-3 border-b border-dashed py-2 text-xs">
                <div className="min-w-0 font-sans">
                  <p className="break-words font-medium">{line.title}</p>
                  <p className="font-mono text-[12px] tabular-nums text-muted-foreground">
                    {quantityText(line.quantity)}{line.unitOfMeasure && line.unitOfMeasure !== "each" ? ` ${line.unitOfMeasure}` : ""} × {money(line.unitPriceCents)}
                    {line.discountCents ? ` · −${money(line.discountCents)}` : ""}
                    {line.taxCents ? ` · tax ${money(line.taxCents)}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-mono tabular-nums">{money(line.totalCents)}</span>
              </div>
            ))}
            {summary?.lineCount === 0 ? (
              <p className="py-3 font-sans text-xs text-muted-foreground">No items</p>
            ) : null}
            {summary && !summary.linesLoaded ? (
              <div className="space-y-2 py-3 font-sans">
                <p className="flex items-baseline gap-2 text-xs text-amber-700 dark:text-amber-300">
                  <Dot tone="warn" />
                  Item list unavailable. Exact cash is off.
                </p>
                <button type="button" onClick={refreshSelectedCart} disabled={pending} className={buttonClass}>
                  Refresh items
                </button>
              </div>
            ) : null}
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-foreground/70 pt-2">
            <span className="text-[12px] font-medium text-muted-foreground">Total</span>
            <span className="font-mono text-4xl font-medium tabular-nums tracking-tight">{money(summary?.totalCents ?? 0)}</span>
          </div>
        </div>
        <div className="space-y-3 border-t px-4 py-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
            <label className={field}>
              Cash given
              <input
                value={cashGiven}
                onChange={(event) => setCashGiven(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); completeExactCash(); } }}
                inputMode="decimal"
                autoComplete="off"
                placeholder={money(cashTotal)}
                aria-invalid={cashShort || undefined}
                aria-describedby="fast-pos-change"
                className={`${inputClass} h-11 text-base tabular-nums`}
              />
            </label>
            <p id="fast-pos-change" className="pb-2 text-right text-xs text-muted-foreground" aria-live="polite">
              {cashShort ? "Less than the total" : <>Change <span className="block font-mono text-lg font-medium tabular-nums text-foreground">{money(Math.max(0, (cashGivenCents ?? cashTotal) - cashTotal))}</span></>}
            </p>
          </div>
          <button
            type="button"
            onClick={completeExactCash}
            disabled={
              cashShort ||
              pending ||
              Boolean(pendingIntent) ||
              !cartId ||
              summary?.id !== cartId ||
              !summary.linesLoaded ||
              summary.lineCount < 1
            }
            className={`${primaryButtonClass} h-12 w-full`}
          >
            {cashGivenCents !== null && cashGivenCents > cashTotal ? "Take cash" : "Exact cash"}
          </button>
          {saleId && changeDue ? (
            <p className="flex items-baseline justify-between gap-3 border-y border-foreground/70 py-2" role="status">
              <span className="text-sm font-medium">Change due</span>
              <span className="font-mono text-3xl font-medium tabular-nums">{money(changeDue)}</span>
            </p>
          ) : null}
          {saleId ? (
            <a
              href={`/dashboard/platform/pos/receipt/${encodeURIComponent(saleId)}?businessId=${encodeURIComponent(businessId)}&storeId=${encodeURIComponent(storeId)}`}
              className={`${buttonClass} w-full`}
            >
              Open receipt
            </a>
          ) : null}
          <p className="text-center text-xs text-muted-foreground" role="status">
            {pending ? "Posting…" : message}
          </p>
        </div>
      </aside>
    </section>
  );
}

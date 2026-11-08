"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Platform forms post to server actions that redirect back with ?error= or ?notice=, and React resets
 * the form once the action finishes. Without this, a refusal ("A percentage promotion can take at most
 * 100% off") came back over an empty form and the owner retyped everything.
 *
 * On submit the entered values are kept in this tab's sessionStorage; when the page returns with an
 * error they are put back, and a notice (success) or a later visit without an error discards them.
 * Scope, idempotency and password fields are never kept: a retry gets a fresh operation key.
 */
const NEVER_KEPT = new Set(["idempotencyKey", "businessId", "storeId", "timezone", "returnPath"]);
const STORAGE_PREFIX = "platform-form:";
const MAX_AGE_MS = 10 * 60 * 1000;

type Kept = Record<string, string[]>;
const RestoredContext = React.createContext<Kept | null>(null);

/** Custom controls (select, date pickers) keep their value in state; they read the restored value here. */
export function useRestoredValue(name: string | undefined): string | undefined {
  const restored = React.useContext(RestoredContext);
  return name && restored && Object.hasOwn(restored, name) ? restored[name][0] : undefined;
}

function fieldNames(form: HTMLFormElement): string {
  return [...new Set(Array.from(form.elements).map((element) => (element as HTMLInputElement).name).filter(Boolean))].sort().join(",");
}

function keep(form: HTMLFormElement): Kept {
  const kept: Kept = {};
  for (const element of Array.from(form.elements) as HTMLInputElement[]) {
    const { name, type } = element;
    if (!name || NEVER_KEPT.has(name) || type === "password" || type === "file" || type === "submit") continue;
    // Checkbox groups (e.g. assigned stores) share a name: keep each ticked value, and record unticked
    // groups as empty so they come back unticked.
    kept[name] ??= [];
    if ((type === "checkbox" || type === "radio") && !element.checked) continue;
    kept[name].push(element.value);
  }
  return kept;
}

function putBack(form: HTMLFormElement, kept: Kept) {
  for (const element of Array.from(form.elements) as HTMLInputElement[]) {
    const { name, type } = element;
    // Hidden inputs belong to custom controls, which restore through useRestoredValue.
    if (!name || !Object.hasOwn(kept, name) || type === "hidden" || NEVER_KEPT.has(name)) continue;
    if (type === "checkbox" || type === "radio") element.checked = kept[name].includes(element.value);
    else element.value = kept[name][0] ?? "";
  }
}

function OutcomeWatcher({ onChange }: { onChange: (outcome: { error: string | null; notice: string | null }) => void }) {
  const searchParams = useSearchParams();
  const error = searchParams?.get("error") ?? null;
  const notice = searchParams?.get("notice") ?? null;
  React.useEffect(() => onChange({ error, notice }), [error, notice, onChange]);
  return null;
}

export function RetainedForm({
  action,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const pathname = usePathname();
  // Read in a Suspense-wrapped child so no page that renders a form opts out of static rendering.
  const [outcome, setOutcome] = React.useState<{ error: string | null; notice: string | null } | null>(null);
  const error = outcome?.error ?? null;
  const notice = outcome?.notice ?? null;
  const [restored, setRestored] = React.useState<Kept | null>(null);
  const [generation, setGeneration] = React.useState(0);

  const storageKey = React.useCallback(() => {
    const form = formRef.current;
    return form ? `${STORAGE_PREFIX}${pathname}:${fieldNames(form)}` : null;
  }, [pathname]);

  React.useEffect(() => {
    const form = formRef.current;
    const key = storageKey();
    // Until the URL has been read, nothing is known: don't discard what the last submit kept.
    if (!form || !key || !outcome) return;
    let saved: { at: number; values: Kept } | null = null;
    try {
      saved = JSON.parse(window.sessionStorage.getItem(key) || "null");
    } catch {
      saved = null;
    }
    if (!error || !saved || Date.now() - saved.at > MAX_AGE_MS) {
      if (saved) window.sessionStorage.removeItem(key);
      setRestored(null);
      return;
    }
    setRestored(saved.values);
    setGeneration((current) => current + 1);
  }, [outcome, error, notice, storageKey]);

  // After the controls remount with the kept values; React also resets the form when the action
  // settles, so the values go back after that reset too.
  React.useEffect(() => {
    const form = formRef.current;
    if (!form || !restored) return;
    const apply = () => putBack(form, restored);
    apply();
    const onReset = () => window.setTimeout(apply, 0);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [restored, generation]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    const key = storageKey();
    if (!key) return;
    try {
      // Only the form just submitted can be refilled: an older entry from another form on the page is dropped.
      for (const stored of Object.keys(window.sessionStorage)) if (stored.startsWith(STORAGE_PREFIX)) window.sessionStorage.removeItem(stored);
      window.sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), values: keep(event.currentTarget) }));
    } catch {
      // Storage unavailable: the form still submits, it just won't refill after a refusal.
    }
  }

  return (
    <RestoredContext.Provider value={restored}>
      {/* Remount the custom controls once per restore so their state starts from the kept value. */}
      <React.Suspense fallback={null}>
        <OutcomeWatcher onChange={setOutcome} />
      </React.Suspense>
      <form ref={formRef} action={action} onSubmit={onSubmit} className={className}>
        <React.Fragment key={generation}>{children}</React.Fragment>
      </form>
    </RestoredContext.Provider>
  );
}

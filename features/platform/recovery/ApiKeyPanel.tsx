"use client";

import { useActionState, useState } from "react";

import type { PlatformProjection } from "../lib/projection";
import { createOfflineApiKeyAction } from "./api-key-actions";
import { initialApiKeyCreationState } from "./api-key-state";
import { inputClass, panelClass, primaryButtonClass } from "../components/cv-ui";

export function ApiKeyPanel({ projection }: { projection: PlatformProjection }) {
  const [state, action, pending] = useActionState(createOfflineApiKeyAction, initialApiKeyCreationState);
  const [initialIdempotencyKey] = useState(() => `platform-api-key-${crypto.randomUUID()}`);
  const idempotencyKey = state.status === "success" && state.reference
    ? `platform-api-key-after-${state.reference}`
    : initialIdempotencyKey;
  return <section className={panelClass}>
    <h2 className="text-[14px] font-semibold">Issue store-scoped machine key</h2>
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="businessId" value={projection.businessId ?? ""} />
      <input type="hidden" name="storeId" value={projection.storeId ?? ""} />
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Key name<input name="name" required className={inputClass} /></label>
      <label className="grid gap-1 text-xs font-medium text-muted-foreground">Expiry (optional ISO)<input name="expiresAt" className={inputClass} /></label>
      <button disabled={pending} type="submit" className={`${primaryButtonClass} sm:col-span-2`}>{pending ? "Issuing…" : "Issue key"}</button>
    </form>
    {state.status === "error" ? <p role="alert" className="mt-3 border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{state.message}</p> : null}
    {state.status === "success" ? <div className="mt-3 border border-amber-500/40 bg-amber-500/5 p-3">
      <p className="text-xs font-semibold">{state.message}</p>
      <code className="mt-2 block overflow-x-auto whitespace-nowrap border bg-background p-2 text-xs" aria-label="One-time API token">{state.token}</code>
      <p className="mt-2 text-[12px] text-muted-foreground">Public prefix: {state.reference}</p>
    </div> : null}
  </section>;
}

"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";

import { setBasketQuantity } from "../actions";

/** − n + for one item; the count changes at once and the basket follows. */
export function Stepper({ variantId, lineId, quantity, name }: { variantId: string; lineId: string | null; quantity: number; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [shown, setShown] = useOptimistic(quantity);
  const [failed, setFailed] = useState(false);

  const change = (next: number) => {
    const bounded = Math.max(0, Math.min(99, next));
    start(async () => {
      setShown(bounded);
      setFailed(false);
      const form = new FormData();
      form.set("variantId", variantId);
      if (lineId) form.set("lineId", lineId);
      form.set("quantity", String(bounded));
      const result = await setBasketQuantity(form);
      if (!result.ok) setFailed(true);
      router.refresh();
    });
  };

  return (
    <div className="sf-step" data-busy={pending || undefined} data-empty={shown === 0 || undefined}>
      <button type="button" className="sf-step__minus" onClick={() => change(shown - 1)} disabled={shown === 0} aria-label={`One fewer ${name}`}>
        <Minus aria-hidden="true" className="sf-icon" />
      </button>
      <output className="sf-step__n sf-num" aria-live="polite" aria-label={`${shown} ${name} in basket`}>
        {shown}
      </output>
      <button type="button" className="sf-step__plus" onClick={() => change(shown + 1)} disabled={shown >= 99} aria-label={`One more ${name}`}>
        <Plus aria-hidden="true" className="sf-icon" />
      </button>
      {failed ? (
        <span role="alert" className="sf-step__error">
          Not updated
        </span>
      ) : null}
    </div>
  );
}

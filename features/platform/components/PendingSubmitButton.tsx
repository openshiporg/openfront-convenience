"use client";

import { useFormStatus } from "react-dom";

import { primaryButtonClass } from "./cv-ui";

export function PendingSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="pt-1 sm:col-span-2">
      <button type="submit" disabled={pending} aria-disabled={pending} className={primaryButtonClass}>
        {pending ? "Working…" : label}
      </button>
    </div>
  );
}

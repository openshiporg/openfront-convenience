"use client";

import { useFormStatus } from "react-dom";

import { buttonClass } from "../components/cv-ui";

/** Compact submit for a queue row; shows its pending state while the action runs. */
export function QueueSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-disabled={pending} className={`${buttonClass} min-h-8 px-3`}>
      {pending ? "Working…" : label}
    </button>
  );
}

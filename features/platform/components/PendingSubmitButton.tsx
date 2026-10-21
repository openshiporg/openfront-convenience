"use client";

import { useFormStatus } from "react-dom";

export function PendingSubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="h-10 bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:translate-y-px disabled:cursor-wait disabled:opacity-50 sm:col-span-2"
    >
      {pending ? "Working…" : label}
    </button>
  );
}

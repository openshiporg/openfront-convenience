// Local ledger pieces for the store-day pages (reconciliation, exceptions, exports,
// payments, reports, customers, staff, store settings), built from the cv-ui kit:
// a disclosure that keeps entry forms behind an action, a bare table for rows that
// sit inside a ListBand, and the small state words a queue row needs.

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Dot, buttonClass, panelClass, primaryButtonClass, type DotTone } from "../components/cv-ui";

/** Title-line actions: buttons in a row; an opened disclosure takes the full width. */
export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-wrap items-start gap-2">{children}</div>;
}

/** An entry form behind a button. Works without JS; the panel opens below the button. */
export function Disclosure({
  label,
  title,
  primary = false,
  defaultOpen = false,
  children,
}: {
  label: string;
  title?: string;
  primary?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group min-w-0 open:basis-full" open={defaultOpen || undefined}>
      <summary
        className={cn(
          primary ? primaryButtonClass : buttonClass,
          "w-fit cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden",
        )}
      >
        {label}
        <ChevronDown aria-hidden="true" className="size-3.5 opacity-70 transition-transform group-open:rotate-180" />
      </summary>
      <div className={cn(panelClass, "mt-3")}>
        {title ? <h2 className="mb-3 text-[14px] font-semibold text-foreground">{title}</h2> : null}
        {children}
      </div>
    </details>
  );
}

/** A table for rows that already sit inside a bordered ListBand (list shells). */
export function BareTable({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto">
      <table aria-label={label} className="w-full border-collapse text-[13px]">
        {children}
      </table>
    </div>
  );
}

/** A dot and its word; a status color never appears alone. */
export function StateText({ tone, label }: { tone: DotTone; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground">
      <Dot tone={tone} />
      {label}
    </span>
  );
}

/** One line under a section: what is missing and where to fix it. */
export function NoteLine({ tone = "warn", children }: { tone?: DotTone; children: ReactNode }) {
  return (
    <p className="flex min-w-0 items-baseline gap-2 rounded-[4px] border px-3 py-2.5 text-[13px] text-muted-foreground" role="status">
      <Dot tone={tone} />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </p>
  );
}

/** Short/over/balanced from signed variance cents. */
export function varianceState(cents: number): { tone: DotTone; label: string } {
  if (cents < 0) return { tone: "danger", label: "Short" };
  if (cents > 0) return { tone: "warn", label: "Over" };
  return { tone: "ok", label: "Balanced" };
}

/** Elapsed time since a moment, e.g. "12m", "5h", "3d". */
export function ageText(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "—";
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60_000));
  if (!Number.isFinite(minutes)) return "—";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Signed cents from a projection figure such as "-1234 cents variance". */
export function centsOf(value: string | null | undefined): number | null {
  const match = /^(-?\d+) cents?\b/.exec((value ?? "").trim());
  return match ? Number(match[1]) : null;
}

/** "-1234" cents as "−$12.34" / "+$12.34" with the currency. */
export function signedMoney(cents: number, format: (cents: number) => string): string {
  if (cents === 0) return format(0);
  return `${cents < 0 ? "−" : "+"}${format(Math.abs(cents))}`;
}

// Local pieces for the regulated store-day pages (fuel, lottery, money services,
// loyalty, promotions, restricted sales), built from the locked cv-ui kit:
// an action that opens its form in place, a prerequisite notice, and small
// money/time helpers that read the projection's display strings.

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { Dot, buttonClass, panelClass, primaryButtonClass, type DotTone } from "../components/cv-ui";

/** A row of actions; an opened action takes the full row beneath its button. */
export function ActionBar({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-wrap items-start gap-2">
      {children}
    </div>
  );
}

/** A button that opens its form in place. Works without JS (`<details>`). */
export function ActionDisclosure({
  label,
  primary = false,
  id,
  children,
}: {
  label: string;
  primary?: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <details id={id} className="group min-w-0 open:basis-full">
      <summary
        className={cn(
          primary ? primaryButtonClass : buttonClass,
          "w-fit cursor-pointer list-none select-none [&::-webkit-details-marker]:hidden",
        )}
      >
        {label}
        <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className={cn(panelClass, "mt-2")}>{children}</div>
    </details>
  );
}

/** A missing prerequisite: what is missing, in words, and where to fix it. */
export function PrereqNotice({
  title,
  items,
  tone = "warn",
  children,
}: {
  title: string;
  items?: Array<{ label: string; fix?: ReactNode }>;
  tone?: DotTone;
  children?: ReactNode;
}) {
  return (
    <section aria-label={title} className="min-w-0 rounded-md border border-dashed border-foreground/30 bg-background px-4 py-4">
      <h2 className="flex items-baseline gap-2 text-[14px] font-semibold text-foreground">
        <Dot tone={tone} />
        {title}
      </h2>
      {items?.length ? (
        <ul className="mt-3 grid min-w-0 gap-2">
          {items.map((item) => (
            <li key={item.label} className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[13px]">
              <span className="flex min-w-0 items-baseline gap-2 text-foreground">
                <Dot tone="danger" />
                {item.label}
              </span>
              {item.fix}
            </li>
          ))}
        </ul>
      ) : null}
      {children ? <div className="mt-3 min-w-0">{children}</div> : null}
    </section>
  );
}

/** "$1,234.56" / "-$1.00" / "$-1.00 variance" → cents. */
export function parseMoney(text: string | null | undefined): number | null {
  const match = /(-)?\s*[^\d\s-]*\s*(-)?\s*([\d,]+(?:\.\d+)?)/.exec(text ?? "");
  if (!match) return null;
  const value = Math.round(Number(match[3].replaceAll(",", "")) * 100);
  if (!Number.isFinite(value)) return null;
  return match[1] || match[2] ? -value : value;
}

export function money(cents: number, currency: string | null | undefined): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(2);
  }
}

function dayKey(value: Date, timeZone: string | null | undefined): string {
  try {
    return value.toLocaleDateString("en-CA", { timeZone: timeZone || "UTC" });
  } catch {
    return value.toISOString().slice(0, 10);
  }
}

/** Whether an ISO time falls on today's trading date in the store's timezone. */
export function isToday(value: string | null | undefined, timeZone: string | null | undefined): boolean {
  if (!value) return false;
  return dayKey(new Date(value), timeZone) === dayKey(new Date(), timeZone);
}

/** Store-clock time, short. */
export function When({ value, timeZone }: { value: string | null | undefined; timeZone: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  let text = value;
  try {
    text = new Date(value).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short", timeZone: timeZone || "UTC" });
  } catch {}
  return (
    <time dateTime={value} className="whitespace-nowrap font-mono text-[12px] tabular-nums text-muted-foreground">
      {text}
    </time>
  );
}

/** A status word with a dot in an explicit tone, for states the shared map doesn't know. */
export function ToneText({ tone, children }: { tone: DotTone; children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground">
      <Dot tone={tone} />
      {children}
    </span>
  );
}

/** A quiet line for a queue that is clear. */
export function QueueClear({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-baseline gap-2 rounded-md border px-4 py-3 text-[13px] text-muted-foreground" role="status">
      <Dot tone="ok" />
      {children}
    </p>
  );
}

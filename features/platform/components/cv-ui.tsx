// Convenience platform kit: the till-tape look shared by every platform page.
// Raised pills in recessed tracks, title-line status dots, hairline list bands
// and mono figures, built on the dashboard's own tokens so pages sit naturally
// in the shared shell in light and dark.

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const DOT_TONES = {
  ok: "bg-emerald-500 dark:bg-emerald-400",
  warn: "bg-amber-500 dark:bg-amber-400",
  danger: "bg-red-500 dark:bg-red-400",
  info: "bg-sky-500 dark:bg-sky-400",
  muted: "bg-zinc-400 dark:bg-zinc-500",
} as const;

export type DotTone = keyof typeof DOT_TONES;

/** Server metric and row tones mapped onto dot tones. */
export function toneOf(value: string | null | undefined): DotTone {
  const v = (value ?? "").toLowerCase();
  if (["positive", "ok", "success"].includes(v)) return "ok";
  if (["attention", "warning"].includes(v)) return "warn";
  if (["critical", "negative", "danger"].includes(v)) return "danger";
  return "muted";
}

const STATUS_TONES: Array<[RegExp, DotTone]> = [
  [/(fail|error|reject|void|cancel|expired|destroy|critical|short|breach|blocked|disabled|denied|abandon)/, "danger"],
  [/(out_of_date|review|pending|draft|held|open|counting|submitted|progress|partial|attention|queued|retry|suspend|closing|unsettled|flagged|in_transit|shipped)/, "warn"],
  [/(complete|locked|approved|active|posted|received|captured|settled|resolved|published|verified|delivered|paid|closed|ready|succeeded|live)/, "ok"],
];

/** Tone for a record status such as `in_review` or `locked`. */
export function statusTone(status: string): DotTone {
  const v = status.toLowerCase();
  for (const [pattern, tone] of STATUS_TONES) if (pattern.test(v)) return tone;
  return "muted";
}

export const statusLabel = (status: string) => {
  const text = status.replaceAll("_", " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "—";
};

/** 8px dot meant to sit on a title line: give the parent `items-baseline`. */
export function Dot({ tone = "muted", className }: { tone?: DotTone; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-2 shrink-0 translate-y-[-0.1em] rounded-full", DOT_TONES[tone], className)}
    />
  );
}

export function StatusText({ status }: { status: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
      <Dot tone={statusTone(status)} />
      {statusLabel(status)}
    </span>
  );
}

// Controls ------------------------------------------------------------------

export const trackClass =
  "inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-muted p-[3px] shadow-[inset_0_1px_2px_rgb(0_0_0/0.07)] [scrollbar-width:none] dark:bg-muted/60";

export const pillClass =
  "inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50 data-[active=true]:bg-background data-[active=true]:text-foreground data-[active=true]:shadow-[0_1px_2px_rgb(0_0_0/0.14),0_0_0_0.5px_rgb(0_0_0/0.06)] dark:data-[active=true]:bg-zinc-800 max-sm:min-h-10";

/** Primary action: the raised pill sitting in its own recessed track. */
export const primaryButtonClass =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background shadow-[0_1px_2px_rgb(0_0_0/0.2),inset_0_1px_0_rgb(255_255_255/0.12)] ring-[3px] ring-muted transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-px disabled:cursor-wait disabled:opacity-50 max-sm:min-h-11";

/** Secondary action: a raised white pill in a recessed track. */
export const buttonClass =
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-background px-4 text-sm font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.08)] ring-[3px] ring-muted transition hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-px disabled:opacity-50 dark:bg-zinc-800 max-sm:min-h-11";

export const dangerButtonClass =
  "inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-background px-4 text-sm font-medium text-destructive shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_rgb(0_0_0/0.08)] ring-[3px] ring-muted transition hover:bg-destructive/5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring active:translate-y-px disabled:opacity-50 dark:bg-zinc-800 max-sm:min-h-11";

export const inputClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-sm font-normal text-foreground shadow-[inset_0_1px_1px_rgb(0_0_0/0.04)] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:opacity-60 max-sm:h-11";

export const labelClass = "grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground";

export const panelClass =
  "min-w-0 rounded-2xl border bg-background p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:p-5";

export const wellClass =
  "min-w-0 rounded-2xl bg-muted/45 p-1 shadow-[inset_0_1px_2px_rgb(0_0_0/0.05)] ring-1 ring-inset ring-border/60";

export function Track({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className={cn(trackClass, className)}>
      {children}
    </div>
  );
}

export function Count({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{children ?? 0}</span>;
}

// Layout --------------------------------------------------------------------

export function SectionTitle({ children, meta, id }: { children: ReactNode; meta?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className="text-sm font-semibold text-foreground">
        {children}
      </h2>
      {meta ? <span className="font-mono text-xs tabular-nums text-muted-foreground">{meta}</span> : null}
    </div>
  );
}

/** One recessed band with hairline rows, instead of stacked cards. */
export function ListBand({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "min-w-0 divide-y divide-border/70 overflow-hidden rounded-2xl bg-muted/35 shadow-[inset_0_1px_2px_rgb(0_0_0/0.04)] ring-1 ring-inset ring-border/60",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Panels laid out two up on wide screens. */
export function PanelGrid({ children, columns = 2 }: { children: ReactNode; columns?: 1 | 2 | 3 }) {
  return (
    <div
      className={cn(
        "grid min-w-0 items-start gap-4",
        columns === 2 && "xl:grid-cols-2",
        columns === 3 && "lg:grid-cols-2 2xl:grid-cols-3",
      )}
    >
      {children}
    </div>
  );
}

/**
 * Cents strings from the server ("1234 cents net") read as amounts. Rows carry
 * no currency, so the amount is shown without a symbol.
 */
export function formatMeasure(value: string): string {
  const match = /^(-?\d+) cents?\b\s*(.*)$/.exec(value.trim());
  if (!match) return value;
  const amount = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    Number(match[1]) / 100,
  );
  return match[2] ? `${amount} ${match[2]}` : amount;
}

/** Radio choices as raised pills in a recessed track; works without JS. */
export function SegmentedRadio({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: Array<{ value: string; label: string; tone?: DotTone }>;
  defaultValue?: string;
}) {
  return (
    <fieldset className="grid min-w-0 gap-1.5">
      <legend className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</legend>
      <div className={trackClass}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              pillClass,
              "cursor-pointer has-[:checked]:bg-background has-[:checked]:text-foreground has-[:checked]:shadow-[0_1px_2px_rgb(0_0_0/0.14),0_0_0_0.5px_rgb(0_0_0/0.06)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring dark:has-[:checked]:bg-zinc-800",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              className="sr-only"
            />
            {option.tone ? <Dot tone={option.tone} className="translate-y-0" /> : null}
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Convenience platform kit: the shift log and the safe-drop envelope.
// Underline tabs, square 4px controls, flat hairline lists and tables, ruled
// count boxes for expected/counted/variance, and mono figures, built on the
// dashboard's own tokens so pages sit naturally in the shared shell in light and dark.

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

export const DOT_TONES = {
  ok: "bg-emerald-600 dark:bg-emerald-400",
  warn: "bg-amber-600 dark:bg-amber-400",
  danger: "bg-red-600 dark:bg-red-400",
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
  [/(out_of_date|review|pending|draft|held|counting|submitted|progress|partial|attention|queued|retry|suspend|closing|unsettled|flagged|in_transit|shipped)/, "warn"],
  [/(^open$|_open$|opened)/, "info"],
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
      className={cn("inline-block size-2 shrink-0 translate-y-[-0.1em] rounded-[1px]", DOT_TONES[tone], className)}
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
  "flex max-w-full items-stretch gap-0 overflow-x-auto border-b border-border [scrollbar-width:none]";

export const pillClass =
  "-mb-px inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent px-3 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50 data-[active=true]:border-foreground data-[active=true]:text-foreground aria-selected:border-foreground aria-selected:text-foreground max-sm:min-h-10";

/** Primary action: a flat ink button with 4px corners. */
export const primaryButtonClass =
  "inline-flex min-h-9 items-center justify-center gap-2 rounded-[4px] bg-foreground px-4 text-[13px] font-semibold text-background transition hover:bg-foreground/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-50 max-sm:min-h-11";

/** Secondary action: an outlined button with 4px corners. */
export const buttonClass =
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-[4px] border border-input bg-background px-3.5 text-[13px] font-medium text-foreground transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 max-sm:min-h-11";

export const dangerButtonClass =
  "inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-[4px] border border-destructive/40 bg-background px-3.5 text-[13px] font-medium text-destructive transition hover:bg-destructive/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 max-sm:min-h-11";

export const inputClass =
  "h-9 w-full min-w-0 rounded-[4px] border border-input bg-background px-3 text-[13px] font-normal text-foreground placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:opacity-60 max-sm:h-11 max-sm:text-base";

export const labelClass = "grid min-w-0 gap-1.5 text-xs font-medium text-muted-foreground";

export const panelClass =
  "min-w-0 rounded-md border bg-background p-4";

export const wellClass =
  "min-w-0 rounded-md border bg-muted/30 p-1";

export function Track({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className={cn(trackClass, className)}>
      {children}
    </div>
  );
}

export function Count({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[12px] tabular-nums text-muted-foreground">{children ?? 0}</span>;
}

// Layout --------------------------------------------------------------------

export function SectionTitle({ children, meta, id }: { children: ReactNode; meta?: ReactNode; id?: string }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 border-b border-foreground/15 pb-2">
      <h2 id={id} className="text-[14px] font-semibold text-foreground">
        {children}
      </h2>
      {meta ? <span className="font-mono text-xs tabular-nums text-muted-foreground">{meta}</span> : null}
    </div>
  );
}

/** A flat bordered list with hairline rows, instead of stacked cards. */
export function ListBand({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "min-w-0 divide-y divide-border overflow-hidden rounded-md border bg-background",
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

/** Radio choices as underline tabs; works without JS. */
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
              "cursor-pointer has-[:checked]:border-foreground has-[:checked]:text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
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

// Count boxes ----------------------------------------------------------------

/**
 * Ruled figure boxes, like the fields on a safe-drop envelope: expected, counted, over/short.
 * A `variance` box turns red pencil when short (negative) and green when balanced (zero).
 */
export function CountBoxes({
  items,
  columns,
  className,
}: {
  items: Array<{ label: ReactNode; value: ReactNode; variance?: number | null; note?: ReactNode }>;
  /**
   * A `grid-template-columns` value used from lg up, so the strip can share the
   * page's column grid (e.g. one track per key figure under a table of the same width).
   */
  columns?: string;
  className?: string;
}) {
  return (
    <dl
      style={columns ? ({ "--cv-count-cols": columns } as CSSProperties) : undefined}
      className={cn(
        "grid min-w-0 grid-cols-2 border-l border-t border-foreground/70 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]",
        columns && "lg:[grid-template-columns:var(--cv-count-cols)]",
        className,
      )}
    >
      {items.map((item, index) => {
        const v = item.variance;
        const tone = v == null ? "" : v < 0 ? "text-[oklch(0.52_0.19_27)] dark:text-red-400" : v === 0 ? "text-emerald-700 dark:text-emerald-400" : "text-foreground";
        return (
          <div key={index} className="min-w-0 border-b border-r border-foreground/70 bg-[oklch(0.975_0.018_80)] px-3 pb-2 pt-1.5 dark:bg-muted/30">
            <dt className="border-b border-dashed border-foreground/25 pb-1 text-[12px] text-muted-foreground">{item.label}</dt>
            <dd className={cn("pt-1.5 font-mono text-xl font-medium tabular-nums tracking-tight", tone)}>{item.value}</dd>
            {item.note ? <dd className="mt-0.5 truncate text-[12px] text-muted-foreground">{item.note}</dd> : null}
          </div>
        );
      })}
    </dl>
  );
}

// Tables ---------------------------------------------------------------------

/** Dense table in a bordered panel. Column `priority` 2 hides under md, 3 under lg. */
export function DataTable({ className, children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-auto rounded-md border bg-background">
      <table className={cn("w-full border-collapse text-[13px]", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

const PRIORITY = { 1: "", 2: "max-md:hidden", 3: "max-lg:hidden" } as const;

export function Th({
  className,
  align = "left",
  priority = 1,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right"; priority?: 1 | 2 | 3 }) {
  return (
    <th
      scope="col"
      className={cn(
        "sticky top-0 z-[1] h-9 whitespace-nowrap border-b bg-muted/60 px-3 text-[12px] font-medium text-muted-foreground first:pl-4 last:pr-4",
        align === "right" ? "text-right" : "text-left",
        PRIORITY[priority],
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  align = "left",
  priority = 1,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "right"; priority?: 1 | 2 | 3 }) {
  return (
    <td
      className={cn("h-9 px-3 py-2 align-middle first:pl-4 last:pr-4", align === "right" && "text-right font-mono tabular-nums", PRIORITY[priority], className)}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("border-b transition-colors last:border-b-0 hover:bg-muted/40", className)} {...props} />;
}

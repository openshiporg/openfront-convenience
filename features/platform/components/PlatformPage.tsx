import { randomUUID } from "node:crypto";
import type { ComponentProps, ReactNode } from "react";

import { PageContainer } from "@/features/dashboard/components/PageContainer";

import type { PlatformOption, PlatformProjection } from "../lib/projection";
import {
  Dot,
  ListBand,
  SectionTitle,
  StatusText,
  buttonClass,
  formatMeasure,
  inputClass,
  labelClass,
  panelClass,
  toneOf,
  trackClass,
  type DotTone,
} from "./cv-ui";
import { PendingSubmitButton } from "./PendingSubmitButton";
import {
  centsToInput,
  isDateTimeField,
  isMillsField,
  isMoneyField,
  millsToInput,
} from "../lib/form-values";

export function PlatformPage({
  title,
  projection,
  error,
  notice,
  children,
  businessOnly = false,
  showMetrics = true,
  state,
}: {
  title: string;
  description?: string;
  projection: PlatformProjection | null;
  error: string;
  notice: string;
  children: ReactNode;
  businessOnly?: boolean;
  showMetrics?: boolean;
  state?: { tone: DotTone; label: string } | null;
}) {
  const breadcrumbs = [
    { type: "link" as const, label: "Dashboard", href: "/dashboard" },
    { type: "page" as const, label: "Platform" },
    { type: "page" as const, label: title },
  ];
  const metrics = projection?.metrics ?? [];
  const storeLabel =
    projection?.stores.find((option) => option.id === projection.storeId)?.label ??
    projection?.businesses.find((option) => option.id === projection.businessId)?.label;
  const needsAttention = metrics.some(
    (metric) => toneOf(metric.tone) !== "muted" && toneOf(metric.tone) !== "ok" && metric.value !== "0",
  );
  const titleState =
    state ?? (storeLabel ? { tone: (needsAttention ? "warn" : "ok") as DotTone, label: storeLabel } : null);
  const header = (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]">{title}</h1>
        {titleState ? (
          <span className="inline-flex min-w-0 items-baseline gap-1.5 text-sm text-muted-foreground">
            <Dot tone={titleState.tone} />
            <span className="[overflow-wrap:anywhere]">{titleState.label}</span>
          </span>
        ) : null}
      </div>
      {projection?.businessId ? <ScopeFilter projection={projection} businessOnly={businessOnly} /> : null}
    </div>
  );
  return (
    <PageContainer title={title} header={header} breadcrumbs={breadcrumbs}>
      {/* Extra bottom room on phones so the floating assistant button never covers content. */}
      <div className="min-w-0 space-y-6 px-4 pb-10 max-sm:pb-28 md:px-6">
        {error ? (
          <p
            role="alert"
            className="flex items-baseline gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            <Dot tone="danger" />
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="flex items-baseline gap-2 rounded-xl border border-emerald-600/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300"
          >
            <Dot tone="ok" />
            {notice}
          </p>
        ) : null}
        {!projection?.businessId && !error ? (
          <EmptyState title="You don't have access to a store yet" detail="" />
        ) : (
          <>
            {showMetrics && metrics.length ? <MetricsBand metrics={metrics} /> : null}
            {children}
          </>
        )}
      </div>
    </PageContainer>
  );
}

export function MetricsBand({ metrics }: { metrics: PlatformProjection["metrics"] }) {
  return (
    <dl
      className={`grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border/70 ring-1 ring-border/70 ${
        metrics.length % 3 === 0 ? "md:grid-cols-3 2xl:grid-cols-6" : "md:grid-cols-4"
      }`}
    >
      {metrics.map((metric) => {
        const tone = toneOf(metric.tone);
        return (
          <div key={metric.label} className="min-w-0 bg-background px-4 py-3.5">
            <dt className="flex items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
              {tone !== "muted" && metric.value !== "0" ? <Dot tone={tone} /> : null}
              <span className="truncate">{metric.label}</span>
            </dt>
            <dd className="mt-1 font-mono text-2xl font-medium tabular-nums tracking-tight text-foreground [overflow-wrap:anywhere]">
              {formatMeasure(metric.value)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function ScopeFilter({ projection, businessOnly }: { projection: PlatformProjection; businessOnly: boolean }) {
  const showBusiness = projection.businesses.length > 1;
  const showStore = !businessOnly && projection.stores.length > 0;
  if (!showBusiness && !showStore) return null;
  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      {showBusiness ? (
        <ScopeSelect label="Business" name="businessId" value={projection.businessId} options={projection.businesses} />
      ) : null}
      {showStore ? (
        <ScopeSelect
          label="Store"
          name="storeId"
          value={projection.storeId}
          options={projection.stores}
          keep={{ businessId: projection.businessId ?? "" }}
        />
      ) : null}
    </div>
  );
}

function ScopeSelect({
  label,
  name,
  value,
  options,
  keep = {},
}: {
  label: string;
  name: string;
  value: string | null;
  options: PlatformOption[];
  keep?: Record<string, string>;
}) {
  return (
    <form method="get" className={`${trackClass} min-w-0`}>
      {Object.entries(keep).map(([key, keepValue]) => (
        <input key={key} type="hidden" name={key} value={keepValue} />
      ))}
      <label className="sr-only" htmlFor={`scope-${name}`}>
        {label}
      </label>
      <select
        id={`scope-${name}`}
        name={name}
        defaultValue={value ?? ""}
        className="h-8 min-w-0 max-w-56 truncate rounded-full border-0 bg-background px-3 text-[13px] font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.14)] focus-visible:outline-2 focus-visible:outline-ring dark:bg-zinc-800 max-sm:h-10"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="inline-flex min-h-8 items-center rounded-full px-3 text-[13px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring max-sm:min-h-10"
      >
        {label === "Business" ? "Switch" : "Apply"}
      </button>
    </form>
  );
}

/** Times shown in the store's timezone, the same clock the receipt uses. */
function storeTime(value: string, timeZone: string | null | undefined): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };
  try {
    return new Date(value).toLocaleString("en-US", { ...options, timeZone: timeZone || "UTC" });
  } catch {
    return new Date(value).toLocaleString("en-US", { ...options, timeZone: "UTC" });
  }
}

export function EvidenceTable({
  rows,
  title = "Recent activity",
  timeZone,
}: {
  rows: PlatformProjection["rows"];
  title?: string;
  timeZone?: string | null;
}) {
  return (
    <section className="min-w-0" aria-label={title}>
      <SectionTitle meta={rows.length || undefined}>{title}</SectionTitle>
      {rows.length ? (
        <ListBand>
          {rows.map((row) => (
            <article
              key={row.id}
              className="grid min-w-0 gap-x-6 gap-y-1 bg-background/60 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <h3 className="min-w-0 text-sm font-medium text-foreground [overflow-wrap:anywhere]">{row.title}</h3>
                  {row.status ? <StatusText status={row.status} /> : null}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {row.detail || "—"}
                  {row.occurredAt ? (
                    <>
                      {" · "}
                      <time dateTime={row.occurredAt}>{storeTime(row.occurredAt, timeZone)}</time>
                    </>
                  ) : null}
                </p>
              </div>
              <p className="min-w-0 self-center font-mono text-sm tabular-nums text-foreground sm:text-right [overflow-wrap:anywhere]">
                {row.metric ? formatMeasure(row.metric) : ""}
              </p>
            </article>
          ))}
        </ListBand>
      ) : (
        <EmptyState title="Nothing recorded yet" detail="" />
      )}
    </section>
  );
}

export function ActionPanel({
  title,
  children,
  tone,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  tone?: DotTone;
}) {
  return (
    <section className={panelClass}>
      <h3 className="flex items-baseline gap-2 text-[15px] font-semibold tracking-tight text-foreground">
        {tone ? <Dot tone={tone} /> : null}
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function FormGrid({
  children,
  action,
  submit = "Save",
}: {
  children: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  submit?: string;
}) {
  return (
    <form action={action} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <input type="hidden" name="idempotencyKey" value={`platform-${randomUUID()}`} />
      {children}
      <PendingSubmitButton label={submit} />
    </form>
  );
}

export function HiddenScope({ projection, returnPath }: { projection: PlatformProjection; returnPath: string }) {
  return (
    <>
      <input type="hidden" name="businessId" value={projection.businessId ?? ""} />
      <input type="hidden" name="storeId" value={projection.storeId ?? ""} />
      <input type="hidden" name="timezone" value={projection.timezone ?? ""} />
      <input type="hidden" name="returnPath" value={returnPath} />
    </>
  );
}

export function SelectField({
  label,
  name,
  options,
  placeholder = "Select",
  ...props
}: {
  label: string;
  name: string;
  options: PlatformOption[];
  placeholder?: string;
} & Omit<ComponentProps<"select">, "name" | "children">) {
  return (
    <label className={labelClass}>
      {label}
      <select name={name} required className={inputClass} {...props}>
        <option value="">{options.length ? placeholder : "None available"}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
            {option.detail ? ` · ${option.detail}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EnumField({
  label,
  name,
  values,
  defaultValue,
}: {
  label: string;
  name: string;
  values: Array<{ value: string; label: string }>;
  defaultValue?: string;
}) {
  return (
    <label className={labelClass}>
      {label}
      <select name={name} defaultValue={defaultValue} className={inputClass}>
        {values.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const UNIT_SUFFIX = /\s*\((?:signed\s+)?cents[^)]*\)|\s*\((?:exact\s+)?ISO[^)]*\)|\s*\(optional ISO\)/gi;

/** Field labels lose their unit notes; "optional" survives. */
function plainLabel(label: string): string {
  const optional = /optional/i.test(label.match(/\(([^)]*)\)/g)?.join(" ") ?? "");
  const text = label.replace(UNIT_SUFFIX, "").replace(/^Mills per gallon$/i, "Price per gallon").trim();
  return optional && !/optional/i.test(text) ? `${text} (optional)` : text;
}

export function TextField({
  label,
  name,
  className,
  ...props
}: { label: string; name: string } & Omit<ComponentProps<"input">, "name">) {
  // Amounts, fuel prices and times are typed the way a merchant reads them;
  // the server action converts them back (lib/form-values).
  if (isMoneyField(name) || isMillsField(name)) {
    const mills = isMillsField(name);
    // The dollar input sets its own type, range and placeholder.
    const rest: ComponentProps<"input"> = { ...props };
    for (const key of ["type", "min", "max", "step", "defaultValue", "placeholder"] as const) delete rest[key];
    const defaultValue = props.defaultValue;
    const numeric = defaultValue === undefined || defaultValue === "" ? undefined : Number(defaultValue);
    return (
      <label className={labelClass}>
        {plainLabel(label)}
        <span className="relative flex min-w-0 items-center">
          <span aria-hidden="true" className="pointer-events-none absolute left-3 font-mono text-sm text-muted-foreground">
            $
          </span>
          <input
            name={name}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder={mills ? "3.599" : "0.00"}
            defaultValue={
              numeric === undefined || !Number.isFinite(numeric)
                ? undefined
                : mills
                  ? millsToInput(numeric)
                  : centsToInput(numeric)
            }
            className={`${inputClass} pl-7 font-mono tabular-nums ${className ?? ""}`}
            {...rest}
          />
          {mills ? (
            <span aria-hidden="true" className="pointer-events-none absolute right-3 text-xs text-muted-foreground">
              /gal
            </span>
          ) : null}
        </span>
      </label>
    );
  }
  if (isDateTimeField(name)) {
    const rest: ComponentProps<"input"> = { ...props };
    delete rest.type;
    delete rest.placeholder;
    return (
      <label className={labelClass}>
        {plainLabel(label)}
        <input name={name} type="datetime-local" className={`${inputClass} font-mono tabular-nums ${className ?? ""}`} {...rest} />
      </label>
    );
  }
  return (
    <label className={labelClass}>
      {label}
      <input
        name={name}
        className={`${inputClass} ${props.type === "number" || props.inputMode === "decimal" || props.inputMode === "numeric" ? "font-mono tabular-nums" : ""} ${className ?? ""}`}
        {...props}
      />
    </label>
  );
}

/** A GET lookup that keeps the page's other search values. */
export function LookupForm({
  action,
  keep,
  name,
  label,
  placeholder,
  defaultValue,
  submit,
  empty,
}: {
  action: string;
  keep: Record<string, string | null | undefined>;
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string | null;
  submit: string;
  empty?: string | false;
}) {
  return (
    <section aria-label={label} className="min-w-0 space-y-2">
      <form action={action} method="get" className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        {Object.entries(keep).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value ?? ""} />
        ))}
        <label className={labelClass}>
          {label}
          <input
            type="search"
            name={name}
            minLength={2}
            maxLength={80}
            autoComplete="off"
            defaultValue={defaultValue ?? ""}
            placeholder={placeholder}
            className={inputClass}
          />
        </label>
        <button type="submit" className={buttonClass}>
          {submit}
        </button>
      </form>
      {empty ? (
        <p className="flex items-baseline gap-2 text-sm text-muted-foreground" role="status">
          <Dot tone="muted" />
          {empty}
        </p>
      ) : null}
    </section>
  );
}

export function EmptyState({ title }: { title: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-dashed px-4 py-10 text-center">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
    </div>
  );
}

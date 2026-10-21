import { randomUUID } from "node:crypto";
import type { ComponentProps, ReactNode } from "react";

import { PageContainer } from "@/features/dashboard/components/PageContainer";

import type { PlatformOption, PlatformProjection } from "../lib/projection";
import { PendingSubmitButton } from "./PendingSubmitButton";

export function PlatformPage({
  title,
  description,
  projection,
  error,
  notice,
  children,
  businessOnly = false,
}: {
  title: string;
  description: string;
  projection: PlatformProjection | null;
  error: string;
  notice: string;
  children: ReactNode;
  businessOnly?: boolean;
}) {
  const breadcrumbs = [
    { type: "link" as const, label: "Dashboard", href: "/dashboard" },
    { type: "page" as const, label: "Platform" },
    { type: "page" as const, label: title },
  ];
  const header = (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50 [overflow-wrap:anywhere]">
          {title}
        </h1>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {projection?.businessId ? (
        <ScopeFilter projection={projection} businessOnly={businessOnly} />
      ) : null}
    </div>
  );
  return (
    <PageContainer title={title} header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 space-y-7 px-4 pb-8 md:px-6">
        {error ? (
          <p
            role="alert"
            className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="border border-emerald-700/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300"
          >
            {notice}
          </p>
        ) : null}
        {!projection?.businessId && !error ? (
          <EmptyState
            title="You don't have access to a store yet"
            detail="Ask the store owner to add you as an employee."
          />
        ) : (
          children
        )}
      </div>
    </PageContainer>
  );
}

function ScopeFilter({
  projection,
  businessOnly,
}: {
  projection: PlatformProjection;
  businessOnly: boolean;
}) {
  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-2">
      <form
        method="get"
        className="grid min-w-0 grid-cols-[minmax(150px,1fr)_auto] gap-2"
      >
        <label className="grid gap-1 text-xs font-medium text-muted-foreground">
          Business
          <select
            name="businessId"
            defaultValue={projection.businessId ?? ""}
            className="h-9 min-w-0 border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {projection.businesses.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-9 self-end border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
        >
          Switch
        </button>
      </form>
      {!businessOnly ? (
        <form
          method="get"
          className="grid min-w-0 grid-cols-[minmax(150px,1fr)_auto] gap-2"
        >
          <input
            type="hidden"
            name="businessId"
            value={projection.businessId ?? ""}
          />
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Store
            <select
              name="storeId"
              defaultValue={projection.storeId ?? ""}
              className="h-9 min-w-0 border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {projection.stores.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="h-9 self-end border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          >
            Apply
          </button>
        </form>
      ) : null}
    </div>
  );
}

export function EvidenceTable({
  rows,
  title = "Recent activity",
}: {
  rows: PlatformProjection["rows"];
  title?: string;
}) {
  return (
    <section className="min-w-0 space-y-3" aria-labelledby="activity-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="activity-heading" className="text-lg font-semibold">
            {title}
          </h2>
        </div>
      </div>
      {rows.length ? (
        <div className="min-w-0 border">
          <div className="hidden grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(100px,.6fr)_minmax(120px,.7fr)] border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>Record</span>
            <span>Detail</span>
            <span>Status</span>
            <span className="text-right">Measure</span>
          </div>
          <div className="divide-y">
            {rows.map((row) => (
              <article
                key={row.id}
                className="grid min-w-0 gap-2 px-4 py-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(100px,.6fr)_minmax(120px,.7fr)] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{row.title}</p>
                  {row.occurredAt ? (
                    <time
                      className="text-xs text-muted-foreground"
                      dateTime={row.occurredAt}
                    >
                      {new Date(row.occurredAt).toLocaleString()}
                    </time>
                  ) : null}
                </div>
                <p className="min-w-0 text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {row.detail || "—"}
                </p>
                <p>
                  <Status value={row.status} />
                </p>
                <p className="min-w-0 text-sm font-medium tabular-nums md:text-right [overflow-wrap:anywhere]">
                  {row.metric}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="Nothing recorded yet"
          detail="Activity for the selected store appears here."
        />
      )}
    </section>
  );
}

export function ActionPanel({
  title,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0 border bg-background p-4 sm:p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function FormGrid({
  children,
  action,
  submit = "Run operation",
}: {
  children: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  submit?: string;
}) {
  return (
    <form action={action} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <input
        type="hidden"
        name="idempotencyKey"
        value={`platform-${randomUUID()}`}
      />
      {children}
      <PendingSubmitButton label={submit} />
    </form>
  );
}

export function HiddenScope({
  projection,
  returnPath,
}: {
  projection: PlatformProjection;
  returnPath: string;
}) {
  return (
    <>
      <input
        type="hidden"
        name="businessId"
        value={projection.businessId ?? ""}
      />
      <input type="hidden" name="storeId" value={projection.storeId ?? ""} />
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
    <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        name={name}
        required
        className="h-10 min-w-0 border bg-background px-2 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...props}
      >
        <option value="">{placeholder}</option>
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
    <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        className="h-10 min-w-0 border bg-background px-2 text-sm font-normal text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {values.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TextField({
  label,
  name,
  ...props
}: { label: string; name: string } & Omit<ComponentProps<"input">, "name">) {
  return (
    <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <input
        name={name}
        className="h-10 min-w-0 border bg-background px-3 text-sm font-normal text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...props}
      />
    </label>
  );
}

export function EmptyState({
  title,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="border border-dashed px-4 py-8 text-center">
      <p className="text-sm font-medium">{title}</p>
    </div>
  );
}

function Status({ value }: { value: string }) {
  return (
    <span className="inline-flex max-w-full border bg-muted/50 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground [overflow-wrap:anywhere]">
      {value.replaceAll("_", " ")}
    </span>
  );
}

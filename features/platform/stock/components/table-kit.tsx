// Local table and queue pieces for the catalog/stock/purchasing pages, built from
// the locked cv-ui kit: a "needs you" queue section, a bare table that sits inside
// the list shell's band, a list shell with a queue slot, and an entry-form disclosure.

import Link from "next/link";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

import { Pagination } from "../../../dashboard/components/Pagination";
import { PageContainer } from "../../../dashboard/components/PageContainer";
import { StatusTrack } from "../../components/PlatformListShell";
import { ScopeFilter } from "../../components/PlatformPage";
import { PlatformFilterBar } from "../../components/PlatformFilterBar";
import { DataTable, Dot, SectionTitle, buttonClass, type DotTone } from "../../components/cv-ui";
import type { PlatformListResult, StatusTab } from "../../lib/list-query";
import type { PlatformScope } from "../../lib/scope";
import { cn } from "@/lib/utils";

/** The record link inside a table cell: a 40px target on phones. */
export const cellLinkClass =
  "inline-flex min-h-8 items-center font-medium text-foreground underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring max-sm:min-h-10 [overflow-wrap:anywhere]";

export const monoCellClass = "font-mono text-xs tabular-nums text-muted-foreground";

/** A status word with its dot, for states the page derives itself. */
export function StateText({ tone, label }: { tone: DotTone; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground">
      <Dot tone={tone} />
      {label}
    </span>
  );
}

/** The "needs you" queue: a titled table, or one quiet line when nothing waits. */
export function QueueSection({
  title,
  count,
  empty,
  action,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0" aria-label={title}>
      <SectionTitle meta={count || undefined}>{title}</SectionTitle>
      {count ? (
        <div className="space-y-2">
          {children}
          {action ? <div className="flex justify-end">{action}</div> : null}
        </div>
      ) : (
        <p className="flex items-baseline gap-2 py-1 text-sm text-muted-foreground" role="status">
          <Dot tone="ok" />
          {empty}
        </p>
      )}
    </section>
  );
}

/** A section with a table, its own empty line, and an optional count. */
export function TableSection({
  title,
  count,
  empty,
  head,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  head: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0" aria-label={title}>
      <SectionTitle meta={count || undefined}>{title}</SectionTitle>
      {count ? (
        <DataTable>
          <thead>
            <tr>{head}</tr>
          </thead>
          <tbody>{children}</tbody>
        </DataTable>
      ) : (
        <p className="py-1 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

/** Entry forms sit behind this instead of leading the page. Works without JS. */
export function FormDisclosure({
  summary,
  defaultOpen = false,
  children,
}: {
  summary: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="group min-w-0" open={defaultOpen || undefined}>
      <summary className={cn(buttonClass, "w-fit cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
        <Plus aria-hidden="true" className="size-4 transition-transform group-open:rotate-45" />
        {summary}
      </summary>
      <div className="mt-4 min-w-0 space-y-4">{children}</div>
    </details>
  );
}

/** A missing prerequisite, said plainly with where to set it up. */
export function Prerequisite({ text, href, link }: { text: string; href: string; link: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
      <Dot tone="warn" />
      {text}
      <Link href={href} className="font-medium text-foreground underline underline-offset-2">
        {link}
      </Link>
    </p>
  );
}

/**
 * The platform list frame (same header, scope, filters, tabs and pages as
 * PlatformListShell) with a queue slot above the filters and the rows in a table.
 */
export function QueueListShell({
  title,
  scope,
  state,
  basePath,
  search,
  statuses,
  result,
  actions,
  entity,
  empty,
  queue,
  head,
  children,
}: {
  title: string;
  scope: PlatformScope;
  state?: { tone: DotTone; label: string } | null;
  basePath: string;
  search: Record<string, string | string[] | undefined>;
  statuses?: StatusTab[];
  result: PlatformListResult<unknown>;
  actions?: ReactNode;
  entity: { singular: string; plural: string };
  empty: string;
  queue?: ReactNode;
  head: ReactNode;
  children: ReactNode;
}) {
  const breadcrumbs = [
    { type: "link" as const, label: "Dashboard", href: "/dashboard" },
    { type: "page" as const, label: "Platform" },
    { type: "page" as const, label: title },
  ];
  const storeLabel = scope.stores.find((entry) => entry.id === scope.storeId)?.label;
  const titleState = state ?? (storeLabel ? { tone: "ok" as DotTone, label: storeLabel } : null);
  const header = (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {titleState ? (
          <span className="inline-flex items-baseline gap-1.5 text-sm text-muted-foreground">
            <Dot tone={titleState.tone} />
            {titleState.label}
          </span>
        ) : null}
      </div>
      {scope.businessId ? <ScopeFilter projection={scope} businessOnly={false} /> : null}
    </div>
  );
  return (
    <PageContainer title={title} header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 space-y-5 px-4 pb-10 max-sm:pb-28 md:px-6">
        {!scope.businessId ? (
          <EmptyBox text="You don't have access to a store yet" />
        ) : (
          <>
            {queue}
            <div className="min-w-0 space-y-3">
              {result.list ? <PlatformFilterBar list={result.list} actions={actions} /> : actions}
              {statuses?.length ? <StatusTrack basePath={basePath} search={search} statuses={statuses} result={result} /> : null}
            </div>
            {result.error ? (
              <p role="alert" className="flex items-baseline gap-2 rounded-[4px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <Dot tone="danger" />
                {result.error}
              </p>
            ) : result.items.length ? (
              <DataTable>
                <thead>
                  <tr>{head}</tr>
                </thead>
                <tbody>{children}</tbody>
              </DataTable>
            ) : (
              <EmptyBox text={empty} />
            )}
            {result.count > result.pageSize ? (
              <Pagination currentPage={result.page} total={result.count} pageSize={result.pageSize} list={entity} />
            ) : null}
          </>
        )}
      </div>
    </PageContainer>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed px-4 py-8 text-center">
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

import { Pagination } from "../../dashboard/components/Pagination";
import { PageContainer } from "../../dashboard/components/PageContainer";
import type { PlatformListResult, StatusTab } from "../lib/list-query";
import type { PlatformScope } from "../lib/scope";
import { ScopeFilter } from "./PlatformPage";
import { Count, Dot, ListBand, pillClass, statusTone, trackClass, type DotTone } from "./cv-ui";
import { PlatformFilterBar } from "./PlatformFilterBar";

/** Status tabs as links, so they work with the server-rendered list. */
export function StatusTrack({
  basePath,
  search,
  statuses,
  result,
}: {
  basePath: string;
  search: Record<string, string | string[] | undefined>;
  statuses: StatusTab[];
  result: Pick<PlatformListResult<unknown>, "status" | "statusCounts">;
}) {
  const href = (value: string) => {
    const params = new URLSearchParams();
    for (const [key, raw] of Object.entries(search)) {
      const value_ = Array.isArray(raw) ? raw[0] : raw;
      if (value_ && key !== "status" && key !== "page") params.set(key, value_);
    }
    if (value !== "all") params.set("status", value);
    const text = params.toString();
    return text ? `${basePath}?${text}` : basePath;
  };
  return (
    <nav aria-label="Status" className={`${trackClass}`}>
      {[{ value: "all", label: "All" }, ...statuses].map((entry) => (
        <Link
          key={entry.value}
          href={href(entry.value)}
          data-active={result.status === entry.value}
          aria-current={result.status === entry.value ? "page" : undefined}
          className={pillClass}
        >
          {entry.value !== "all" ? <Dot tone={statusTone(entry.value)} className="translate-y-0" /> : null}
          {entry.label}
          <Count>{result.statusCounts[entry.value] ?? 0}</Count>
        </Link>
      ))}
    </nav>
  );
}

/** List page frame shared by every platform list: header, scope, filters, tabs, rows, pages. */
export function PlatformListShell({
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
          <EmptyRow text="You don't have access to a store yet" />
        ) : (
          <>
            {result.list ? <PlatformFilterBar list={result.list} actions={actions} /> : null}
            {statuses?.length ? <StatusTrack basePath={basePath} search={search} statuses={statuses} result={result} /> : null}
            {result.error ? (
              <p role="alert" className="flex items-baseline gap-2 rounded-[4px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <Dot tone="danger" />
                {result.error}
              </p>
            ) : result.items.length ? (
              <ListBand>{children}</ListBand>
            ) : (
              <EmptyRow text={empty} />
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

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed px-4 py-8 text-center">
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}

/** One list row: title line with status dot, meta line, figure on the right; the whole row links to the detail page. */
export function ListRow({
  href,
  title,
  status,
  state,
  meta,
  figure,
  figureMeta,
}: {
  href: string;
  title: ReactNode;
  status?: string | null;
  state?: { tone: DotTone; label: string } | null;
  meta?: ReactNode;
  figure?: ReactNode;
  figureMeta?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="grid min-w-0 gap-x-6 gap-y-1 bg-background/60 px-4 py-3 transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="min-w-0 text-sm font-medium text-foreground [overflow-wrap:anywhere]">{title}</span>
          {state ? (
            <span className="inline-flex items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
              <Dot tone={state.tone} />
              {state.label}
            </span>
          ) : status ? (
            <StatusInline status={status} />
          ) : null}
        </div>
        {meta ? <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">{meta}</p> : null}
      </div>
      {figure !== undefined ? (
        <div className="min-w-0 sm:text-right">
          <p className="font-mono text-sm tabular-nums text-foreground">{figure}</p>
          {figureMeta ? <p className="text-xs text-muted-foreground">{figureMeta}</p> : null}
        </div>
      ) : null}
    </Link>
  );
}

function StatusInline({ status }: { status: string }) {
  const text = status.replaceAll("_", " ");
  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
      <Dot tone={statusTone(status)} />
      {text[0]?.toUpperCase() + text.slice(1)}
    </span>
  );
}

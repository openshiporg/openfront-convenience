import type { ReactNode } from "react";

import { Pagination } from "../../dashboard/components/Pagination";
import { PageContainer } from "../../dashboard/components/PageContainer";
import { StatusTrack } from "../components/PlatformListShell";
import { ScopeFilter } from "../components/PlatformPage";
import { PlatformFilterBar } from "../components/PlatformFilterBar";
import { Dot, type DotTone } from "../components/cv-ui";
import type { PlatformListResult, StatusTab } from "../lib/list-query";
import type { PlatformScope } from "../lib/scope";

/**
 * The shared list frame (header, scope, filters, status tabs, pages) with two
 * changes for ledger pages: a `lead` slot under the header for the count-box strip
 * and the "needs you" queue, and children rendered as-is so they can be a DataTable.
 */
export function LedgerListShell({
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
  lead,
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
  lead?: ReactNode;
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
          <LedgerEmpty text="You don't have access to a store yet" />
        ) : (
          <>
            {lead}
            {result.list ? <PlatformFilterBar list={result.list} actions={actions} /> : null}
            {statuses?.length ? <StatusTrack basePath={basePath} search={search} statuses={statuses} result={result} /> : null}
            {result.error ? (
              <p role="alert" className="flex items-baseline gap-2 rounded-[4px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                <Dot tone="danger" />
                {result.error}
              </p>
            ) : result.items.length ? (
              children
            ) : (
              <LedgerEmpty text={empty} />
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

export function LedgerEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed px-4 py-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </div>
  );
}

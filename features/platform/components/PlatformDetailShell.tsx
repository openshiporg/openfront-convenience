import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { PageContainer } from "../../dashboard/components/PageContainer";
import { Dot, SectionTitle, statusLabel, statusTone, type DotTone } from "./cv-ui";

/** Detail page frame: back link, title with its status dot, notices, sections. */
export function PlatformDetailShell({
  section,
  sectionHref,
  title,
  status,
  state,
  meta,
  notice,
  error,
  aside,
  children,
}: {
  section: string;
  sectionHref: string;
  title: string;
  status?: string | null;
  state?: { tone: DotTone; label: string } | null;
  meta?: ReactNode;
  notice?: string;
  error?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const breadcrumbs = [
    { type: "link" as const, label: "Dashboard", href: "/dashboard" },
    { type: "link" as const, label: section, href: sectionHref },
    { type: "page" as const, label: title },
  ];
  const titleState = state ?? (status ? { tone: statusTone(status), label: statusLabel(status) } : null);
  const header = (
    <div className="min-w-0 space-y-2">
      <Link href={sectionHref} className="inline-flex min-h-8 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="size-4" />
        {section}
      </Link>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]">{title}</h1>
        {titleState ? (
          <span className="inline-flex items-baseline gap-1.5 text-sm text-muted-foreground">
            <Dot tone={titleState.tone} />
            {titleState.label}
          </span>
        ) : null}
      </div>
      {meta ? <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{meta}</p> : null}
    </div>
  );
  return (
    <PageContainer title={title} header={header} breadcrumbs={breadcrumbs}>
      <div className="min-w-0 space-y-6 px-4 pb-10 max-sm:pb-28 md:px-6">
        {error ? (
          <p role="alert" className="flex items-baseline gap-2 rounded-[4px] border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <Dot tone="danger" />
            {error}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="flex items-baseline gap-2 rounded-[4px] border border-emerald-600/25 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-300">
            <Dot tone="ok" />
            {notice}
          </p>
        ) : null}
        <div className={aside ? "grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]" : "min-w-0"}>
          <div className="min-w-0 space-y-6">{children}</div>
          {aside ? <aside className="min-w-0 space-y-4 xl:sticky xl:top-4">{aside}</aside> : null}
        </div>
      </div>
    </PageContainer>
  );
}

export function DetailSection({ title, meta, children }: { title: string; meta?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0" aria-label={title}>
      <SectionTitle meta={meta}>{title}</SectionTitle>
      {children}
    </section>
  );
}

/** Label/value facts in a recessed band. */
export function FactList({ facts }: { facts: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-md bg-border ring-1 ring-border sm:grid-cols-3">
      {facts.map(([label, value]) => (
        <div key={label} className="min-w-0 bg-background px-4 py-3">
          <dt className="truncate text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm text-foreground [overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A plain row inside a ListBand (no link). */
export function BandRow({
  title,
  status,
  state,
  meta,
  figure,
}: {
  title: ReactNode;
  status?: string | null;
  state?: { tone: DotTone; label: string } | null;
  meta?: ReactNode;
  figure?: ReactNode;
}) {
  const shown = state ?? (status ? { tone: statusTone(status), label: statusLabel(status) } : null);
  return (
    <div className="grid min-w-0 gap-x-6 gap-y-1 bg-background/60 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3">
          <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">{title}</span>
          {shown ? (
            <span className="inline-flex items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
              <Dot tone={shown.tone} />
              {shown.label}
            </span>
          ) : null}
        </div>
        {meta ? <p className="mt-0.5 text-xs text-muted-foreground [overflow-wrap:anywhere]">{meta}</p> : null}
      </div>
      {figure !== undefined ? <p className="font-mono text-sm tabular-nums sm:text-right">{figure}</p> : null}
    </div>
  );
}

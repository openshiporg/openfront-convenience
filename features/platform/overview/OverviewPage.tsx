import Link from "next/link";

import { CountBoxes, DataTable, Dot, SectionTitle, StatusText, Td, Th, Tr, formatMeasure, primaryButtonClass } from "../components/cv-ui";
import { PlatformPage } from "../components/PlatformPage";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";
import { scopeQuery } from "../lib/scope";
import { loadNeedsYou, type QueueItem } from "./needs-you";

const SHORT_INK = "text-[oklch(0.52_0.19_27)] dark:text-red-400";

/** Times shown in the store's timezone, the same clock the receipt uses. */
function storeTime(value: string, timeZone: string | null | undefined): string {
  const options: Intl.DateTimeFormatOptions = { dateStyle: "short", timeStyle: "short" };
  try {
    return new Date(value).toLocaleString("en-US", { ...options, timeZone: timeZone || "UTC" });
  } catch {
    return new Date(value).toLocaleString("en-US", { ...options, timeZone: "UTC" });
  }
}

export async function OverviewPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("overview", searchParams);
  const projection = state.projection;
  const q = projection ? scopeQuery(projection) : "";
  const queue = projection ? await loadNeedsYou(projection, q) : [];
  const metric = (label: string) => projection?.metrics.find((entry) => entry.label === label)?.value;
  const urgent = queue.filter((item) => item.tone === "danger").length;
  const keyFigures = [
    { label: "Net sales today", value: formatMeasure(metric("Net sales today") ?? "0") },
    { label: "Transactions today", value: metric("Transactions today") ?? "0" },
    ...(metric("Refunds today") ? [{ label: "Refunds today", value: formatMeasure(metric("Refunds today") ?? "0") }] : []),
    { label: "Drawers open", value: metric("Registers open") ?? "0" },
    { label: "People on shift", value: metric("People on shift") ?? "0" },
  ];
  return (
    <PlatformPage
      title="Overview"
      {...state}
      showMetrics={false}
      state={
        projection
          ? urgent
            ? { tone: "danger", label: `${urgent} urgent tonight` }
            : queue.length
              ? { tone: "warn", label: `${queue.length} waiting on you` }
              : { tone: "ok", label: "Nothing waiting" }
          : null
      }
    >
      {projection ? (
        <>
          {/* One track per key figure, edge to edge with the queue table below. */}
          <CountBoxes items={keyFigures} columns={`repeat(${keyFigures.length}, minmax(0, 1fr))`} />
          <section aria-labelledby="needs-you-heading" className="min-w-0">
            <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-3 border-b border-foreground/15 pb-2">
              <h2 id="needs-you-heading" className="flex items-baseline gap-2 text-[14px] font-semibold text-foreground">
                Needs you tonight
                {queue.length ? <span className="font-mono text-xs font-normal tabular-nums text-muted-foreground">{queue.length}</span> : null}
              </h2>
              <Link href={`/dashboard/platform/pos${q}`} className={primaryButtonClass}>
                Ring up a sale
              </Link>
            </div>
            {queue.length ? <QueueTable items={queue} /> : <p className="py-2 text-sm text-muted-foreground">Nothing needs you right now</p>}
          </section>
          <StoreDays rows={projection.rows} timeZone={projection.timezone} q={q} />
        </>
      ) : null}
    </PlatformPage>
  );
}

function QueueTable({ items }: { items: QueueItem[] }) {
  return (
    <DataTable aria-label="Needs you tonight">
      <thead>
        <tr>
          <Th>State</Th>
          <Th>What</Th>
          <Th priority={3}>Detail</Th>
          <Th align="right">Amount</Th>
          <Th priority={2}>Where</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <Tr key={item.key}>
            <Td className="whitespace-nowrap">
              <span className="inline-flex items-baseline gap-1.5 text-xs font-medium text-muted-foreground">
                <Dot tone={item.tone} />
                {item.state}
              </span>
            </Td>
            <Td className="max-sm:py-2.5">
              <Link
                href={item.href}
                className="inline-flex min-h-6 flex-wrap items-baseline gap-x-2 font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring max-sm:min-h-10 max-sm:items-center"
              >
                <span className="[overflow-wrap:anywhere]">{item.title}</span>
                {item.reference ? <span className="font-mono text-[12px] font-normal text-muted-foreground">{item.reference}</span> : null}
              </Link>
            </Td>
            <Td priority={3} className="max-w-[28rem] text-muted-foreground">
              <span className="line-clamp-2 [overflow-wrap:anywhere]">{item.detail || "—"}</span>
            </Td>
            <Td align="right" className={`whitespace-nowrap ${item.figureTone === "short" ? SHORT_INK : ""}`}>
              {item.figure ?? <span className="text-muted-foreground">—</span>}
            </Td>
            <Td priority={2} className="whitespace-nowrap">
              <Link href={item.href} className="text-[13px] text-muted-foreground hover:text-foreground hover:underline">
                {item.area}
              </Link>
            </Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );
}

function StoreDays({
  rows,
  timeZone,
  q,
}: {
  rows: Array<{ id: string; title: string; detail: string; status: string; metric: string; occurredAt: string | null }>;
  timeZone: string | null;
  q: string;
}) {
  return (
    <section aria-labelledby="store-days-heading" className="min-w-0">
      <SectionTitle id="store-days-heading" meta={rows.length || undefined}>
        Store days
      </SectionTitle>
      {rows.length ? (
        <DataTable aria-label="Store days">
          <thead>
            <tr>
              <Th>Trading date</Th>
              <Th priority={2}>Detail</Th>
              <Th priority={3}>Generated</Th>
              <Th align="right">Net receipts</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td>
                  <Link
                    href={`/dashboard/platform/reconciliation${q}`}
                    className="inline-flex min-h-6 items-center font-mono text-[12px] font-medium text-foreground hover:underline max-sm:min-h-10"
                  >
                    {row.title}
                  </Link>
                </Td>
                <Td priority={2} className="text-muted-foreground">
                  {row.detail || "—"}
                </Td>
                <Td priority={3} className="whitespace-nowrap text-muted-foreground">
                  {row.occurredAt ? <time dateTime={row.occurredAt}>{storeTime(row.occurredAt, timeZone)}</time> : "—"}
                </Td>
                <Td align="right" className="whitespace-nowrap">
                  {row.metric ? formatMeasure(row.metric).replace(/\s*net$/, "") : "—"}
                </Td>
                <Td>
                  <StatusText status={row.status} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <p className="py-2 text-sm text-muted-foreground">No store days yet</p>
      )}
    </section>
  );
}

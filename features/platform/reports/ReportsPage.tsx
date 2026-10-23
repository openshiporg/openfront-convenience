import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { Dot, ListBand, SectionTitle, inputClass, labelClass, panelClass, primaryButtonClass } from "../components/cv-ui";
import { EmptyState, PlatformPage } from "../components/PlatformPage";
import { getPlatformProjection, searchValue, type PlatformSearch } from "../lib/projection";

type Summary = {
  currencyCode: string;
  dayCount: number;
  grossSalesCents: string;
  netReceiptsCents: string;
  cashOverShortCents: string;
  depositedCashCents: string;
  lotteryNetCents: string;
  moneyServiceNetCents: string;
  exceptionCount: string;
  stores: Array<{ storeId: string; storeName: string; dayCount: number; netReceiptsCents: string; cashOverShortCents: string; exceptionCount: string }>;
};

function money(cents: string, currencyCode: string) {
  const amount = Number(cents);
  return Number.isSafeInteger(amount) ? new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(amount / 100) : cents;
}

export async function ReportsPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const replayableSearch = Promise.resolve(search);
  const state = await getPlatformProjection("reports", replayableSearch);
  const startDate = searchValue(search, "startDate");
  const endDate = searchValue(search, "endDate");
  const scope = searchValue(search, "scope") || "business";
  const currencyCode = searchValue(search, "currencyCode").toUpperCase();
  let summary: Summary | null = null;
  let reportError = "";
  if (state.projection?.businessId && startDate && endDate) {
    const response = await keystoneClient<{ convenienceReportingSummary: Summary }>(`
      query PlatformReport($input: ConvenienceReportingSummaryInput!) {
        convenienceReportingSummary(input: $input) {
          currencyCode dayCount grossSalesCents netReceiptsCents cashOverShortCents depositedCashCents lotteryNetCents moneyServiceNetCents exceptionCount
          stores { storeId storeName dayCount netReceiptsCents cashOverShortCents exceptionCount }
        }
      }
    `, { input: { businessId: state.projection.businessId, startDate, endDate, storeIds: scope === "store" && state.projection.storeId ? [state.projection.storeId] : null, currencyCode: currencyCode || null } });
    if (response.success) summary = response.data.convenienceReportingSummary;
    else reportError = response.error || "Report failed";
  }
  const figures: Array<[string, string]> = summary
    ? [
        ["Gross sales", money(summary.grossSalesCents, summary.currencyCode)],
        ["Net receipts", money(summary.netReceiptsCents, summary.currencyCode)],
        ["Cash variance", money(summary.cashOverShortCents, summary.currencyCode)],
        ["Deposited cash", money(summary.depositedCashCents, summary.currencyCode)],
        ["Lottery settlement", money(summary.lotteryNetCents, summary.currencyCode)],
        ["Money-service settlement", money(summary.moneyServiceNetCents, summary.currencyCode)],
        ["Store days", String(summary.dayCount)],
        ["Exceptions", summary.exceptionCount],
      ]
    : [];
  return <PlatformPage title="Reports" {...state} error={state.error || reportError}>
    {state.projection ? <>
      <section className={panelClass} aria-labelledby="report-controls">
        <h2 id="report-controls" className="text-[15px] font-semibold tracking-tight">Reporting period</h2>
        <form method="get" className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
          <input type="hidden" name="businessId" value={state.projection.businessId ?? ""} />
          <input type="hidden" name="storeId" value={state.projection.storeId ?? ""} />
          <label className={labelClass}>Start date<input className={`${inputClass} font-mono`} name="startDate" type="date" defaultValue={startDate} required /></label>
          <label className={labelClass}>End date<input className={`${inputClass} font-mono`} name="endDate" type="date" defaultValue={endDate} required /></label>
          <label className={labelClass}>Currency<input className={`${inputClass} font-mono uppercase`} name="currencyCode" defaultValue={currencyCode} maxLength={3} pattern="[A-Za-z]{3}" placeholder="USD" /></label>
          <label className={labelClass}>Scope<select className={inputClass} name="scope" defaultValue={scope}><option value="business">All stores</option><option value="store">Selected store</option></select></label>
          <div className="sm:col-span-2 xl:col-span-1"><button className={primaryButtonClass} type="submit">Run report</button></div>
        </form>
      </section>
      {summary ? <section className="min-w-0 space-y-5" aria-labelledby="report-results">
        <SectionTitle id="report-results" meta={`${startDate} – ${endDate}`}>Reconciled store days</SectionTitle>
        <dl className="grid min-w-0 grid-cols-2 gap-px overflow-hidden rounded-2xl bg-border/70 ring-1 ring-border/70 md:grid-cols-4">
          {figures.map(([label, value]) => <div key={label} className="min-w-0 bg-background px-4 py-3.5"><dt className="truncate text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 font-mono text-xl font-medium tabular-nums tracking-tight [overflow-wrap:anywhere]">{value}</dd></div>)}
        </dl>
        {summary.stores.length ? <div className="min-w-0">
          <SectionTitle meta={summary.stores.length}>By store</SectionTitle>
          <ListBand>{summary.stores.map((store) => <article key={store.storeId} className="grid min-w-0 gap-x-6 gap-y-1 bg-background/60 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(96px,auto))] sm:items-baseline">
            <div className="flex min-w-0 items-baseline gap-2"><Dot tone={Number(store.exceptionCount) > 0 ? "warn" : "ok"} /><p className="truncate text-sm font-medium">{store.storeName}</p><span className="font-mono text-xs tabular-nums text-muted-foreground">{store.dayCount} days</span></div>
            <p className="font-mono text-sm tabular-nums sm:text-right">{money(store.netReceiptsCents, summary.currencyCode)}</p>
            <p className="font-mono text-sm tabular-nums text-muted-foreground sm:text-right">{money(store.cashOverShortCents, summary.currencyCode)} var.</p>
            <p className="font-mono text-sm tabular-nums text-muted-foreground sm:text-right">{store.exceptionCount} exc.</p>
          </article>)}</ListBand>
        </div> : null}
      </section> : startDate && endDate ? null : <EmptyState title="Choose a period" />}
    </> : null}
  </PlatformPage>;
}

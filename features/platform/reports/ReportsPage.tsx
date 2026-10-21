import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { PlatformPage } from "../components/PlatformPage";
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
  return <PlatformPage title="Reports" description="Sales and store-day reports for a business or store." {...state} error={state.error || reportError}>
    {state.projection ? <>
      <section className="space-y-4" aria-labelledby="report-controls">
        <div><h2 id="report-controls" className="text-lg font-semibold">Reporting period</h2></div>
        <form method="get" className="grid gap-3 border bg-background p-4 sm:grid-cols-2 xl:grid-cols-5">
          <input type="hidden" name="businessId" value={state.projection.businessId ?? ""} />
          <input type="hidden" name="storeId" value={state.projection.storeId ?? ""} />
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Start date<input className="h-10 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" name="startDate" type="date" defaultValue={startDate} required /></label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">End date<input className="h-10 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" name="endDate" type="date" defaultValue={endDate} required /></label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Currency<input className="h-10 border bg-background px-3 text-sm uppercase text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" name="currencyCode" defaultValue={currencyCode} maxLength={3} pattern="[A-Za-z]{3}" placeholder="Single currency" /></label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">Scope<select className="h-10 border bg-background px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" name="scope" defaultValue={scope}><option value="business">All business stores</option><option value="store">Selected store</option></select></label>
          <button className="h-10 self-end bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2 xl:col-span-1" type="submit">Run report</button>
        </form>
      </section>
      {summary ? <section className="space-y-3" aria-labelledby="report-results">
        <h2 id="report-results" className="text-lg font-semibold">Reconciled store days</h2>
        <dl className="divide-y border text-sm">
          {[["Store days", String(summary.dayCount)], ["Gross sales", money(summary.grossSalesCents, summary.currencyCode)], ["Net receipts", money(summary.netReceiptsCents, summary.currencyCode)], ["Cash variance", money(summary.cashOverShortCents, summary.currencyCode)], ["Lottery settlement", money(summary.lotteryNetCents, summary.currencyCode)], ["Money-service settlement", money(summary.moneyServiceNetCents, summary.currencyCode)], ["Deposited cash", money(summary.depositedCashCents, summary.currencyCode)], ["Exceptions", summary.exceptionCount]].map(([label, value]) => <div key={label} className="flex min-w-0 justify-between gap-4 px-4 py-2"><dt>{label}</dt><dd className="tabular-nums [overflow-wrap:anywhere]">{value}</dd></div>)}
        </dl>
        <div className="divide-y border">{summary.stores.map((store) => <article key={store.storeId} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_repeat(4,minmax(90px,.5fr))] sm:items-center"><p className="font-medium">{store.storeName}</p><p className="text-sm tabular-nums">{store.dayCount} days</p><p className="text-sm tabular-nums">{money(store.netReceiptsCents, summary.currencyCode)}</p><p className="text-sm tabular-nums">{money(store.cashOverShortCents, summary.currencyCode)} variance</p><p className="text-sm tabular-nums">{store.exceptionCount} exceptions</p></article>)}</div>
      </section> : null}
    </> : null}
  </PlatformPage>;
}

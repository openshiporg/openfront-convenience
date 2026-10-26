import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { CountBoxes, DataTable, Dot, SectionTitle, Td, Th, Tr, inputClass, labelClass, primaryButtonClass, type DotTone } from "../components/cv-ui";
import { EmptyState, PlatformPage } from "../components/PlatformPage";
import { zonedNowInput } from "../lib/form-values";
import { getPlatformProjection, searchValue, type PlatformSearch } from "../lib/projection";

type Summary = {
  currencyCode: string;
  dayCount: number;
  grossSalesCents: string;
  discountCents: string;
  taxCents: string;
  totalSalesCents: string;
  refundCents: string;
  cashTenderCents: string;
  nonCashTenderCents: string;
  saleCount: string;
  refundCount: string;
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
  // Today in the store's timezone unless a period was chosen.
  const today = zonedNowInput(state.projection?.timezone).slice(0, 10);
  const startDate = searchValue(search, "startDate") || today;
  const endDate = searchValue(search, "endDate") || today;
  const scope = searchValue(search, "scope") || "business";
  const currencyCode = (searchValue(search, "currencyCode") || state.projection?.currencyCode || "").toUpperCase();
  let summary: Summary | null = null;
  let reportError = "";
  if (state.projection?.businessId && startDate && endDate) {
    const response = await keystoneClient<{ convenienceReportingSummary: Summary }>(`
      query PlatformReport($input: ConvenienceReportingSummaryInput!) {
        convenienceReportingSummary(input: $input) {
          currencyCode dayCount grossSalesCents discountCents taxCents totalSalesCents refundCents netReceiptsCents cashTenderCents nonCashTenderCents saleCount refundCount cashOverShortCents depositedCashCents lotteryNetCents moneyServiceNetCents exceptionCount
          stores { storeId storeName dayCount netReceiptsCents cashOverShortCents exceptionCount }
        }
      }
    `, { input: { businessId: state.projection.businessId, startDate, endDate, storeIds: scope === "store" && state.projection.storeId ? [state.projection.storeId] : null, currencyCode: currencyCode || null } });
    if (response.success) summary = response.data.convenienceReportingSummary;
    else reportError = response.error || "Report failed";
  }
  const m = (cents: string) => money(cents, summary?.currencyCode || currencyCode || "USD");
  // One set of definitions: item sales → less discounts → plus tax → less refunds = net receipts.
  const statement: Array<[string, string, boolean?]> = summary
    ? [
        ["Item sales (before tax)", m(summary.grossSalesCents)],
        ["Discounts", m(summary.discountCents)],
        ["Tax", m(summary.taxCents)],
        ["Sales incl. tax", m(summary.totalSalesCents), true],
        ["Refunds", m(summary.refundCents)],
        ["Net receipts", m(summary.netReceiptsCents), true],
      ]
    : [];
  const other: Array<[string, string]> = summary
    ? [
        ["Card and other tenders", m(summary.nonCashTenderCents)],
        ["Lottery settlement", m(summary.lotteryNetCents)],
        ["Money-service settlement", m(summary.moneyServiceNetCents)],
        ["Transactions", summary.saleCount],
        ["Refunds issued", summary.refundCount],
      ]
    : [];
  const overShort = Number(summary?.cashOverShortCents ?? 0);
  const stores = [...(summary?.stores ?? [])].sort(
    (left, right) => Number(left.cashOverShortCents) - Number(right.cashOverShortCents) || Number(right.exceptionCount) - Number(left.exceptionCount),
  );
  const flagged = stores.filter((store) => Number(store.cashOverShortCents) < 0 || Number(store.exceptionCount) > 0).length;
  const pageState: { tone: DotTone; label: string } | null = summary
    ? summary.dayCount === 0
      ? { tone: "muted", label: "No closed days in period" }
      : overShort < 0
        ? { tone: "danger", label: `Short ${m(String(Math.abs(overShort)))}` }
        : Number(summary.exceptionCount) > 0
          ? { tone: "warn", label: `${summary.exceptionCount} exceptions` }
          : { tone: "ok", label: "Balanced" }
    : null;
  return <PlatformPage title="Reports" {...state} showMetrics={false} state={pageState} error={state.error || reportError}>
    {state.projection ? <>
      <form method="get" aria-label="Reporting period" className="grid min-w-0 gap-3 border-b pb-4 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
        <input type="hidden" name="businessId" value={state.projection.businessId ?? ""} />
        <input type="hidden" name="storeId" value={state.projection.storeId ?? ""} />
        <label className={labelClass}>Start date<input className={`${inputClass} font-mono`} name="startDate" type="date" defaultValue={startDate} required /></label>
        <label className={labelClass}>End date<input className={`${inputClass} font-mono`} name="endDate" type="date" defaultValue={endDate} required /></label>
        <label className={labelClass}>Currency<input className={`${inputClass} font-mono uppercase`} name="currencyCode" defaultValue={currencyCode} maxLength={3} pattern="[A-Za-z]{3}" placeholder="USD" /></label>
        <label className={labelClass}>Scope<select className={inputClass} name="scope" defaultValue={scope}><option value="business">All stores</option><option value="store">Selected store</option></select></label>
        <div className="sm:col-span-2 xl:col-span-1"><button className={primaryButtonClass} type="submit">Run report</button></div>
      </form>
      {summary ? <section className="min-w-0 space-y-6" aria-labelledby="report-results">
        <div className="min-w-0">
          <SectionTitle id="report-results" meta={`${startDate} – ${endDate} · ${summary.dayCount} ${summary.dayCount === 1 ? "day" : "days"}`}>Cash</SectionTitle>
          {summary.dayCount === 0 ? (
            <CountBoxes
              items={[
                { label: "Cash taken", value: "–" },
                { label: "Deposited", value: "–" },
                { label: "Over / short", value: "–", note: "No closed store days" },
                { label: "Exceptions", value: "–" },
              ]}
            />
          ) : (
            <CountBoxes
              items={[
                { label: "Cash taken", value: m(summary.cashTenderCents) },
                { label: "Deposited", value: m(summary.depositedCashCents) },
                { label: "Over / short", value: `${overShort < 0 ? "−" : overShort > 0 ? "+" : ""}${m(String(Math.abs(overShort)))}`, variance: overShort, note: overShort < 0 ? "Short" : overShort > 0 ? "Over" : "Balanced" },
                { label: "Exceptions", value: summary.exceptionCount, note: Number(summary.exceptionCount) > 0 ? "Open in store days" : "None" },
              ]}
            />
          )}
        </div>

        {stores.length ? <div className="min-w-0">
          <SectionTitle meta={flagged ? `${flagged} need a look` : stores.length}>By store</SectionTitle>
          <DataTable aria-label="By store">
            <thead><tr>
              <Th>Store</Th>
              <Th>Status</Th>
              <Th align="right" priority={2}>Days</Th>
              <Th align="right" priority={2}>Net receipts</Th>
              <Th align="right">Over / short</Th>
              <Th align="right" priority={3}>Exceptions</Th>
            </tr></thead>
            <tbody>
              {stores.map((store) => {
                const variance = Number(store.cashOverShortCents);
                const exceptions = Number(store.exceptionCount);
                const shown = variance < 0 ? { tone: "danger" as DotTone, label: "Short" } : exceptions > 0 ? { tone: "warn" as DotTone, label: "Exceptions" } : variance > 0 ? { tone: "warn" as DotTone, label: "Over" } : { tone: "ok" as DotTone, label: "Balanced" };
                return <Tr key={store.storeId}>
                  <Td className="font-medium">{store.storeName}</Td>
                  <Td><span className="inline-flex items-baseline gap-1.5 whitespace-nowrap text-xs font-medium text-muted-foreground"><Dot tone={shown.tone} />{shown.label}</span></Td>
                  <Td align="right" priority={2}>{store.dayCount}</Td>
                  <Td align="right" priority={2}>{m(store.netReceiptsCents)}</Td>
                  <Td align="right" className={variance < 0 ? "text-[oklch(0.52_0.19_27)] dark:text-red-400" : ""}>{variance < 0 ? "−" : variance > 0 ? "+" : ""}{m(String(Math.abs(variance)))}</Td>
                  <Td align="right" priority={3}>{store.exceptionCount}</Td>
                </Tr>;
              })}
            </tbody>
          </DataTable>
        </div> : null}

        {summary.dayCount > 0 ? <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
          <div className="min-w-0">
            <SectionTitle>Sales to net receipts</SectionTitle>
            <DataTable aria-label="Sales to net receipts">
              <tbody>
                {statement.map(([label, value, total]) => <Tr key={label} className={total ? "bg-muted/30 font-medium" : ""}>
                  <Td>{label}</Td>
                  <Td align="right">{value}</Td>
                </Tr>)}
              </tbody>
            </DataTable>
          </div>
          <div className="min-w-0">
            <SectionTitle>Other totals</SectionTitle>
            <DataTable aria-label="Other totals">
              <tbody>
                {other.map(([label, value]) => <Tr key={label}>
                  <Td>{label}</Td>
                  <Td align="right">{value}</Td>
                </Tr>)}
              </tbody>
            </DataTable>
          </div>
        </div> : null}
      </section> : startDate && endDate ? null : <EmptyState title="Choose a period" />}
    </> : null}
  </PlatformPage>;
}

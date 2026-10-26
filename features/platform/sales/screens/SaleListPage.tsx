import Link from "next/link";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { CountBoxes, DataTable, Dot, SectionTitle, StatusText, Td, Th, Tr, statusLabel } from "../../components/cv-ui";
import { shortRef } from "../../lib/labels";
import { loadPlatformList } from "../../lib/list-query";
import { employeeName, type EmployeeRef } from "../../lib/people";
import type { PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";
import { zonedIso, zonedNowInput } from "../../lib/form-values";
import { LedgerListShell } from "../LedgerListShell";

const STATUSES = [
  { value: "completed", label: "Completed" },
  { value: "partially_refunded", label: "Partly refunded" },
  { value: "refunded", label: "Refunded" },
  { value: "voided", label: "Voided" },
  { value: "open", label: "Open" },
];

type SaleRow = {
  id: string;
  receiptNumber: string;
  status: string;
  source: string;
  totalCents: number;
  refundedCents: number;
  currencyCode: string;
  completedAt: string | null;
  startedAt: string | null;
  linesCount: number;
  cashier: EmployeeRef;
  tenders: Array<{ method: string }>;
};

/**
 * Today's figures since the store's midnight, on the same terms as the Overview's
 * "Net sales today": completed sales less completed refunds; voids counted apart.
 */
async function loadToday(storeId: string | null, timeZone: string | null) {
  if (!storeId) return null;
  const start = zonedIso(`${zonedNowInput(timeZone).slice(0, 10)}T00:00`, timeZone);
  const store = { store: { id: { equals: storeId } } };
  const response = await keystoneClient<{
    sales: Array<{ totalCents: number }>;
    refunds: Array<{ amountCents: number }>;
    voids: number;
  }>(
    `query PlatformSalesToday($sales: SaleWhereInput!, $refunds: RefundWhereInput!, $voids: SaleWhereInput!) {
      sales(where: $sales, take: 5000) { totalCents }
      refunds(where: $refunds, take: 5000) { amountCents }
      voids: salesCount(where: $voids)
    }`,
    {
      sales: { AND: [store, { status: { in: ["completed", "partially_refunded", "refunded"] } }, { completedAt: { gte: start } }] },
      refunds: { AND: [store, { status: { equals: "completed" } }, { processedAt: { gte: start } }] },
      voids: { AND: [store, { status: { equals: "voided" } }, { voidedAt: { gte: start } }] },
    },
  );
  if (!response.success) return null;
  const gross = response.data.sales.reduce((sum, sale) => sum + (sale.totalCents ?? 0), 0);
  const refunded = response.data.refunds.reduce((sum, refund) => sum + (refund.amountCents ?? 0), 0);
  return { net: gross - refunded, refunded, voids: response.data.voids };
}

export async function SaleListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const [result, today] = await Promise.all([loadPlatformList<SaleRow>({
    path: "sales",
    search,
    scopeWhere: { store: { id: { equals: scope.storeId ?? "" } } },
    statuses: STATUSES,
    selection: `id receiptNumber status source totalCents refundedCents currencyCode completedAt startedAt linesCount
      cashier { employeeNumber user { name } }
      tenders { method }`,
  }), loadToday(scope.storeId, scope.timezone)]);
  const q = scopeQuery(scope);
  const openCount = result.statusCounts.open ?? 0;
  const money = (cents: number) => formatMoney(cents, scope.currencyCode);
  const lead = (
    <>
      {today ? (
        <CountBoxes
          items={[
            { label: "Net today", value: money(today.net), variance: today.net < 0 ? today.net : null },
            { label: "Refunds today", value: today.refunded ? `−${money(today.refunded)}` : money(0) },
            { label: "Voids today", value: today.voids },
          ]}
        />
      ) : null}
      {openCount ? (
        <section aria-labelledby="sales-queue" className="min-w-0">
          <SectionTitle id="sales-queue" meta={openCount}>
            Needs you
          </SectionTitle>
          <Link
            href={`/dashboard/platform/sales${scopeQuery(scope, { status: "open" })}`}
            className="flex min-h-10 min-w-0 items-baseline justify-between gap-3 border-b py-2 text-[13px] hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="inline-flex items-baseline gap-2 font-medium text-foreground">
              <Dot tone="warn" />
              {openCount} {openCount === 1 ? "sale" : "sales"} started but not completed
            </span>
            <span className="text-[12px] text-muted-foreground">Show open</span>
          </Link>
        </section>
      ) : null}
    </>
  );
  return (
    <LedgerListShell
      title="Sales"
      scope={scope}
      basePath="/dashboard/platform/sales"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "sale", plural: "sales" }}
      empty="No sales"
      lead={lead}
    >
      <DataTable aria-label="Sales">
        <thead>
          <tr>
            <Th>Receipt</Th>
            <Th priority={2}>Time</Th>
            <Th align="right" priority={3}>
              Lines
            </Th>
            <Th priority={3}>Tender</Th>
            <Th priority={2}>Cashier</Th>
            <Th align="right">Total</Th>
            <Th align="right" priority={3}>
              Refunded
            </Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((sale) => (
            <Tr key={sale.id}>
              <Td>
                <Link
                  href={`/dashboard/platform/sales/${sale.id}${q}`}
                  className="inline-flex min-h-6 items-center font-mono text-[12px] font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring max-sm:min-h-10"
                >
                  {shortRef(sale.receiptNumber)}
                </Link>
                {sale.source !== "pos" ? <span className="ml-2 text-[12px] text-muted-foreground">{statusLabel(sale.source)}</span> : null}
              </Td>
              <Td priority={2} className="whitespace-nowrap text-muted-foreground">
                {formatWhen(sale.completedAt ?? sale.startedAt, scope.timezone)}
              </Td>
              <Td align="right" priority={3}>
                {sale.linesCount}
              </Td>
              <Td priority={3} className="text-muted-foreground">
                {[...new Set(sale.tenders.map((tender) => statusLabel(tender.method)))].join(" + ") || "—"}
              </Td>
              <Td priority={2} className="text-muted-foreground">
                {employeeName(sale.cashier)}
              </Td>
              <Td align="right" className="whitespace-nowrap">
                {formatMoney(sale.totalCents, sale.currencyCode)}
              </Td>
              <Td align="right" priority={3} className="whitespace-nowrap">
                {sale.refundedCents ? `−${formatMoney(sale.refundedCents, sale.currencyCode)}` : <span className="text-muted-foreground">—</span>}
              </Td>
              <Td>
                <StatusText status={sale.status} />
              </Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
    </LedgerListShell>
  );
}

import Link from "next/link";

import { DataTable, Dot, SectionTitle, StatusText, Td, Th, Tr, statusLabel } from "../../components/cv-ui";
import { shortRef } from "../../lib/labels";
import { loadPlatformList } from "../../lib/list-query";
import { employeeName, type EmployeeRef } from "../../lib/people";
import type { PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";
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

export async function SaleListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const result = await loadPlatformList<SaleRow>({
    path: "sales",
    search,
    scopeWhere: { store: { id: { equals: scope.storeId ?? "" } } },
    statuses: STATUSES,
    selection: `id receiptNumber status source totalCents refundedCents currencyCode completedAt startedAt linesCount
      cashier { employeeNumber user { name } }
      tenders { method }`,
  });
  const q = scopeQuery(scope);
  const openCount = result.statusCounts.open ?? 0;
  const lead = openCount ? (
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
  ) : null;
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

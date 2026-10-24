import { ListRow, PlatformListShell } from "../../components/PlatformListShell";
import { shortRef } from "../../lib/labels";
import { loadPlatformList } from "../../lib/list-query";
import { employeeName, type EmployeeRef } from "../../lib/people";
import type { PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";

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
  return (
    <PlatformListShell
      title="Sales"
      scope={scope}
      basePath="/dashboard/platform/sales"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "sale", plural: "sales" }}
      empty="No sales"
    >
      {result.items.map((sale) => (
        <ListRow
          key={sale.id}
          href={`/dashboard/platform/sales/${sale.id}${scopeQuery(scope)}`}
          title={<span className="font-mono">{shortRef(sale.receiptNumber)}</span>}
          status={sale.status}
          meta={[
            formatWhen(sale.completedAt ?? sale.startedAt, scope.timezone),
            `${sale.linesCount} ${sale.linesCount === 1 ? "line" : "lines"}`,
            [...new Set(sale.tenders.map((tender) => tender.method.replaceAll("_", " ")))].join(" + ") || null,
            employeeName(sale.cashier),
            sale.source !== "pos" ? sale.source : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          figure={formatMoney(sale.totalCents, sale.currencyCode)}
          figureMeta={sale.refundedCents ? `${formatMoney(sale.refundedCents, sale.currencyCode)} refunded` : undefined}
        />
      ))}
    </PlatformListShell>
  );
}

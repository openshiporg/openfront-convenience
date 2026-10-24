import { ListRow, PlatformListShell } from "../../components/PlatformListShell";
import { shortRef } from "../../lib/labels";
import { loadPlatformList } from "../../lib/list-query";
import type { PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";

const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "partially_received", label: "Partly received" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

type OrderRow = {
  id: string;
  poNumber: string;
  status: string;
  totalCents: number;
  currencyCode: string;
  orderedAt: string | null;
  expectedAt: string | null;
  createdAt: string;
  linesCount: number;
  vendor: { name: string } | null;
};

export async function PurchaseOrderListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const result = await loadPlatformList<OrderRow>({
    path: "purchase-orders",
    search,
    scopeWhere: { store: { id: { equals: scope.storeId ?? "" } } },
    statuses: STATUSES,
    selection: `id poNumber status totalCents currencyCode orderedAt expectedAt createdAt linesCount vendor { name }`,
  });
  return (
    <PlatformListShell
      title="Purchase Orders"
      scope={scope}
      basePath="/dashboard/platform/purchase-orders"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "purchase order", plural: "purchase orders" }}
      empty="No purchase orders"
    >
      {result.items.map((order) => (
        <ListRow
          key={order.id}
          href={`/dashboard/platform/purchase-orders/${order.id}${scopeQuery(scope)}`}
          title={`${order.vendor?.name ?? "Vendor"} · ${shortRef(order.poNumber)}`}
          status={order.status}
          meta={[
            `${order.linesCount} ${order.linesCount === 1 ? "line" : "lines"}`,
            order.orderedAt ? `ordered ${formatWhen(order.orderedAt, scope.timezone)}` : `created ${formatWhen(order.createdAt, scope.timezone)}`,
            order.expectedAt ? `expected ${formatWhen(order.expectedAt, scope.timezone)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          figure={formatMoney(order.totalCents, order.currencyCode)}
        />
      ))}
    </PlatformListShell>
  );
}

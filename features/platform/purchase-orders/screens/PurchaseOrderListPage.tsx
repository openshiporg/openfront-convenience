import Link from "next/link";

import { CountBoxes, DataTable, StatusText, Td, Th, Tr } from "../../components/cv-ui";
import { QueueListShell, QueueSection, StateText, cellLinkClass, monoCellClass } from "../../stock/components/table-kit";
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

const RECEIVABLE = ["approved", "partially_received"];

/** YYYY-MM-DD in the store's timezone, so "today" is the store's day. */
function storeDay(value: string | Date, timeZone: string | null): string {
  try {
    return new Date(value).toLocaleDateString("en-CA", { timeZone: timeZone || "UTC" });
  } catch {
    return new Date(value).toISOString().slice(0, 10);
  }
}

export async function PurchaseOrderListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const storeWhere = { store: { id: { equals: scope.storeId ?? "" } } };
  const selection = `id poNumber status totalCents currencyCode orderedAt expectedAt createdAt linesCount vendor { name }`;
  const [result, receivable] = await Promise.all([
    loadPlatformList<OrderRow>({
      path: "purchase-orders",
      search,
      scopeWhere: storeWhere,
      statuses: STATUSES,
      selection,
    }),
    // Approved or partly received orders, read whole so the queue isn't limited by the tab or search.
    loadPlatformList<OrderRow>({
      path: "purchase-orders",
      search: { pageSize: "100" },
      scopeWhere: { AND: [storeWhere, { status: { in: RECEIVABLE } }] },
      pageSize: 100,
      selection,
    }),
  ]);
  const q = scopeQuery(scope);
  const today = storeDay(new Date(), scope.timezone);
  // Due today or overdue first (oldest expected first), then approved orders with no expected date.
  const toReceive = receivable.items
    .map((order) => {
      const day = order.expectedAt ? storeDay(order.expectedAt, scope.timezone) : null;
      const due = day == null ? "none" : day < today ? "overdue" : day === today ? "today" : "later";
      return { order, due };
    })
    .filter((entry) => entry.due !== "later")
    .sort((a, b) => {
      const rank = { overdue: 0, today: 1, none: 2, later: 3 } as const;
      return (
        rank[a.due as keyof typeof rank] - rank[b.due as keyof typeof rank] ||
        new Date(a.order.expectedAt ?? a.order.createdAt).getTime() - new Date(b.order.expectedAt ?? b.order.createdAt).getTime()
      );
    });
  const overdue = toReceive.filter((entry) => entry.due === "overdue").length;
  const dueToday = toReceive.filter((entry) => entry.due === "today").length;
  const partlyReceived = receivable.items.filter((order) => order.status === "partially_received").length;
  const dueState = {
    overdue: { tone: "danger" as const, label: "Overdue" },
    today: { tone: "warn" as const, label: "Due today" },
    none: { tone: "info" as const, label: "No date" },
    later: { tone: "muted" as const, label: "Later" },
  };
  return (
    <QueueListShell
      title="Purchase Orders"
      scope={scope}
      state={
        overdue
          ? { tone: "danger", label: `${overdue} overdue to receive` }
          : toReceive.length
            ? { tone: "warn", label: `${toReceive.length} to receive today` }
            : undefined
      }
      basePath="/dashboard/platform/purchase-orders"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "purchase order", plural: "purchase orders" }}
      empty="No purchase orders"
      queue={
        <>
          {receivable.error ? null : (
            <CountBoxes
              items={[
                { label: "Due today", value: dueToday, note: overdue ? `${overdue} overdue` : undefined },
                { label: "Open", value: receivable.count, note: "Approved or partly received" },
                { label: "Partly received", value: partlyReceived },
              ]}
            />
          )}
          <QueueSection title="To receive today" count={toReceive.length} empty="Nothing due to receive today">
            <DataTable>
              <thead>
                <tr>
                  <Th>PO</Th>
                  <Th>Vendor</Th>
                  <Th align="right" priority={3}>
                    Lines
                  </Th>
                  <Th priority={2}>Expected</Th>
                  <Th align="right" priority={2}>
                    Total
                  </Th>
                  <Th>Due</Th>
                </tr>
              </thead>
              <tbody>
                {toReceive.map(({ order, due }) => (
                  <Tr key={order.id}>
                    <Td className={monoCellClass}>
                      <Link className={`${cellLinkClass} font-mono text-xs`} href={`/dashboard/platform/purchase-orders/${order.id}${q}`}>
                        {shortRef(order.poNumber)}
                      </Link>
                    </Td>
                    <Td>{order.vendor?.name ?? "—"}</Td>
                    <Td align="right" priority={3} className="text-muted-foreground">
                      {order.linesCount}
                    </Td>
                    <Td priority={2} className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatWhen(order.expectedAt, scope.timezone)}
                    </Td>
                    <Td align="right" priority={2}>
                      {formatMoney(order.totalCents, order.currencyCode)}
                    </Td>
                    <Td>
                      <span className="inline-flex flex-wrap items-baseline gap-x-2">
                        <StateText {...dueState[due as keyof typeof dueState]} />
                        {order.status === "partially_received" ? <span className="text-xs text-muted-foreground">Partly received</span> : null}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          </QueueSection>
        </>
      }
      head={
        <>
          <Th>PO</Th>
          <Th>Vendor</Th>
          <Th align="right" priority={3}>
            Lines
          </Th>
          <Th priority={3}>Ordered</Th>
          <Th priority={2}>Expected</Th>
          <Th align="right">Total</Th>
          <Th>Status</Th>
        </>
      }
    >
      {result.items.map((order) => (
        <Tr key={order.id}>
          <Td className={monoCellClass}>
            <Link className={`${cellLinkClass} font-mono text-xs`} href={`/dashboard/platform/purchase-orders/${order.id}${q}`}>
              {shortRef(order.poNumber)}
            </Link>
          </Td>
          <Td>{order.vendor?.name ?? "—"}</Td>
          <Td align="right" priority={3} className="text-muted-foreground">
            {order.linesCount}
          </Td>
          <Td priority={3} className="whitespace-nowrap text-xs text-muted-foreground">
            {formatWhen(order.orderedAt ?? order.createdAt, scope.timezone)}
          </Td>
          <Td priority={2} className="whitespace-nowrap text-xs text-muted-foreground">
            {formatWhen(order.expectedAt, scope.timezone)}
          </Td>
          <Td align="right" className="whitespace-nowrap">
            {formatMoney(order.totalCents, order.currencyCode)}
          </Td>
          <Td>
            <StatusText status={order.status} />
          </Td>
        </Tr>
      ))}
    </QueueListShell>
  );
}

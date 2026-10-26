import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PURCHASE_ORDER_TRANSITIONS } from "@/features/keystone/lib/transitionPolicy";

import { receivePurchaseOrderAction, transitionPurchaseOrderAction } from "../../actions";
import { FactList, PlatformDetailShell } from "../../components/PlatformDetailShell";
import { ActionPanel, EnumField, FormGrid, HiddenScope, SelectField, TextField } from "../../components/PlatformPage";
import { CountBoxes, StatusText, Td, Th, Tr } from "../../components/cv-ui";
import { StateText, TableSection, cellLinkClass, monoCellClass } from "../../stock/components/table-kit";
import { quantityText, shortRef } from "../../lib/labels";
import { employeeName, type EmployeeRef } from "../../lib/people";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { getStoreOptions } from "../../lib/store-options";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";

type Order = {
  id: string;
  poNumber: string;
  status: string;
  currencyCode: string;
  subtotalCents: number;
  taxCents: number;
  shippingCents: number;
  totalCents: number;
  orderedAt: string | null;
  expectedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  notes: string;
  vendor: { id: string; name: string } | null;
  createdBy: EmployeeRef;
  approvedBy: EmployeeRef;
  lines: Array<{ id: string; descriptionSnapshot: string; vendorSkuSnapshot: string; quantityOrdered: string; quantityReceived: string; quantityCancelled: string; unitCostCents: number; lineTotalCents: number; variant: { product: { id: string } | null } | null }>;
  receivings: Array<{ id: string; receivingNumber: string; status: string; vendorDocumentNumber: string; receivedAt: string | null; receivedBy: EmployeeRef; lines: Array<{ id: string; quantityAccepted: string; quantityRejected: string; rejectionReason: string; purchaseOrderLine: { descriptionSnapshot: string } | null }> }>;
};

// Manual targets of transitionPurchaseOrder; received states come from receiving.
const MANUAL_TARGETS: Record<string, string> = { submitted: "Submit", approved: "Approve", cancelled: "Cancel" };
const nextStatuses = (status: string) =>
  ((PURCHASE_ORDER_TRANSITIONS as Record<string, readonly string[]>)[status] ?? [])
    .filter((target) => target in MANUAL_TARGETS)
    .map((target) => ({ value: target, label: MANUAL_TARGETS[target] }));

export async function PurchaseOrderDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PlatformSearch }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const scope = await getPlatformScope(search);
  const [response, options] = await Promise.all([
    keystoneClient<{ purchaseOrder: Order | null }>(
      `query PlatformPurchaseOrder($id: ID!) {
        purchaseOrder(where: { id: $id }) {
          id poNumber status currencyCode subtotalCents taxCents shippingCents totalCents orderedAt expectedAt submittedAt approvedAt cancelledAt notes
          vendor { id name }
          createdBy { employeeNumber user { name } }
          approvedBy { employeeNumber user { name } }
          lines { id descriptionSnapshot vendorSkuSnapshot quantityOrdered quantityReceived quantityCancelled unitCostCents lineTotalCents variant { product { id } } }
          receivings(orderBy: { receivedAt: desc }) {
            id receivingNumber status vendorDocumentNumber receivedAt
            receivedBy { employeeNumber user { name } }
            lines { id quantityAccepted quantityRejected rejectionReason purchaseOrderLine { descriptionSnapshot } }
          }
        }
      }`,
      { id },
    ),
    getStoreOptions(scope),
  ]);
  if (!response.success || !response.data.purchaseOrder) notFound();
  const order = response.data.purchaseOrder;
  const path = `/dashboard/platform/purchase-orders/${order.id}`;
  const q = scopeQuery(scope);
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, order.currencyCode);
  const outstanding = (line: Order["lines"][number]) =>
    Number(line.quantityOrdered) - Number(line.quantityReceived) - Number(line.quantityCancelled);
  const openLines = order.lines.filter((line) => outstanding(line) > 0);
  const receivable = ["approved", "partially_received"].includes(order.status);
  const next = nextStatuses(order.status);
  const totals = order.lines.reduce(
    (sum, line) => ({
      ordered: sum.ordered + Number(line.quantityOrdered),
      received: sum.received + Number(line.quantityReceived),
      cancelled: sum.cancelled + Number(line.quantityCancelled),
      open: sum.open + Math.max(outstanding(line), 0),
    }),
    { ordered: 0, received: 0, cancelled: 0, open: 0 },
  );
  return (
    <PlatformDetailShell
      section="Purchase Orders"
      sectionHref={`/dashboard/platform/purchase-orders${q}`}
      title={`${order.vendor?.name ?? "Vendor"} · ${shortRef(order.poNumber)}`}
      status={order.status}
      meta={`${order.poNumber} · created by ${employeeName(order.createdBy)}`}
      notice={searchValue(search, "notice")}
      error={searchValue(search, "error")}
      aside={
        <>
          {receivable && openLines.length ? (
            <ActionPanel title="Receive a line">
              <FormGrid action={receivePurchaseOrderAction} submit="Receive">
                <HiddenScope projection={scope} returnPath={path} />
                <input type="hidden" name="purchaseOrderId" value={order.id} />
                <SelectField
                  label="Line"
                  name="purchaseOrderLineId"
                  options={openLines.map((line) => ({ id: line.id, label: line.descriptionSnapshot, detail: `${quantityText(outstanding(line).toFixed(4))} open` }))}
                  defaultValue={openLines[0]?.id}
                />
                <SelectField label="Into location" name="locationId" options={options.locations} defaultValue={options.locations[0]?.id} />
                <SelectField label="Received by" name="employeeId" options={options.employees} defaultValue={options.employees[0]?.id} />
                <TextField label="Accepted quantity" name="quantityAccepted" inputMode="decimal" defaultValue={quantityText(outstanding(openLines[0]).toFixed(4))} required />
                <TextField label="Unit cost" name="acceptedUnitCostCents" defaultValue={openLines[0]?.unitCostCents} required />
                <TextField label="Rejected quantity" name="quantityRejected" inputMode="decimal" defaultValue="0" />
                <EnumField
                  label="Rejection reason"
                  name="rejectionReason"
                  values={["none", "damaged", "expired", "wrong_item", "overage", "quality"].map((value) => ({ value, label: value === "none" ? "None" : value.replaceAll("_", " ") }))}
                />
                <TextField label="Invoice or delivery number" name="vendorDocumentNumber" />
                <TextField label="Lot number" name="lotNumber" />
                <TextField label="Expiry (optional)" name="expiresAt" />
              </FormGrid>
            </ActionPanel>
          ) : null}
          {next.length ? (
            <ActionPanel title={receivable ? "Change status" : "Next step"}>
              <FormGrid action={transitionPurchaseOrderAction} submit="Apply">
                <HiddenScope projection={scope} returnPath={path} />
                <input type="hidden" name="purchaseOrderId" value={order.id} />
                <SelectField label="Employee" name="employeeId" options={options.employees} defaultValue={options.employees[0]?.id} />
                <EnumField label="Next" name="nextStatus" values={next} />
              </FormGrid>
            </ActionPanel>
          ) : null}
        </>
      }
    >
      {order.lines.length ? (
        <CountBoxes
          items={[
            { label: "Ordered", value: quantityText(totals.ordered.toFixed(4)) },
            { label: "Received", value: quantityText(totals.received.toFixed(4)) },
            { label: "Cancelled", value: quantityText(totals.cancelled.toFixed(4)) },
            {
              label: "Still to receive",
              value: quantityText(totals.open.toFixed(4)),
              variance: totals.open <= 0 ? 0 : null,
            },
          ]}
        />
      ) : null}
      <FactList
        facts={[
          ["Vendor", order.vendor ? <Link className="hover:underline" href={`/dashboard/platform/vendors/${order.vendor.id}${q}`}>{order.vendor.name}</Link> : "—"],
          ["Total", money(order.totalCents)],
          ["Ordered", formatWhen(order.orderedAt, scope.timezone)],
          ["Expected", formatWhen(order.expectedAt, scope.timezone)],
          ["Approved", order.approvedAt ? `${formatWhen(order.approvedAt, scope.timezone)} · ${employeeName(order.approvedBy)}` : "—"],
          ["Cancelled", order.cancelledAt ? formatWhen(order.cancelledAt, scope.timezone) : "—"],
        ]}
      />
      {order.notes ? <p className="whitespace-pre-line text-sm text-muted-foreground">{order.notes}</p> : null}
      <TableSection
        title="Lines"
        count={order.lines.length}
        empty="No lines"
        head={
          <>
            <Th priority={2}>Vendor SKU</Th>
            <Th>Item</Th>
            <Th align="right">Ordered</Th>
            <Th align="right" priority={2}>
              Received
            </Th>
            <Th align="right">Open</Th>
            <Th align="right" priority={3}>
              Unit cost
            </Th>
            <Th align="right" priority={2}>
              Line total
            </Th>
            <Th>Status</Th>
          </>
        }
      >
        {order.lines.map((line) => {
          const open = outstanding(line);
          const lineState =
            open <= 0
              ? { tone: "ok" as const, label: "Received" }
              : Number(line.quantityReceived) > 0
                ? { tone: "warn" as const, label: "Partly received" }
                : { tone: "info" as const, label: "Open" };
          return (
            <Tr key={line.id}>
              <Td priority={2} className={monoCellClass}>
                {line.vendorSkuSnapshot || "—"}
              </Td>
              <Td>
                {line.variant?.product ? (
                  <Link className={cellLinkClass} href={`/dashboard/platform/products/${line.variant.product.id}${q}`}>
                    {line.descriptionSnapshot}
                  </Link>
                ) : (
                  line.descriptionSnapshot
                )}
                {Number(line.quantityCancelled) ? (
                  <span className="ml-2 text-xs text-muted-foreground">{quantityText(line.quantityCancelled)} cancelled</span>
                ) : null}
              </Td>
              <Td align="right">{quantityText(line.quantityOrdered)}</Td>
              <Td align="right" priority={2}>
                {quantityText(line.quantityReceived)}
              </Td>
              <Td align="right">{quantityText(Math.max(open, 0).toFixed(4))}</Td>
              <Td align="right" priority={3} className="text-muted-foreground">
                {money(line.unitCostCents)}
              </Td>
              <Td align="right" priority={2}>
                {money(line.lineTotalCents)}
              </Td>
              <Td>
                <StateText {...lineState} />
              </Td>
            </Tr>
          );
        })}
      </TableSection>
      <TableSection
        title="Receivings"
        count={order.receivings.length}
        empty="Nothing received yet"
        head={
          <>
            <Th>Receiving</Th>
            <Th priority={2}>Document</Th>
            <Th priority={3}>Received</Th>
            <Th priority={3}>By</Th>
            <Th>Items</Th>
            <Th>Status</Th>
          </>
        }
      >
        {order.receivings.map((receiving) => (
          <Tr key={receiving.id}>
            <Td className={monoCellClass}>{shortRef(receiving.receivingNumber)}</Td>
            <Td priority={2} className={monoCellClass}>
              {receiving.vendorDocumentNumber || "—"}
            </Td>
            <Td priority={3} className="whitespace-nowrap text-xs text-muted-foreground">
              {formatWhen(receiving.receivedAt, scope.timezone)}
            </Td>
            <Td priority={3} className="text-muted-foreground">
              {employeeName(receiving.receivedBy)}
            </Td>
            <Td className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
              {receiving.lines
                .map((line) => `${quantityText(line.quantityAccepted)} × ${line.purchaseOrderLine?.descriptionSnapshot ?? "item"}${Number(line.quantityRejected) ? ` (${quantityText(line.quantityRejected)} rejected${line.rejectionReason && line.rejectionReason !== "none" ? `, ${line.rejectionReason.replaceAll("_", " ")}` : ""})` : ""}`)
                .join(", ")}
            </Td>
            <Td>
              <StatusText status={receiving.status} />
            </Td>
          </Tr>
        ))}
      </TableSection>
    </PlatformDetailShell>
  );
}

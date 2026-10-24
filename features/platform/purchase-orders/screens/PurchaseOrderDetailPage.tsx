import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PURCHASE_ORDER_TRANSITIONS } from "@/features/keystone/lib/transitionPolicy";

import { receivePurchaseOrderAction, transitionPurchaseOrderAction } from "../../actions";
import { BandRow, DetailSection, FactList, PlatformDetailShell } from "../../components/PlatformDetailShell";
import { ActionPanel, EnumField, FormGrid, HiddenScope, SelectField, TextField } from "../../components/PlatformPage";
import { ListBand } from "../../components/cv-ui";
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
          {next.length ? (
            <ActionPanel title="Change status">
              <FormGrid action={transitionPurchaseOrderAction} submit="Apply">
                <HiddenScope projection={scope} returnPath={path} />
                <input type="hidden" name="purchaseOrderId" value={order.id} />
                <SelectField label="Employee" name="employeeId" options={options.employees} defaultValue={options.employees[0]?.id} />
                <EnumField label="Next" name="nextStatus" values={next} />
              </FormGrid>
            </ActionPanel>
          ) : null}
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
        </>
      }
    >
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
      <DetailSection title="Lines" meta={order.lines.length}>
        <ListBand>
          {order.lines.map((line) => {
            const open = outstanding(line);
            return (
              <BandRow
                key={line.id}
                title={line.variant?.product ? <Link className="hover:underline" href={`/dashboard/platform/products/${line.variant.product.id}${q}`}>{line.descriptionSnapshot}</Link> : line.descriptionSnapshot}
                state={open <= 0 ? { tone: "ok", label: "Received" } : Number(line.quantityReceived) > 0 ? { tone: "warn", label: "Partly received" } : null}
                meta={`${line.vendorSkuSnapshot} · ${quantityText(line.quantityReceived)} of ${quantityText(line.quantityOrdered)} received${Number(line.quantityCancelled) ? ` · ${quantityText(line.quantityCancelled)} cancelled` : ""} · ${money(line.unitCostCents)} each`}
                figure={money(line.lineTotalCents)}
              />
            );
          })}
        </ListBand>
      </DetailSection>
      <DetailSection title="Receivings" meta={order.receivings.length || undefined}>
        {order.receivings.length ? (
          <ListBand>
            {order.receivings.map((receiving) => (
              <BandRow
                key={receiving.id}
                title={`${shortRef(receiving.receivingNumber)}${receiving.vendorDocumentNumber ? ` · ${receiving.vendorDocumentNumber}` : ""}`}
                status={receiving.status}
                meta={`${formatWhen(receiving.receivedAt, scope.timezone)} · ${employeeName(receiving.receivedBy)} · ${receiving.lines
                  .map((line) => `${quantityText(line.quantityAccepted)} × ${line.purchaseOrderLine?.descriptionSnapshot ?? "item"}${Number(line.quantityRejected) ? ` (${quantityText(line.quantityRejected)} rejected)` : ""}`)
                  .join(", ")}`}
              />
            ))}
          </ListBand>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing received yet</p>
        )}
      </DetailSection>
    </PlatformDetailShell>
  );
}

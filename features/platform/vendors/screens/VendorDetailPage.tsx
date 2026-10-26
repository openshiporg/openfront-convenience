import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { configureVendorAction, configureVendorItemAction } from "../../actions";
import { FactList, PlatformDetailShell } from "../../components/PlatformDetailShell";
import { ActionPanel, EnumField, FormGrid, HiddenScope, SelectField, TextField } from "../../components/PlatformPage";
import { StatusText, Td, Th, Tr } from "../../components/cv-ui";
import { FormDisclosure, TableSection, cellLinkClass, monoCellClass } from "../../stock/components/table-kit";
import { shortRef } from "../../lib/labels";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";

type Vendor = {
  id: string;
  name: string;
  vendorNumber: string;
  status: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  paymentTerms: string;
  leadTimeDays: number;
  minimumOrderCents: number;
  notes: string;
  items: Array<{ id: string; vendorSku: string; status: string; unitCostCents: number; casePackQuantity: string | null; unitsPerCase: number | null; variant: { id: string; title: string; sku: string; product: { id: string; title: string } | null } | null }>;
  purchaseOrders: Array<{ id: string; poNumber: string; status: string; totalCents: number; currencyCode: string; orderedAt: string | null; expectedAt: string | null }>;
};

export async function VendorDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PlatformSearch }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const scope = await getPlatformScope(search);
  const response = await keystoneClient<{ vendor: Vendor | null; productVariants: Array<{ id: string; title: string; sku: string; product: { title: string } | null }> }>(
    `query PlatformVendor($id: ID!, $businessId: ID!) {
      vendor(where: { id: $id }) {
        id name vendorNumber status contactName email phone website paymentTerms leadTimeDays minimumOrderCents notes
        items(orderBy: { vendorSku: asc }) { id vendorSku status unitCostCents casePackQuantity unitsPerCase variant { id title sku product { id title } } }
        purchaseOrders(orderBy: { createdAt: desc }, take: 25) { id poNumber status totalCents currencyCode orderedAt expectedAt }
      }
      productVariants(where: { business: { id: { equals: $businessId } }, status: { equals: active } }, orderBy: { sku: asc }, take: 200) { id title sku product { title } }
    }`,
    { id, businessId: scope.businessId ?? "" },
  );
  if (!response.success || !response.data.vendor) notFound();
  const vendor = response.data.vendor;
  const path = `/dashboard/platform/vendors/${vendor.id}`;
  const q = scopeQuery(scope);
  const money = (cents: number | null | undefined, currency?: string) => formatMoney(cents ?? 0, currency ?? scope.currencyCode);
  const variantOptions = response.data.productVariants.map((variant) => ({
    id: variant.id,
    label: variant.product?.title ? `${variant.product.title} — ${variant.title}` : variant.title,
    detail: variant.sku,
  }));
  const closed = ["received", "cancelled"];
  const openOrders = vendor.purchaseOrders.filter((order) => !closed.includes(order.status));
  const closedOrders = vendor.purchaseOrders.filter((order) => closed.includes(order.status));
  const orderHead = (
    <>
      <Th>PO</Th>
      <Th priority={2}>Ordered</Th>
      <Th priority={3}>Expected</Th>
      <Th align="right">Total</Th>
      <Th>Status</Th>
    </>
  );
  const orderRow = (order: Vendor["purchaseOrders"][number]) => (
    <Tr key={order.id}>
      <Td>
        <Link className={`${cellLinkClass} font-mono text-xs`} href={`/dashboard/platform/purchase-orders/${order.id}${q}`}>
          {shortRef(order.poNumber)}
        </Link>
      </Td>
      <Td priority={2} className="whitespace-nowrap text-xs text-muted-foreground">
        {formatWhen(order.orderedAt, scope.timezone)}
      </Td>
      <Td priority={3} className="whitespace-nowrap text-xs text-muted-foreground">
        {formatWhen(order.expectedAt, scope.timezone)}
      </Td>
      <Td align="right">{money(order.totalCents, order.currencyCode)}</Td>
      <Td>
        <StatusText status={order.status} />
      </Td>
    </Tr>
  );
  return (
    <PlatformDetailShell
      section="Vendors"
      sectionHref={`/dashboard/platform/vendors${q}`}
      title={vendor.name}
      status={vendor.status}
      meta={[vendor.vendorNumber, vendor.contactName, vendor.phone, vendor.email].filter(Boolean).join(" · ")}
      notice={searchValue(search, "notice")}
      error={searchValue(search, "error")}
      aside={
        <ActionPanel title="Add or update an item">
          <FormGrid action={configureVendorItemAction} submit="Save item">
            <HiddenScope projection={scope} returnPath={path} />
            <input type="hidden" name="vendorId" value={vendor.id} />
            <SelectField label="Item" name="variantId" options={variantOptions} />
            <TextField label="Vendor SKU" name="vendorSku" required />
            <TextField label="Case pack quantity" name="casePackQuantity" inputMode="decimal" defaultValue="1" required />
            <TextField label="Units per case" name="unitsPerCase" type="number" min="1" step="1" defaultValue="1" required />
            <TextField label="Unit cost" name="unitCostCents" required />
            <TextField label="Lead time (days)" name="leadTimeDays" type="number" min="0" step="1" defaultValue={vendor.leadTimeDays} />
          </FormGrid>
        </ActionPanel>
      }
    >
      <FactList
        facts={[
          ["Payment terms", vendor.paymentTerms.replaceAll("_", " ").toUpperCase()],
          ["Lead time", `${vendor.leadTimeDays} days`],
          ["Minimum order", money(vendor.minimumOrderCents)],
          ["Items", String(vendor.items.length)],
          ["Website", vendor.website || "—"],
          ["Orders", String(vendor.purchaseOrders.length)],
        ]}
      />
      {vendor.notes ? <p className="whitespace-pre-line text-sm text-muted-foreground">{vendor.notes}</p> : null}
      <TableSection
        title="Open purchase orders"
        count={openOrders.length}
        empty="No open purchase orders"
        head={orderHead}
      >
        {openOrders.map(orderRow)}
      </TableSection>
      <TableSection
        title="Items"
        count={vendor.items.length}
        empty="No items"
        head={
          <>
            <Th>Vendor SKU</Th>
            <Th>Item</Th>
            <Th priority={2}>Our SKU</Th>
            <Th align="right" priority={3}>
              Per case
            </Th>
            <Th align="right">Unit cost</Th>
            <Th>Status</Th>
          </>
        }
      >
        {vendor.items.map((item) => (
          <Tr key={item.id}>
            <Td className={monoCellClass}>{item.vendorSku}</Td>
            <Td>
              <Link className={cellLinkClass} href={`/dashboard/platform/products/${item.variant?.product?.id ?? ""}${q}`}>
                {[item.variant?.product?.title ?? "Item", item.variant?.title].filter(Boolean).join(" — ")}
              </Link>
            </Td>
            <Td priority={2} className={monoCellClass}>
              {item.variant?.sku ?? "—"}
            </Td>
            <Td align="right" priority={3} className="text-muted-foreground">
              {item.unitsPerCase ?? "—"}
            </Td>
            <Td align="right">{money(item.unitCostCents)}</Td>
            <Td>
              <StatusText status={item.status} />
            </Td>
          </Tr>
        ))}
      </TableSection>
      <TableSection
        title="Order history"
        count={closedOrders.length}
        empty="No received or cancelled orders"
        head={orderHead}
      >
        {closedOrders.map(orderRow)}
      </TableSection>
      <FormDisclosure summary="Edit vendor">
        <ActionPanel title="Edit vendor">
          <FormGrid action={configureVendorAction} submit="Save vendor">
            <HiddenScope projection={scope} returnPath={path} />
            <TextField label="Name" name="name" defaultValue={vendor.name} required />
            <input type="hidden" name="vendorNumber" value={vendor.vendorNumber} />
            <EnumField
              label="Payment terms"
              name="paymentTerms"
              defaultValue={vendor.paymentTerms}
              values={["cod", "net_7", "net_15", "net_30", "net_60", "prepaid"].map((value) => ({ value, label: value.replaceAll("_", " ").toUpperCase() }))}
            />
            <TextField label="Contact" name="contactName" defaultValue={vendor.contactName} />
            <TextField label="Email" name="email" type="email" defaultValue={vendor.email} />
            <TextField label="Phone" name="phone" type="tel" defaultValue={vendor.phone} />
            <TextField label="Lead time (days)" name="leadTimeDays" type="number" min="0" step="1" defaultValue={vendor.leadTimeDays} />
            <TextField label="Minimum order" name="minimumOrderCents" defaultValue={vendor.minimumOrderCents} />
          </FormGrid>
        </ActionPanel>
      </FormDisclosure>
    </PlatformDetailShell>
  );
}

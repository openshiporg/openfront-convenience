import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { configureVendorAction, configureVendorItemAction } from "../../actions";
import { BandRow, DetailSection, FactList, PlatformDetailShell } from "../../components/PlatformDetailShell";
import { ActionPanel, EnumField, FormGrid, HiddenScope, SelectField, TextField } from "../../components/PlatformPage";
import { ListBand } from "../../components/cv-ui";
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
      <DetailSection title="Items" meta={vendor.items.length}>
        {vendor.items.length ? (
          <ListBand>
            {vendor.items.map((item) => (
              <Link key={item.id} href={`/dashboard/platform/products/${item.variant?.product?.id ?? ""}${q}`} className="block hover:bg-background">
                <BandRow
                  title={`${item.variant?.product?.title ?? "Item"} — ${item.variant?.title ?? ""}`}
                  status={item.status}
                  meta={`${item.vendorSku} · ${item.variant?.sku ?? ""}${item.unitsPerCase ? ` · ${item.unitsPerCase} per case` : ""}`}
                  figure={money(item.unitCostCents)}
                />
              </Link>
            ))}
          </ListBand>
        ) : (
          <p className="text-sm text-muted-foreground">No items</p>
        )}
      </DetailSection>
      <DetailSection title="Purchase orders" meta={vendor.purchaseOrders.length}>
        {vendor.purchaseOrders.length ? (
          <ListBand>
            {vendor.purchaseOrders.map((order) => (
              <Link key={order.id} href={`/dashboard/platform/purchase-orders/${order.id}${q}`} className="block hover:bg-background">
                <BandRow
                  title={shortRef(order.poNumber)}
                  status={order.status}
                  meta={`ordered ${formatWhen(order.orderedAt, scope.timezone)}${order.expectedAt ? ` · expected ${formatWhen(order.expectedAt, scope.timezone)}` : ""}`}
                  figure={money(order.totalCents, order.currencyCode)}
                />
              </Link>
            ))}
          </ListBand>
        ) : (
          <p className="text-sm text-muted-foreground">No purchase orders</p>
        )}
      </DetailSection>
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
    </PlatformDetailShell>
  );
}

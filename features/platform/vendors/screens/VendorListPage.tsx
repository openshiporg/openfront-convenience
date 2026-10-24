import { ListRow, PlatformListShell } from "../../components/PlatformListShell";
import { loadPlatformList } from "../../lib/list-query";
import type { PlatformSearch } from "../../lib/projection";
import { formatMoney, getPlatformScope, scopeQuery } from "../../lib/scope";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_hold", label: "On hold" },
  { value: "archived", label: "Archived" },
];

type VendorRow = {
  id: string;
  name: string;
  vendorNumber: string;
  status: string;
  paymentTerms: string;
  leadTimeDays: number;
  minimumOrderCents: number;
  contactName: string;
  phone: string;
  itemsCount: number;
  purchaseOrdersCount: number;
};

export async function VendorListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const result = await loadPlatformList<VendorRow>({
    path: "vendors",
    search,
    scopeWhere: { business: { id: { equals: scope.businessId ?? "" } } },
    statuses: STATUSES,
    selection: `id name vendorNumber status paymentTerms leadTimeDays minimumOrderCents contactName phone itemsCount purchaseOrdersCount`,
  });
  return (
    <PlatformListShell
      title="Vendors"
      scope={scope}
      basePath="/dashboard/platform/vendors"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "vendor", plural: "vendors" }}
      empty="No vendors"
    >
      {result.items.map((vendor) => (
        <ListRow
          key={vendor.id}
          href={`/dashboard/platform/vendors/${vendor.id}${scopeQuery(scope)}`}
          title={vendor.name}
          status={vendor.status}
          meta={[
            vendor.vendorNumber,
            vendor.paymentTerms.replaceAll("_", " ").toUpperCase(),
            `${vendor.leadTimeDays}-day lead time`,
            vendor.contactName || null,
            vendor.phone || null,
          ]
            .filter(Boolean)
            .join(" · ")}
          figure={`${vendor.itemsCount} ${vendor.itemsCount === 1 ? "item" : "items"}`}
          figureMeta={`${vendor.purchaseOrdersCount} orders · min ${formatMoney(vendor.minimumOrderCents, scope.currencyCode)}`}
        />
      ))}
    </PlatformListShell>
  );
}

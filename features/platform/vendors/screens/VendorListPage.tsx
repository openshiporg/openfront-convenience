import Link from "next/link";

import { StatusText, Td, Th, Tr } from "../../components/cv-ui";
import { QueueListShell, cellLinkClass, monoCellClass } from "../../stock/components/table-kit";
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
    <QueueListShell
      title="Vendors"
      scope={scope}
      basePath="/dashboard/platform/vendors"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "vendor", plural: "vendors" }}
      empty="No vendors"
      head={
        <>
          <Th priority={2}>Vendor #</Th>
          <Th>Vendor</Th>
          <Th priority={2}>Terms</Th>
          <Th align="right" priority={3}>
            Lead time
          </Th>
          <Th priority={3}>Contact</Th>
          <Th align="right">Items</Th>
          <Th align="right" priority={2}>
            Orders
          </Th>
          <Th align="right" priority={3}>
            Minimum
          </Th>
          <Th>Status</Th>
        </>
      }
    >
      {result.items.map((vendor) => (
        <Tr key={vendor.id}>
          <Td priority={2} className={monoCellClass}>
            {vendor.vendorNumber}
          </Td>
          <Td>
            <Link className={cellLinkClass} href={`/dashboard/platform/vendors/${vendor.id}${scopeQuery(scope)}`}>
              {vendor.name}
            </Link>
          </Td>
          <Td priority={2} className="whitespace-nowrap text-muted-foreground">
            {vendor.paymentTerms.replaceAll("_", " ").toUpperCase()}
          </Td>
          <Td align="right" priority={3} className="text-muted-foreground">
            {vendor.leadTimeDays}d
          </Td>
          <Td priority={3} className="text-muted-foreground">
            {[vendor.contactName, vendor.phone].filter(Boolean).join(" · ") || "—"}
          </Td>
          <Td align="right">{vendor.itemsCount}</Td>
          <Td align="right" priority={2}>
            {vendor.purchaseOrdersCount}
          </Td>
          <Td align="right" priority={3} className="text-muted-foreground">
            {formatMoney(vendor.minimumOrderCents, scope.currencyCode)}
          </Td>
          <Td>
            <StatusText status={vendor.status} />
          </Td>
        </Tr>
      ))}
    </QueueListShell>
  );
}

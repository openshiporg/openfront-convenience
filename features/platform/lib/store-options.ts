import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import type { PlatformOption } from "./projection";
import type { PlatformScope } from "./scope";

/** Active employees and stock locations of the selected store, for action forms. */
export async function getStoreOptions(scope: PlatformScope): Promise<{ employees: PlatformOption[]; locations: PlatformOption[] }> {
  if (!scope.businessId || !scope.storeId) return { employees: [], locations: [] };
  const response = await keystoneClient<{
    employees: Array<{ id: string; employeeNumber: string; user: { name: string | null } | null }>;
    inventoryLocations: Array<{ id: string; name: string; code: string }>;
  }>(
    `query PlatformStoreOptions($businessId: ID!, $storeId: ID!) {
      employees(
        where: { business: { id: { equals: $businessId } }, status: { equals: active }, stores: { some: { id: { equals: $storeId } } } }
        orderBy: { employeeNumber: asc }
        take: 100
      ) { id employeeNumber user { name } }
      inventoryLocations(where: { store: { id: { equals: $storeId } }, status: { equals: active } }, orderBy: { name: asc }, take: 100) { id name code }
    }`,
    { businessId: scope.businessId, storeId: scope.storeId },
  );
  if (!response.success) return { employees: [], locations: [] };
  return {
    employees: response.data.employees.map((entry) => ({ id: entry.id, label: entry.user?.name?.trim() || entry.employeeNumber })),
    locations: response.data.inventoryLocations.map((entry) => ({ id: entry.id, label: entry.name })),
  };
}

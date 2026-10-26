import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { configureInventoryLocationAction, configureRegisterAction } from "../actions";
import { EnumField, FormGrid, HiddenScope, TextField } from "../components/PlatformPage";
import { DataTable, SectionTitle, StatusText, Td, Th, Tr, statusLabel } from "../components/cv-ui";
import { ActionBar, Disclosure, NoteLine } from "../reconciliation/ledger-ui";

const LOCATION_TYPES = ["sales_floor", "back_room", "cooler", "freezer", "kitchen", "warehouse"];

/** Registers and stock locations of one store, with add/update forms (by code). */
export async function StoreResources({
  businessId,
  storeId,
  storeName,
  timezone,
  returnPath,
}: {
  businessId: string;
  storeId: string;
  storeName: string;
  timezone: string | null;
  returnPath: string;
}) {
  const response = await keystoneClient<{
    registers: Array<{ id: string; name: string; code: string; status: string }>;
    inventoryLocations: Array<{ id: string; name: string; code: string; type: string; status: string; stockLevelsCount: number }>;
  }>(
    `query PlatformStoreResources($storeId: ID!) {
      registers(where: { store: { id: { equals: $storeId } } }, orderBy: { name: asc }) { id name code status }
      inventoryLocations(where: { store: { id: { equals: $storeId } } }, orderBy: { name: asc }) { id name code type status stockLevelsCount }
    }`,
    { storeId },
  );
  const registers = response.success ? response.data.registers : [];
  const locations = response.success ? response.data.inventoryLocations : [];
  const scope = { businessId, storeId, timezone };
  return (
    <section className="min-w-0 space-y-4" aria-label="Registers and locations">
      <SectionTitle meta={storeName}>Registers and stock locations</SectionTitle>
      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-3">
          {registers.length ? (
            <DataTable aria-label="Registers">
              <thead>
                <tr>
                  <Th>Register</Th>
                  <Th>Status</Th>
                  <Th>Code</Th>
                </tr>
              </thead>
              <tbody>
                {registers.map((register) => (
                  <Tr key={register.id}>
                    <Td className="font-medium">{register.name}</Td>
                    <Td><StatusText status={register.status} /></Td>
                    <Td className="font-mono text-[12px] text-muted-foreground">{register.code}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <NoteLine>No registers yet</NoteLine>
          )}
          <ActionBar>
            <Disclosure label="Add or update a register" title="Register" defaultOpen={!registers.length}>
              <FormGrid action={configureRegisterAction} submit="Save register">
                <HiddenScope projection={scope} returnPath={returnPath} />
                <TextField label="Name" name="name" required maxLength={80} />
                <TextField label="Code" name="code" required pattern="[a-z0-9][a-z0-9\-]*" />
                <EnumField
                  label="Status"
                  name="status"
                  values={["active", "offline", "maintenance", "retired"].map((value) => ({ value, label: statusLabel(value) }))}
                />
              </FormGrid>
            </Disclosure>
          </ActionBar>
        </div>
        <div className="min-w-0 space-y-3">
          {locations.length ? (
            <DataTable aria-label="Stock locations">
              <thead>
                <tr>
                  <Th>Location</Th>
                  <Th>Status</Th>
                  <Th priority={2}>Type</Th>
                  <Th priority={3}>Code</Th>
                  <Th align="right">Items</Th>
                </tr>
              </thead>
              <tbody>
                {locations.map((location) => (
                  <Tr key={location.id}>
                    <Td className="font-medium">{location.name}</Td>
                    <Td><StatusText status={location.status} /></Td>
                    <Td priority={2} className="text-muted-foreground">{statusLabel(location.type)}</Td>
                    <Td priority={3} className="font-mono text-[12px] text-muted-foreground">{location.code}</Td>
                    <Td align="right">{location.stockLevelsCount}</Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <NoteLine>No stock locations yet</NoteLine>
          )}
          <ActionBar>
            <Disclosure label="Add or update a location" title="Stock location" defaultOpen={!locations.length}>
              <FormGrid action={configureInventoryLocationAction} submit="Save location">
                <HiddenScope projection={scope} returnPath={returnPath} />
                <TextField label="Name" name="name" required maxLength={80} />
                <TextField label="Code" name="code" required pattern="[a-z0-9][a-z0-9\-]*" />
                <EnumField label="Type" name="type" values={LOCATION_TYPES.map((value) => ({ value, label: statusLabel(value) }))} />
                <EnumField label="Status" name="status" values={["active", "inactive"].map((value) => ({ value, label: statusLabel(value) }))} />
              </FormGrid>
            </Disclosure>
          </ActionBar>
        </div>
      </div>
    </section>
  );
}

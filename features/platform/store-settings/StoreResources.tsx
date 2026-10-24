import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { configureInventoryLocationAction, configureRegisterAction } from "../actions";
import { BandRow } from "../components/PlatformDetailShell";
import { ActionPanel, EnumField, FormGrid, HiddenScope, TextField } from "../components/PlatformPage";
import { ListBand, SectionTitle, statusLabel } from "../components/cv-ui";

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
      <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <ListBand>
            {registers.map((register) => (
              <BandRow key={register.id} title={register.name} status={register.status} meta={register.code} />
            ))}
          </ListBand>
          <ActionPanel title="Add or update a register">
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
          </ActionPanel>
        </div>
        <div className="min-w-0 space-y-3">
          <ListBand>
            {locations.map((location) => (
              <BandRow
                key={location.id}
                title={location.name}
                status={location.status}
                meta={`${location.code} · ${statusLabel(location.type)} · ${location.stockLevelsCount} stocked ${location.stockLevelsCount === 1 ? "item" : "items"}`}
              />
            ))}
          </ListBand>
          <ActionPanel title="Add or update a location">
            <FormGrid action={configureInventoryLocationAction} submit="Save location">
              <HiddenScope projection={scope} returnPath={returnPath} />
              <TextField label="Name" name="name" required maxLength={80} />
              <TextField label="Code" name="code" required pattern="[a-z0-9][a-z0-9\-]*" />
              <EnumField label="Type" name="type" values={LOCATION_TYPES.map((value) => ({ value, label: statusLabel(value) }))} />
              <EnumField label="Status" name="status" values={["active", "inactive"].map((value) => ({ value, label: statusLabel(value) }))} />
            </FormGrid>
          </ActionPanel>
        </div>
      </div>
    </section>
  );
}

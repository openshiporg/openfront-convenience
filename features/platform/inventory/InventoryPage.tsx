import {
  approveInventoryCountAction,
  createInventoryCountAction,
  draftInventoryTransferAction,
  postInventoryAdjustmentAction,
  recordInventoryCountLineAction,
  transitionInventoryCountAction,
  transitionInventoryTransferAction,
} from "../actions";
import {
  ActionPanel,
  EnumField,
  EvidenceTable,
  FormGrid,
  HiddenScope,
  LookupForm,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { PanelGrid } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";

const path = "/dashboard/platform/inventory";

export async function InventoryPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("inventory", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const recentCountLineOptions = controls.inventoryCountLines ?? [];
  const countLineHydrationStatus =
    controls.inventoryCountLineHydrationStatus?.[0]?.id;
  const searchedCountLineOptions =
    state.inventoryCountSearch && countLineHydrationStatus === "loaded"
      ? (controls.inventoryCountLineLookup ?? []).filter(
          (searched) =>
            !recentCountLineOptions.some((recent) => recent.id === searched.id),
        )
      : [];
  const captureCountLineOptions = [
    ...recentCountLineOptions,
    ...searchedCountLineOptions,
  ];
  return <PlatformPage title="Inventory" {...state}>
    {projection ? (
      <Workbench
        scope="inventory"
        sections={[
          {
            id: "stock",
            label: "Stock",
            count: projection.rows.length,
            content: (
              <EvidenceTable rows={projection.rows} timeZone={projection.timezone} title="Stock positions" />
            ),
          },
          {
            id: "counts",
            label: "Counts",
            content: (
              <>
                <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId, inventoryVariantSearch: state.inventoryVariantSearch, inventoryTransferSearch: state.inventoryTransferSearch, inventoryLocationSearch: state.inventoryLocationSearch }}
                    name="inventoryCountSearch"
                    label="Count number"
                    placeholder="Full count number"
                    defaultValue={state.inventoryCountSearch}
                    submit="Find"
                    empty={state.inventoryCountSearch && !controls.inventoryCountHistory?.length ? "No open count with that number" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId, inventoryCountSearch: state.inventoryCountSearch, inventoryVariantSearch: state.inventoryVariantSearch, inventoryTransferSearch: state.inventoryTransferSearch }}
                    name="inventoryLocationSearch"
                    label="Location"
                    placeholder="Name or code"
                    defaultValue={state.inventoryLocationSearch}
                    submit="Find"
                    empty={state.inventoryLocationSearch && !controls.inventoryLocations?.length ? "No matching location" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId, inventoryCountSearch: state.inventoryCountSearch, inventoryTransferSearch: state.inventoryTransferSearch, inventoryLocationSearch: state.inventoryLocationSearch }}
                    name="inventoryVariantSearch"
                    label="Item"
                    placeholder="Title or SKU"
                    defaultValue={state.inventoryVariantSearch}
                    submit="Find"
                    empty={state.inventoryVariantSearch && !controls.productVariants?.length ? "No matching item" : false}
                  />
                </div>
                <PanelGrid>
                  <ActionPanel title="Start inventory count">
                    <FormGrid action={createInventoryCountAction} submit="Start count">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Location" name="locationId" options={controls.inventoryLocations ?? []} />
                      <SelectField label="Employee" name="employeeId" options={controls.employees ?? []} />
                      <EnumField label="Count type" name="type" values={[{ value: "cycle", label: "Cycle" }, { value: "spot", label: "Spot" }, { value: "full", label: "Full" }]} />
                      <SelectField label="Single variant (optional)" name="variantId" options={controls.productVariants ?? []} required={false} />
                      <TextField label="Notes" name="notes" />
                    </FormGrid>
                  </ActionPanel>
                  <ActionPanel title="Capture count line">
                    <FormGrid action={recordInventoryCountLineAction} submit="Record quantity">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Open count line" name="countLineId" options={captureCountLineOptions} />
                      <SelectField label="Counter" name="employeeId" options={controls.employees ?? []} />
                      <TextField label="Actual quantity" name="actualQuantity" inputMode="decimal" required />
                      <TextField label="Unit cost when count discovers stock (cents)" name="unitCostCents" type="number" min="0" step="1" />
                      <TextField label="Lot number for discovered stock" name="lotNumber" />
                      <TextField label="Lot expiry (ISO, optional)" name="expiresAt" />
                      <TextField label="Variance reason" name="reason" />
                    </FormGrid>
                  </ActionPanel>
                  <ActionPanel title="Advance inventory count">
                    <FormGrid action={transitionInventoryCountAction} submit="Advance count">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Inventory count" name="countId" options={controls.inventoryCountHistory ?? []} />
                      <SelectField label="Employee" name="employeeId" options={controls.employees ?? []} />
                      <EnumField label="Next state" name="nextStatus" values={[{ value: "submitted", label: "Submit" }, { value: "cancelled", label: "Cancel" }]} />
                    </FormGrid>
                  </ActionPanel>
                  <ActionPanel title="Approve count">
                    <FormGrid action={approveInventoryCountAction} submit="Approve and post">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Submitted count" name="countId" options={controls.inventoryCountHistory ?? []} />
                      <SelectField label="Approver" name="employeeId" options={controls.employees ?? []} />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
              </>
            ),
          },
          {
            id: "transfers",
            label: "Transfers",
            content: (
              <>
                <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId, inventoryCountSearch: state.inventoryCountSearch, inventoryVariantSearch: state.inventoryVariantSearch, inventoryLocationSearch: state.inventoryLocationSearch }}
                    name="inventoryTransferSearch"
                    label="Transfer number"
                    placeholder="Full transfer number"
                    defaultValue={state.inventoryTransferSearch}
                    submit="Find"
                    empty={state.inventoryTransferSearch && !controls.inventoryTransferHistory?.length ? "No open transfer with that number" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId, inventoryCountSearch: state.inventoryCountSearch, inventoryVariantSearch: state.inventoryVariantSearch, inventoryTransferSearch: state.inventoryTransferSearch }}
                    name="inventoryLocationSearch"
                    label="Location"
                    placeholder="Name or code"
                    defaultValue={state.inventoryLocationSearch}
                    submit="Find"
                    empty={state.inventoryLocationSearch && !controls.inventoryLocations?.length ? "No matching location" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId, inventoryCountSearch: state.inventoryCountSearch, inventoryTransferSearch: state.inventoryTransferSearch, inventoryLocationSearch: state.inventoryLocationSearch }}
                    name="inventoryVariantSearch"
                    label="Item"
                    placeholder="Title or SKU"
                    defaultValue={state.inventoryVariantSearch}
                    submit="Find"
                    empty={state.inventoryVariantSearch && !controls.productVariants?.length ? "No matching item" : false}
                  />
                </div>
                <PanelGrid>
                  <ActionPanel title="Draft inter-store transfer">
                    <FormGrid action={draftInventoryTransferAction} submit="Draft transfer">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Destination store" name="destinationStoreId" options={projection.stores} />
                      <SelectField label="Source location" name="sourceLocationId" options={controls.inventoryLocations ?? []} />
                      <SelectField label="Destination location" name="destinationLocationId" options={controls.inventoryLocations ?? []} />
                      <SelectField label="Employee assigned to both stores" name="employeeId" options={controls.employees ?? []} />
                      <SelectField label="Product variant" name="variantId" options={controls.productVariants ?? []} />
                      <TextField label="Quantity" name="quantity" inputMode="decimal" required />
                      <TextField label="Transfer notes" name="notes" />
                    </FormGrid>
                  </ActionPanel>
                  <ActionPanel title="Advance transfer custody">
                    <FormGrid action={transitionInventoryTransferAction} submit="Advance transfer">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Open transfer" name="transferId" options={controls.inventoryTransferHistory ?? []} />
                      <SelectField label="Employee assigned to both stores" name="employeeId" options={controls.employees ?? []} />
                      <EnumField label="Next state" name="nextStatus" values={[{ value: "approved", label: "Approve" }, { value: "shipped", label: "Ship" }, { value: "received", label: "Receive" }, { value: "cancelled", label: "Cancel" }]} />
                      <TextField label="Lifecycle notes" name="notes" />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
              </>
            ),
          },
          {
            id: "adjust",
            label: "Adjustments",
            content: (
              <>
                <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId, inventoryCountSearch: state.inventoryCountSearch, inventoryVariantSearch: state.inventoryVariantSearch, inventoryTransferSearch: state.inventoryTransferSearch }}
                    name="inventoryLocationSearch"
                    label="Location"
                    placeholder="Name or code"
                    defaultValue={state.inventoryLocationSearch}
                    submit="Find"
                    empty={state.inventoryLocationSearch && !controls.inventoryLocations?.length ? "No matching location" : false}
                  />
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId, inventoryCountSearch: state.inventoryCountSearch, inventoryTransferSearch: state.inventoryTransferSearch, inventoryLocationSearch: state.inventoryLocationSearch }}
                    name="inventoryVariantSearch"
                    label="Item"
                    placeholder="Title or SKU"
                    defaultValue={state.inventoryVariantSearch}
                    submit="Find"
                    empty={state.inventoryVariantSearch && !controls.productVariants?.length ? "No matching item" : false}
                  />
                </div>
                <PanelGrid>
                  <ActionPanel title="Post exceptional adjustment">
                    <FormGrid action={postInventoryAdjustmentAction} submit="Post adjustment">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Location" name="locationId" options={controls.inventoryLocations ?? []} />
                      <SelectField label="Product variant" name="variantId" options={controls.productVariants ?? []} />
                      <SelectField label="Employee" name="employeeId" options={controls.employees ?? []} />
                      <EnumField label="Adjustment type" name="type" values={[{ value: "correction", label: "Correction" }, { value: "opening_balance", label: "Opening balance" }, { value: "waste", label: "Waste" }, { value: "spoilage", label: "Spoilage" }, { value: "theft", label: "Theft" }]} />
                      <TextField label="Quantity delta" name="quantityDelta" placeholder="-2.0000" inputMode="decimal" required />
                      <TextField label="Unit cost for positive adjustments (cents)" name="unitCostCents" type="number" min="0" step="1" />
                      <TextField label="Lot number for positive adjustments" name="lotNumber" />
                      <TextField label="Lot expiry (ISO, optional)" name="expiresAt" />
                      <TextField label="Reason" name="reason" required />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
              </>
            ),
          },
        ]}
      />
    ) : null}
  </PlatformPage>;
}

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
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
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
  return <PlatformPage title="Inventory" description="Stock levels, lots, counts and adjustments." {...state}>
    {projection ? <>
      <section
        aria-label="Find authorized inventory locations"
        className="grid min-w-0 gap-2 border bg-background p-4"
      >
        <form
          action={path}
          method="get"
          className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <input
            type="hidden"
            name="businessId"
            value={projection.businessId ?? ""}
          />
          <input
            type="hidden"
            name="storeId"
            value={projection.storeId ?? ""}
          />
          <input
            type="hidden"
            name="inventoryCountSearch"
            value={state.inventoryCountSearch ?? ""}
          />
          <input
            type="hidden"
            name="inventoryVariantSearch"
            value={state.inventoryVariantSearch ?? ""}
          />
          <input
            type="hidden"
            name="inventoryTransferSearch"
            value={state.inventoryTransferSearch ?? ""}
          />
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Location name or code prefix (or exact code)
            <input
              type="search"
              name="inventoryLocationSearch"
              minLength={2}
              maxLength={80}
              autoComplete="off"
              defaultValue={state.inventoryLocationSearch ?? ""}
              placeholder="At least 2 characters"
              className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          >
            Search locations
          </button>
        </form>
        {state.inventoryLocationSearch && !controls.inventoryLocations?.length ? (
          <p className="text-sm text-muted-foreground" role="status">
            No active location match is available in the authorized store set.
          </p>
        ) : null}
      </section>
      <section
        aria-label="Find an older actionable inventory count"
        className="grid min-w-0 gap-2 border bg-background p-4"
      >
        <form
          action={path}
          method="get"
          className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <input
            type="hidden"
            name="businessId"
            value={projection.businessId ?? ""}
          />
          <input
            type="hidden"
            name="storeId"
            value={projection.storeId ?? ""}
          />
          <input
            type="hidden"
            name="inventoryVariantSearch"
            value={state.inventoryVariantSearch ?? ""}
          />
          <input
            type="hidden"
            name="inventoryTransferSearch"
            value={state.inventoryTransferSearch ?? ""}
          />
          <input
            type="hidden"
            name="inventoryLocationSearch"
            value={state.inventoryLocationSearch ?? ""}
          />
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Exact count number (draft, counting, or submitted)
            <input
              type="search"
              name="inventoryCountSearch"
              minLength={2}
              maxLength={80}
              autoComplete="off"
              defaultValue={state.inventoryCountSearch ?? ""}
              placeholder="Enter the full count number"
              className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          >
            Find count
          </button>
        </form>
        {state.inventoryCountSearch &&
        !controls.inventoryCountHistory?.length ? (
          <p className="text-sm text-muted-foreground" role="status">
            No actionable exact count match is available in this authorized
            store.
          </p>
        ) : null}
        {state.inventoryCountSearch &&
        countLineHydrationStatus === "loaded" ? (
          <p className="text-sm text-muted-foreground" role="status">
            Capture options include all {
              controls.inventoryCountLineHydrationStatus?.[0]?.detail
            } lines from this counting count, deduplicated with the recent list.
          </p>
        ) : null}
        {state.inventoryCountSearch &&
        countLineHydrationStatus === "unavailable" ? (
          <p className="text-sm text-amber-700 dark:text-amber-300" role="status">
            This count exceeds 1,000 lines. Its exact line set is withheld; the
            recent global options may be incomplete for this count.
          </p>
        ) : null}
        {state.inventoryCountSearch &&
        countLineHydrationStatus === "not_counting" ? (
          <p className="text-sm text-muted-foreground" role="status">
            This count is not currently counting; its lines are not eligible
            for capture.
          </p>
        ) : null}
        {state.inventoryCountSearch &&
        countLineHydrationStatus === "empty" ? (
          <p className="text-sm text-muted-foreground" role="status">
            No lines are available on this counting count.
          </p>
        ) : null}
      </section>
      <section
        aria-label="Find tracked inventory variants"
        className="grid min-w-0 gap-2 border bg-background p-4"
      >
        <form
          action={path}
          method="get"
          className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <input
            type="hidden"
            name="businessId"
            value={projection.businessId ?? ""}
          />
          <input
            type="hidden"
            name="storeId"
            value={projection.storeId ?? ""}
          />
          <input
            type="hidden"
            name="inventoryCountSearch"
            value={state.inventoryCountSearch ?? ""}
          />
          <input
            type="hidden"
            name="inventoryTransferSearch"
            value={state.inventoryTransferSearch ?? ""}
          />
          <input
            type="hidden"
            name="inventoryLocationSearch"
            value={state.inventoryLocationSearch ?? ""}
          />
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Find an active tracked variant by title or SKU
            <input
              type="search"
              name="inventoryVariantSearch"
              minLength={2}
              maxLength={80}
              autoComplete="off"
              defaultValue={state.inventoryVariantSearch ?? ""}
              placeholder="At least 2 characters"
              className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          >
            Search variants
          </button>
        </form>
        {state.inventoryVariantSearch && !controls.productVariants?.length ? (
          <p className="text-sm text-muted-foreground" role="status">
            No active tracked variant match is available in this business.
          </p>
        ) : null}
      </section>
      <section
        aria-label="Find inventory transfers"
        className="grid min-w-0 gap-2 border bg-background p-4"
      >
        <form
          action={path}
          method="get"
          className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <input
            type="hidden"
            name="businessId"
            value={projection.businessId ?? ""}
          />
          <input
            type="hidden"
            name="storeId"
            value={projection.storeId ?? ""}
          />
          <input
            type="hidden"
            name="inventoryCountSearch"
            value={state.inventoryCountSearch ?? ""}
          />
          <input
            type="hidden"
            name="inventoryVariantSearch"
            value={state.inventoryVariantSearch ?? ""}
          />
          <input
            type="hidden"
            name="inventoryLocationSearch"
            value={state.inventoryLocationSearch ?? ""}
          />
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Exact transfer number touching this store
            <input
              type="search"
              name="inventoryTransferSearch"
              minLength={2}
              maxLength={80}
              autoComplete="off"
              defaultValue={state.inventoryTransferSearch ?? ""}
              placeholder="Enter the full transfer number"
              className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          >
            Find transfer
          </button>
        </form>
        {state.inventoryTransferSearch &&
        !controls.inventoryTransferHistory?.length ? (
          <p className="text-sm text-muted-foreground" role="status">
            No actionable exact transfer match is available for this store.
          </p>
        ) : null}
      </section>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ActionPanel title="Start inventory count" description="Snapshots current stock positions at one location. Leave variant blank for all positions, bounded to 1,000 lines.">
          <FormGrid action={createInventoryCountAction} submit="Start count">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Location" name="locationId" options={controls.inventoryLocations ?? []} />
            <SelectField label="Employee" name="employeeId" options={controls.employees ?? []} />
            <EnumField label="Count type" name="type" values={[{ value: "cycle", label: "Cycle" }, { value: "spot", label: "Spot" }, { value: "full", label: "Full" }]} />
            <SelectField label="Single variant (optional)" name="variantId" options={controls.productVariants ?? []} required={false} />
            <TextField label="Notes" name="notes" />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Capture count line" description="Records actual quantity and variance while the count remains open.">
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
        <ActionPanel title="Advance inventory count" description="Submission requires actual quantities on every line.">
          <FormGrid action={transitionInventoryCountAction} submit="Advance count">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Inventory count" name="countId" options={controls.inventoryCountHistory ?? []} />
            <SelectField label="Employee" name="employeeId" options={controls.employees ?? []} />
            <EnumField label="Next state" name="nextStatus" values={[{ value: "submitted", label: "Submit" }, { value: "cancelled", label: "Cancel" }]} />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Approve count" description="Posts one immutable count-adjustment ledger entry per line and updates stock atomically.">
          <FormGrid action={approveInventoryCountAction} submit="Approve and post">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Submitted count" name="countId" options={controls.inventoryCountHistory ?? []} />
            <SelectField label="Approver" name="employeeId" options={controls.employees ?? []} />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Draft inter-store transfer" description="Creates a tenant-owned custody record. Approval checks stock; shipment consumes FIFO lots; receipt recreates lot provenance at the destination.">
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
        <ActionPanel title="Advance transfer custody" description="Apply approval, shipment, receipt, or cancellation as a controlled transition. Shipped stock can no longer be cancelled.">
          <FormGrid action={transitionInventoryTransferAction} submit="Advance transfer">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Open transfer" name="transferId" options={controls.inventoryTransferHistory ?? []} />
            <SelectField label="Employee assigned to both stores" name="employeeId" options={controls.employees ?? []} />
            <EnumField label="Next state" name="nextStatus" values={[{ value: "approved", label: "Approve" }, { value: "shipped", label: "Ship" }, { value: "received", label: "Receive" }, { value: "cancelled", label: "Cancel" }]} />
            <TextField label="Lifecycle notes" name="notes" />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Post exceptional adjustment" description="Use only for explained corrections, opening balances, waste, spoilage, or theft outside count/receiving/sale flows.">
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
      </div>
      <EvidenceTable rows={projection.rows} title="Stock positions" />
    </> : null}
  </PlatformPage>;
}

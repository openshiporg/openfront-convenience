import {
  configureVendorAction,
  configureVendorItemAction,
  createPurchaseOrderAction,
  receivePurchaseOrderAction,
  transitionPurchaseOrderAction,
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

const path = "/dashboard/platform/purchasing";

export async function PurchasingPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("purchasing", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return (
    <PlatformPage
      title="Purchasing"
      description="Vendors, purchase orders and deliveries."
      {...state}
    >
      {projection ? (
        <>
          <section
            aria-label="Search vendors"
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
                name="variantSearch"
                value={state.variantSearch ?? ""}
              />
              <input
                type="hidden"
                name="vendorItemSearch"
                value={state.vendorItemSearch ?? ""}
              />
              <input
                type="hidden"
                name="purchaseOrderLineSearch"
                value={state.purchaseOrderLineSearch ?? ""}
              />
              <input
                type="hidden"
                name="purchaseOrderSearch"
                value={state.purchaseOrderSearch ?? ""}
              />
              <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                Find an active vendor by name or vendor number
                <input
                  type="search"
                  name="vendorSearch"
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  defaultValue={state.vendorSearch ?? ""}
                  placeholder="At least 2 characters"
                  className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button
                type="submit"
                className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
              >
                Search vendors
              </button>
            </form>
            {state.vendorSearch && !controls.vendors?.length ? (
              <p className="text-sm text-muted-foreground" role="status">
                No active vendor match is available in this authorized business.
              </p>
            ) : null}
          </section>
          <section
            aria-label="Search product variants"
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
                name="vendorItemSearch"
                value={state.vendorItemSearch ?? ""}
              />
              <input
                type="hidden"
                name="vendorSearch"
                value={state.vendorSearch ?? ""}
              />
              <input
                type="hidden"
                name="purchaseOrderLineSearch"
                value={state.purchaseOrderLineSearch ?? ""}
              />
              <input
                type="hidden"
                name="purchaseOrderSearch"
                value={state.purchaseOrderSearch ?? ""}
              />
              <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                Find a product variant by name or SKU
                <input
                  type="search"
                  name="variantSearch"
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  defaultValue={state.variantSearch ?? ""}
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
          </section>
          <section
            aria-label="Search vendor items"
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
                name="variantSearch"
                value={state.variantSearch ?? ""}
              />
              <input
                type="hidden"
                name="vendorSearch"
                value={state.vendorSearch ?? ""}
              />
              <input
                type="hidden"
                name="purchaseOrderLineSearch"
                value={state.purchaseOrderLineSearch ?? ""}
              />
              <input
                type="hidden"
                name="purchaseOrderSearch"
                value={state.purchaseOrderSearch ?? ""}
              />
              <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                Find an existing vendor item by supplier SKU
                <input
                  type="search"
                  name="vendorItemSearch"
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  defaultValue={state.vendorItemSearch ?? ""}
                  placeholder="At least 2 characters"
                  className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button
                type="submit"
                className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
              >
                Search vendor items
              </button>
            </form>
          </section>
          <section
            aria-label="Search receiving lines"
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
                name="variantSearch"
                value={state.variantSearch ?? ""}
              />
              <input
                type="hidden"
                name="vendorItemSearch"
                value={state.vendorItemSearch ?? ""}
              />
              <input
                type="hidden"
                name="vendorSearch"
                value={state.vendorSearch ?? ""}
              />
              <input
                type="hidden"
                name="purchaseOrderSearch"
                value={state.purchaseOrderSearch ?? ""}
              />
              <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                Find an eligible receiving line by item description or supplier
                SKU
                <input
                  type="search"
                  name="purchaseOrderLineSearch"
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  defaultValue={state.purchaseOrderLineSearch ?? ""}
                  placeholder="At least 2 characters"
                  className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button
                type="submit"
                className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
              >
                Search receiving lines
              </button>
            </form>
          </section>
          <section
            aria-label="Search purchase orders"
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
                name="variantSearch"
                value={state.variantSearch ?? ""}
              />
              <input
                type="hidden"
                name="vendorItemSearch"
                value={state.vendorItemSearch ?? ""}
              />
              <input
                type="hidden"
                name="vendorSearch"
                value={state.vendorSearch ?? ""}
              />
              <input
                type="hidden"
                name="purchaseOrderLineSearch"
                value={state.purchaseOrderLineSearch ?? ""}
              />
              <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
                Exact purchase-order number for transition
                <input
                  type="search"
                  name="purchaseOrderSearch"
                  minLength={2}
                  maxLength={80}
                  autoComplete="off"
                  defaultValue={state.purchaseOrderSearch ?? ""}
                  placeholder="Enter the full PO number"
                  className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <button
                type="submit"
                className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
              >
                Find purchase order
              </button>
            </form>
            {state.purchaseOrderSearch &&
            !controls.purchaseOrderTransitionOptions?.length ? (
              <p className="text-sm text-muted-foreground" role="status">
                No exact purchase order match is available in this authorized
                store.
              </p>
            ) : null}
          </section>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <ActionPanel
              title="Configure vendor"
              description="Creates or updates one tenant-owned supplier by stable vendor number."
            >
              <FormGrid action={configureVendorAction} submit="Save vendor">
                <HiddenScope projection={projection} returnPath={path} />
                <TextField label="Vendor name" name="name" required />
                <TextField label="Vendor number" name="vendorNumber" required />
                <EnumField
                  label="Payment terms"
                  name="paymentTerms"
                  defaultValue="net_30"
                  values={[
                    { value: "cod", label: "COD" },
                    { value: "net_7", label: "Net 7" },
                    { value: "net_15", label: "Net 15" },
                    { value: "net_30", label: "Net 30" },
                    { value: "net_60", label: "Net 60" },
                    { value: "prepaid", label: "Prepaid" },
                  ]}
                />
                <TextField label="Contact" name="contactName" />
                <TextField label="Email" name="email" type="email" />
                <TextField label="Phone" name="phone" />
                <TextField
                  label="Lead time (days)"
                  name="leadTimeDays"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                />
                <TextField
                  label="Minimum order (cents)"
                  name="minimumOrderCents"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Map vendor item"
              description="Binds a supplier SKU, case pack, lead time, and reference cost to a tenant catalog variant."
            >
              <FormGrid
                action={configureVendorItemAction}
                submit="Save vendor item"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Vendor"
                  name="vendorId"
                  options={controls.vendors ?? []}
                />
                <SelectField
                  label="Product variant"
                  name="variantId"
                  options={controls.productVariants ?? []}
                />
                <TextField label="Vendor SKU" name="vendorSku" required />
                <TextField
                  label="Case-pack quantity"
                  name="casePackQuantity"
                  inputMode="decimal"
                  defaultValue="1"
                  required
                />
                <TextField
                  label="Units per case"
                  name="unitsPerCase"
                  type="number"
                  min="1"
                  step="1"
                  defaultValue="1"
                  required
                />
                <TextField
                  label="Unit cost (cents)"
                  name="unitCostCents"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Lead time (days)"
                  name="leadTimeDays"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Create purchase order"
              description="Creates a draft with one relational line. Additional lines remain available through controlled API batching."
            >
              <FormGrid
                action={createPurchaseOrderAction}
                submit="Create draft PO"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Vendor"
                  name="vendorId"
                  options={controls.vendors ?? []}
                />
                <SelectField
                  label="Buyer"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <SelectField
                  label="Product variant"
                  name="variantId"
                  options={controls.productVariants ?? []}
                />
                <SelectField
                  label="Vendor item (optional)"
                  name="vendorItemId"
                  options={controls.vendorItems ?? []}
                  required={false}
                />
                <TextField
                  label="Quantity ordered"
                  name="quantityOrdered"
                  inputMode="decimal"
                  required
                />
                <TextField
                  label="Unit cost cents when no vendor item"
                  name="unitCostCents"
                  type="number"
                  min="0"
                  step="1"
                />
                <TextField label="Expected at (ISO)" name="expectedAt" />
                <TextField label="Notes" name="notes" />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Submit, approve, or cancel"
              description="Recomputes totals and enforces draft → submitted → approved boundaries."
            >
              <FormGrid
                action={transitionPurchaseOrderAction}
                submit="Apply transition"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Purchase order"
                  name="purchaseOrderId"
                  options={controls.purchaseOrderTransitionOptions ?? []}
                />
                <SelectField
                  label="Purchasing employee"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <EnumField
                  label="Next state"
                  name="nextStatus"
                  values={[
                    { value: "submitted", label: "Submit" },
                    { value: "approved", label: "Approve" },
                    { value: "cancelled", label: "Cancel" },
                  ]}
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Receive purchase-order line"
              description="Posts accepted stock, rejection reason, lot/expiry, and receiving evidence atomically."
            >
              <FormGrid
                action={receivePurchaseOrderAction}
                submit="Post receiving"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Purchase order"
                  name="purchaseOrderId"
                  options={controls.purchaseOrders ?? []}
                />
                <SelectField
                  label="Purchase-order line"
                  name="purchaseOrderLineId"
                  options={controls.purchaseOrderLines ?? []}
                />
                <SelectField
                  label="Inventory location"
                  name="locationId"
                  options={controls.inventoryLocations ?? []}
                />
                <SelectField
                  label="Receiver"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <TextField
                  label="Vendor document / invoice"
                  name="vendorDocumentNumber"
                />
                <TextField
                  label="Accepted quantity"
                  name="quantityAccepted"
                  inputMode="decimal"
                  required
                />
                <TextField
                  label="Accepted unit cost (cents)"
                  name="acceptedUnitCostCents"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Rejected quantity"
                  name="quantityRejected"
                  inputMode="decimal"
                  defaultValue="0"
                />
                <EnumField
                  label="Rejection reason"
                  name="rejectionReason"
                  values={[
                    { value: "none", label: "None" },
                    { value: "damaged", label: "Damaged" },
                    { value: "expired", label: "Expired" },
                    { value: "wrong_item", label: "Wrong item" },
                    { value: "overage", label: "Overage" },
                    { value: "quality", label: "Quality" },
                  ]}
                />
                <TextField label="Lot number" name="lotNumber" />
                <TextField label="Expiry (ISO)" name="expiresAt" />
                <TextField label="Discrepancy notes" name="discrepancyNotes" />
                <TextField label="Line notes" name="lineNotes" />
              </FormGrid>
            </ActionPanel>
          </div>
          <EvidenceTable rows={projection.rows} title="Purchase-order queue" />
        </>
      ) : null}
    </PlatformPage>
  );
}

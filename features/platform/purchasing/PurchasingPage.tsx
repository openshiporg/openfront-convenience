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
  LookupForm,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { PanelGrid } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
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
      {...state}
    >
      {projection ? (
        <Workbench
          scope="purchasing"
          sections={[
            {
              id: "receive",
              label: "Receive",
              content: (
                <>
                  <LookupForm
                    action={path}
                    keep={{ businessId: projection.businessId, storeId: projection.storeId, variantSearch: state.variantSearch, vendorItemSearch: state.vendorItemSearch, vendorSearch: state.vendorSearch, purchaseOrderSearch: state.purchaseOrderSearch }}
                    name="purchaseOrderLineSearch"
                    label="Receiving line"
                    placeholder="Item or supplier SKU"
                    defaultValue={state.purchaseOrderLineSearch}
                    submit="Find"
                    empty={false}
                  />
                  <PanelGrid>
                    <ActionPanel title="Receive purchase-order line">
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
                  </PanelGrid>
                </>
              ),
            },
            {
              id: "orders",
              label: "Orders",
              count: projection.rows.length,
              content: (
                <>
                  <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    <LookupForm
                      action={path}
                      keep={{ businessId: projection.businessId, storeId: projection.storeId, variantSearch: state.variantSearch, vendorItemSearch: state.vendorItemSearch, vendorSearch: state.vendorSearch, purchaseOrderLineSearch: state.purchaseOrderLineSearch }}
                      name="purchaseOrderSearch"
                      label="PO number"
                      placeholder="Full PO number"
                      defaultValue={state.purchaseOrderSearch}
                      submit="Find"
                      empty={state.purchaseOrderSearch && !controls.purchaseOrderTransitionOptions?.length ? "No purchase order with that number" : false}
                    />
                    <LookupForm
                      action={path}
                      keep={{ businessId: projection.businessId, storeId: projection.storeId, variantSearch: state.variantSearch, vendorItemSearch: state.vendorItemSearch, purchaseOrderLineSearch: state.purchaseOrderLineSearch, purchaseOrderSearch: state.purchaseOrderSearch }}
                      name="vendorSearch"
                      label="Vendor"
                      placeholder="Name or vendor number"
                      defaultValue={state.vendorSearch}
                      submit="Find"
                      empty={state.vendorSearch && !controls.vendors?.length ? "No matching vendor" : false}
                    />
                    <LookupForm
                      action={path}
                      keep={{ businessId: projection.businessId, storeId: projection.storeId, variantSearch: state.variantSearch, vendorSearch: state.vendorSearch, purchaseOrderLineSearch: state.purchaseOrderLineSearch, purchaseOrderSearch: state.purchaseOrderSearch }}
                      name="vendorItemSearch"
                      label="Vendor item"
                      placeholder="Supplier SKU"
                      defaultValue={state.vendorItemSearch}
                      submit="Find"
                      empty={false}
                    />
                  </div>
                  <PanelGrid>
                    <ActionPanel title="Create purchase order">
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
                    <ActionPanel title="Submit, approve, or cancel">
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
                  </PanelGrid>
                  <EvidenceTable rows={projection.rows} title="Purchase-order queue" />
                </>
              ),
            },
            {
              id: "vendors",
              label: "Vendors",
              content: (
                <>
                  <div className="grid min-w-0 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    <LookupForm
                      action={path}
                      keep={{ businessId: projection.businessId, storeId: projection.storeId, variantSearch: state.variantSearch, vendorItemSearch: state.vendorItemSearch, purchaseOrderLineSearch: state.purchaseOrderLineSearch, purchaseOrderSearch: state.purchaseOrderSearch }}
                      name="vendorSearch"
                      label="Vendor"
                      placeholder="Name or vendor number"
                      defaultValue={state.vendorSearch}
                      submit="Find"
                      empty={state.vendorSearch && !controls.vendors?.length ? "No matching vendor" : false}
                    />
                    <LookupForm
                      action={path}
                      keep={{ businessId: projection.businessId, storeId: projection.storeId, vendorItemSearch: state.vendorItemSearch, vendorSearch: state.vendorSearch, purchaseOrderLineSearch: state.purchaseOrderLineSearch, purchaseOrderSearch: state.purchaseOrderSearch }}
                      name="variantSearch"
                      label="Item"
                      placeholder="Name or SKU"
                      defaultValue={state.variantSearch}
                      submit="Find"
                      empty={false}
                    />
                    <LookupForm
                      action={path}
                      keep={{ businessId: projection.businessId, storeId: projection.storeId, variantSearch: state.variantSearch, vendorSearch: state.vendorSearch, purchaseOrderLineSearch: state.purchaseOrderLineSearch, purchaseOrderSearch: state.purchaseOrderSearch }}
                      name="vendorItemSearch"
                      label="Vendor item"
                      placeholder="Supplier SKU"
                      defaultValue={state.vendorItemSearch}
                      submit="Find"
                      empty={false}
                    />
                  </div>
                  <PanelGrid>
                    <ActionPanel title="Configure vendor">
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
                    <ActionPanel title="Map vendor item">
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
                  </PanelGrid>
                </>
              ),
            },
          ]}
        />
      ) : null}
    </PlatformPage>
  );
}

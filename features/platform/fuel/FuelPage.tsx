import {
  approveFuelReconciliationAction,
  authorizeFuelPaymentAction,
  cancelFuelPaymentAuthorizationAction,
  completeFuelTransactionAction,
  configureFuelTopologyAction,
  generateFuelReconciliationAction,
  recordFuelDeliveryAction,
  recordTankReadingAction,
  setFuelPriceAction,
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
import { PanelGrid } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";

const path = "/dashboard/platform/fuel";

export async function FuelPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("fuel", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return (
    <PlatformPage
      title="Fuel"
      {...state}
    >
      {projection ? (
        <Workbench
          scope="fuel"
          sections={[
            {
              id: "pumps",
              label: "Pump sales",
              content: (
                <PanelGrid>
                  <ActionPanel title="Authorize dedicated fuel payment">
                    <FormGrid
                      action={authorizeFuelPaymentAction}
                      submit="Authorize fuel payment"
                    >
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField
                        label="Fuel site"
                        name="siteId"
                        options={controls.fuelSites ?? []}
                      />
                      <SelectField
                        label="Open register session"
                        name="registerSessionId"
                        options={controls.registerSessions ?? []}
                      />
                      <SelectField
                        label="Authorizing employee"
                        name="employeeId"
                        options={controls.employees ?? []}
                      />
                      <EnumField
                        label="Tender method"
                        name="method"
                        values={[
                          { value: "cash", label: "Cash" },
                          { value: "credit_card", label: "Credit card" },
                          { value: "debit_card", label: "Debit card" },
                          { value: "fleet_card", label: "Fleet card" },
                          { value: "mobile_wallet", label: "Mobile wallet" },
                        ]}
                      />
                      <EnumField
                        label="Authorized price tier"
                        name="priceTier"
                        values={[
                          { value: "cash", label: "Cash" },
                          { value: "credit", label: "Credit / debit / wallet" },
                          { value: "fleet", label: "Fleet" },
                        ]}
                      />
                      <TextField
                        label="Maximum authorized amount (cents)"
                        name="amountCents"
                        type="number"
                        min="1"
                        step="1"
                        required
                      />
                      <SelectField
                        label="Payment provider (non-cash)"
                        name="paymentProviderId"
                        options={controls.paymentProviders ?? []}
                        required={false}
                      />
                      <TextField
                        label="Provider payment reference (non-cash)"
                        name="providerPaymentId"
                      />
                      <TextField
                        label="Provider approval code (card)"
                        name="providerAuthority"
                        type="password"
                      />
                    </FormGrid>
                  </ActionPanel>
                  <ActionPanel title="Record controller-confirmed dispense">
                    <FormGrid
                      action={completeFuelTransactionAction}
                      submit="Record dispense"
                    >
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField
                        label="Fuel site"
                        name="siteId"
                        options={controls.fuelSites ?? []}
                      />
                      <SelectField
                        label="Pump"
                        name="pumpId"
                        options={controls.fuelPumps ?? []}
                      />
                      <SelectField
                        label="Nozzle"
                        name="nozzleId"
                        options={controls.fuelNozzles ?? []}
                      />
                      <SelectField
                        label="Grade"
                        name="gradeId"
                        options={controls.fuelGrades ?? []}
                      />
                      <EnumField
                        label="Price tier"
                        name="priceTier"
                        values={[
                          { value: "credit", label: "Credit" },
                          { value: "cash", label: "Cash" },
                          { value: "fleet", label: "Fleet" },
                          { value: "loyalty", label: "Loyalty" },
                        ]}
                      />
                      <TextField
                        label="Volume (gallons)"
                        name="volumeGallons"
                        inputMode="decimal"
                        required
                      />
                      <TextField
                        label="Controller transaction reference"
                        name="controllerTransactionId"
                        required
                      />
                      <SelectField
                        label="Dedicated completed sale"
                        name="saleId"
                        options={controls.fuelSales ?? []}
                      />
                      <SelectField
                        label="Unused authorization tender"
                        name="tenderId"
                        options={controls.fuelTenders ?? []}
                      />
                      <TextField
                        label="Provider release/refund reference (partial non-cash)"
                        name="providerRefundId"
                      />
                      <TextField
                        label="Provider release code (partial card)"
                        name="providerAuthority"
                        type="password"
                      />
                    </FormGrid>
                  </ActionPanel>
                  <ActionPanel title="Cancel unused fuel payment">
                    <FormGrid
                      action={cancelFuelPaymentAuthorizationAction}
                      submit="Cancel fuel payment"
                    >
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField
                        label="Unused dedicated sale"
                        name="saleId"
                        options={controls.fuelSales ?? []}
                      />
                      <SelectField
                        label="Cancelling employee"
                        name="employeeId"
                        options={controls.employees ?? []}
                      />
                      <TextField label="Cancellation reason" name="reason" required />
                      <TextField
                        label="Provider refund reference (non-cash)"
                        name="providerRefundId"
                      />
                      <TextField
                        label="Provider refund code (card)"
                        name="providerAuthority"
                        type="password"
                      />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
              ),
            },
            {
              id: "prices",
              label: "Prices",
              content: (
                <PanelGrid>
                  <ActionPanel title="Authorize price">
                    <FormGrid action={setFuelPriceAction} submit="Authorize price">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField
                        label="Fuel site"
                        name="siteId"
                        options={controls.fuelSites ?? []}
                      />
                      <SelectField
                        label="Grade"
                        name="gradeId"
                        options={controls.fuelGrades ?? []}
                      />
                      <SelectField
                        label="Authorizing employee"
                        name="employeeId"
                        options={controls.employees ?? []}
                      />
                      <EnumField
                        label="Price tier"
                        name="priceTier"
                        values={[
                          { value: "credit", label: "Credit" },
                          { value: "cash", label: "Cash" },
                          { value: "fleet", label: "Fleet" },
                          { value: "loyalty", label: "Loyalty" },
                        ]}
                      />
                      <TextField
                        label="Mills per gallon"
                        name="priceMillsPerGallon"
                        type="number"
                        min="1"
                        step="1"
                        required
                      />
                      <TextField
                        label="Effective at (ISO + offset)"
                        name="effectiveAt"
                        placeholder="2026-07-29T14:00:00-04:00"
                        required
                      />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
              ),
            },
            {
              id: "tanks",
              label: "Tanks and deliveries",
              content: (
                <PanelGrid>
                  <ActionPanel title="Record tank reading">
                    <FormGrid
                      action={recordTankReadingAction}
                      submit="Record reading"
                    >
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField
                        label="Fuel site"
                        name="siteId"
                        options={controls.fuelSites ?? []}
                      />
                      <SelectField
                        label="Tank"
                        name="tankId"
                        options={controls.fuelTanks ?? []}
                      />
                      <SelectField
                        label="Recorder"
                        name="employeeId"
                        options={controls.employees ?? []}
                      />
                      <EnumField
                        label="Source"
                        name="source"
                        values={[
                          { value: "manual_stick", label: "Manual stick" },
                          { value: "atg", label: "ATG" },
                          { value: "controller", label: "Controller" },
                          { value: "import", label: "Import" },
                        ]}
                      />
                      <TextField
                        label="Volume (gallons)"
                        name="volumeGallons"
                        inputMode="decimal"
                        required
                      />
                      <TextField
                        label="Water (gallons)"
                        name="waterVolumeGallons"
                        inputMode="decimal"
                        defaultValue="0"
                      />
                      <TextField
                        label="Measured at (ISO + offset)"
                        name="measuredAt"
                        placeholder="2026-07-29T14:00:00-04:00"
                        required
                      />
                      <TextField
                        label="External reference"
                        name="externalReference"
                      />
                    </FormGrid>
                  </ActionPanel>
                  <ActionPanel title="Receive fuel delivery">
                    <FormGrid
                      action={recordFuelDeliveryAction}
                      submit="Post delivery"
                    >
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField
                        label="Fuel site"
                        name="siteId"
                        options={controls.fuelSites ?? []}
                      />
                      <SelectField
                        label="Tank"
                        name="tankId"
                        options={controls.fuelTanks ?? []}
                      />
                      <SelectField
                        label="Vendor (optional)"
                        name="vendorId"
                        options={controls.vendors ?? []}
                        required={false}
                      />
                      <SelectField
                        label="Receiver"
                        name="employeeId"
                        options={controls.employees ?? []}
                      />
                      <TextField label="BOL number" name="billOfLadingNumber" />
                      <TextField
                        label="Gross gallons"
                        name="grossVolumeGallons"
                        inputMode="decimal"
                        required
                      />
                      <TextField
                        label="Net gallons"
                        name="netVolumeGallons"
                        inputMode="decimal"
                        required
                      />
                      <TextField
                        label="Before gallons"
                        name="beforeVolumeGallons"
                        inputMode="decimal"
                      />
                      <TextField
                        label="After gallons"
                        name="afterVolumeGallons"
                        inputMode="decimal"
                      />
                      <TextField
                        label="Unit cost (mills/gal)"
                        name="unitCostMillsPerGallon"
                        type="number"
                        min="0"
                        step="1"
                      />
                      <TextField label="Notes" name="notes" />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
              ),
            },
            {
              id: "wet-stock",
              label: "Wet stock",
              count: projection.rows.length,
              content: (
                <>
                  <PanelGrid>
                    <ActionPanel title="Generate wet-stock reconciliation">
                      <FormGrid
                        action={generateFuelReconciliationAction}
                        submit="Generate reconciliation"
                      >
                        <HiddenScope projection={projection} returnPath={path} />
                        <SelectField
                          label="Fuel site"
                          name="siteId"
                          options={controls.fuelSites ?? []}
                        />
                        <SelectField
                          label="Tank"
                          name="tankId"
                          options={controls.fuelTanks ?? []}
                        />
                        <SelectField
                          label="Opening reading"
                          name="openingReadingId"
                          options={controls.fuelReadings ?? []}
                        />
                        <SelectField
                          label="Closing reading"
                          name="closingReadingId"
                          options={controls.fuelReadings ?? []}
                        />
                        <SelectField
                          label="Generator"
                          name="employeeId"
                          options={controls.employees ?? []}
                        />
                        <TextField
                          label="Period start (exact ISO)"
                          name="periodStartedAt"
                          required
                        />
                        <TextField
                          label="Period end (exact ISO)"
                          name="periodEndedAt"
                          required
                        />
                        <TextField
                          label="Tolerance (gallons)"
                          name="toleranceGallons"
                          inputMode="decimal"
                          defaultValue="0.5000"
                          required
                        />
                        <TextField label="Notes" name="notes" />
                      </FormGrid>
                    </ActionPanel>
                    <ActionPanel title="Approve or lock reconciliation">
                      <FormGrid
                        action={approveFuelReconciliationAction}
                        submit="Apply review"
                      >
                        <HiddenScope projection={projection} returnPath={path} />
                        <SelectField
                          label="Reconciliation"
                          name="reconciliationId"
                          options={controls.fuelReconciliations ?? []}
                        />
                        <SelectField
                          label="Approver"
                          name="employeeId"
                          options={controls.employees ?? []}
                        />
                        <EnumField
                          label="Outcome"
                          name="lock"
                          values={[
                            { value: "false", label: "Approve" },
                            { value: "true", label: "Approve and lock" },
                          ]}
                        />
                        <TextField label="Review notes" name="notes" />
                      </FormGrid>
                    </ActionPanel>
                  </PanelGrid>
                  <EvidenceTable
                    rows={projection.rows}
                    title="Wet-stock reconciliations"
                  />
                </>
              ),
            },
            {
              id: "setup",
              label: "Setup",
              content: (
                <PanelGrid>
                  <ActionPanel title="Configure fuel topology">
                    <FormGrid
                      action={configureFuelTopologyAction}
                      submit="Save topology"
                    >
                      <HiddenScope projection={projection} returnPath={path} />
                      <TextField label="Site name" name="siteName" required />
                      <TextField label="Site code" name="siteCode" required />
                      <TextField label="Grade name" name="gradeName" required />
                      <TextField label="Grade code" name="gradeCode" required />
                      <TextField
                        label="Octane rating (optional)"
                        name="octaneRating"
                        type="number"
                        min="0"
                        max="120"
                        step="1"
                      />
                      <TextField label="Tank number" name="tankNumber" required />
                      <TextField
                        label="Tank capacity (gallons)"
                        name="tankCapacityGallons"
                        inputMode="decimal"
                        required
                      />
                      <TextField
                        label="Initial volume (gallons)"
                        name="initialVolumeGallons"
                        inputMode="decimal"
                        defaultValue="0"
                      />
                      <TextField label="Pump number" name="pumpNumber" required />
                      <TextField label="Nozzle number" name="nozzleNumber" required />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
              ),
            },
          ]}
        />
      ) : null}
    </PlatformPage>
  );
}

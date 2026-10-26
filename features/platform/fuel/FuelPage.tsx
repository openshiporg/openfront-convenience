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
  EnumField,
  FormGrid,
  HiddenScope,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import {
  CountBoxes,
  DataTable,
  SectionTitle,
  StatusText,
  Td,
  Th,
  Tr,
  formatMeasure,
  type DotTone,
} from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { zonedNowInput } from "../lib/form-values";
import { FuelPriceBoard } from "./FuelPriceBoard";
import { ActionBar, ActionDisclosure, PrereqNotice, QueueClear, ToneText, When, money, parseMoney } from "./ops-kit";
import { getPlatformProjection, type PlatformOption, type PlatformSearch } from "../lib/projection";

const path = "/dashboard/platform/fuel";

/** Pump, nozzle and tank states read as words with the tone a cashier expects. */
const EQUIPMENT_TONES: Record<string, DotTone> = {
  available: "ok",
  active: "ok",
  "in use": "info",
  lifted: "info",
  dispensing: "info",
  delivery: "info",
  low: "warn",
  maintenance: "warn",
  offline: "danger",
  "emergency stop": "danger",
  "out of service": "danger",
};
const equipmentTone = (state: string | null | undefined): DotTone =>
  EQUIPMENT_TONES[(state ?? "").toLowerCase()] ?? "muted";
const severity = (state: string | null | undefined) =>
  ({ danger: 0, warn: 1, info: 2, ok: 3, muted: 4 })[equipmentTone(state)];

function EquipmentTable({ title, rows, unit }: { title: string; rows: PlatformOption[]; unit: string }) {
  const sorted = [...rows].sort((left, right) => severity(left.detail) - severity(right.detail));
  const down = rows.filter((row) => ["danger", "warn"].includes(equipmentTone(row.detail))).length;
  return (
    <section className="min-w-0" aria-label={title}>
      <SectionTitle meta={down ? `${down} need attention` : rows.length || undefined}>{title}</SectionTitle>
      {rows.length ? (
        <DataTable>
          <thead>
            <tr>
              <Th>{unit}</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <Tr key={row.id}>
                <Td className="font-mono tabular-nums">{row.label}</Td>
                <Td>
                  <ToneText tone={equipmentTone(row.detail)}>{row.detail || "Unknown"}</ToneText>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">No {unit.toLowerCase()}s recorded</p>
      )}
    </section>
  );
}

export async function FuelPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("fuel", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const currency = projection?.currencyCode ?? null;
  const sites = controls.fuelSites ?? [];
  // Paid fuel authorizations whose tender has no controller-confirmed dispense yet,
  // oldest first (the projection lists them newest first).
  const unconfirmed = [...(controls.fuelSales ?? [])].reverse();
  const paidCents = unconfirmed.reduce((sum, sale) => sum + (parseMoney(sale.detail) ?? 0), 0);
  const nozzles = controls.fuelNozzles ?? [];
  const nozzlesDown = nozzles.filter((row) => ["danger", "warn"].includes(equipmentTone(row.detail))).length;
  const reconciliations = projection?.rows ?? [];

  const topologyForm = projection ? (
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
  ) : null;

  return (
    <PlatformPage title="Fuel" showMetrics={false} {...state}>
      {projection && !sites.length ? (
        <CountBoxes
          items={[
            { label: "Paid", value: "–" },
            { label: "Dispensed, confirmed", value: "–" },
            { label: "Paid, not dispensed", value: "–" },
          ]}
        />
      ) : null}
      {projection && !sites.length ? (
        <PrereqNotice title="No fuel site set up">
          <ActionDisclosure label="Set up fuel site" primary id="fuel-setup">
            {topologyForm}
          </ActionDisclosure>
        </PrereqNotice>
      ) : null}
      {projection && sites.length ? (
        <>
          <div className="grid min-w-0 items-start gap-4 xl:grid-cols-3">
            <EquipmentTable title="Pumps" unit="Pump" rows={controls.fuelPumps ?? []} />
            <EquipmentTable title="Tanks" unit="Tank" rows={controls.fuelTanks ?? []} />
            <FuelPriceBoard prices={controls.fuelPriceBoard ?? []} grades={controls.fuelGrades ?? []} timeZone={projection.timezone} />
          </div>
          {nozzles.length ? (
            <p className="text-[12px] text-muted-foreground">
              <span className="font-mono tabular-nums">{nozzles.length}</span> nozzles
              {nozzlesDown ? (
                <>
                  {" · "}
                  <ToneText tone="warn">
                    <span className="font-mono tabular-nums">{nozzlesDown}</span> offline or in maintenance
                  </ToneText>
                </>
              ) : null}
            </p>
          ) : null}

          <section className="min-w-0 space-y-3" aria-label="Unconfirmed dispenses">
            <SectionTitle meta={unconfirmed.length || undefined}>Unconfirmed dispenses</SectionTitle>
            <CountBoxes
              items={
                unconfirmed.length
                  ? [
                      { label: "Paid", value: money(paidCents, currency), note: `${unconfirmed.length} authorizations` },
                      { label: "Dispensed, confirmed", value: money(0, currency), note: "No controller record yet" },
                      { label: "Paid, not dispensed", value: money(-paidCents, currency), variance: -paidCents },
                    ]
                  : [
                      { label: "Paid", value: "–" },
                      { label: "Dispensed, confirmed", value: "–" },
                      { label: "Paid, not dispensed", value: "–" },
                    ]
              }
            />
            {unconfirmed.length ? (
              <DataTable>
                <thead>
                  <tr>
                    <Th>Receipt</Th>
                    <Th align="right">Paid</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {unconfirmed.map((sale) => (
                    <Tr key={sale.id}>
                      <Td className="font-mono tabular-nums">{sale.label}</Td>
                      <Td align="right">{sale.detail}</Td>
                      <Td>
                        <ToneText tone="warn">Paid, awaiting dispense</ToneText>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <QueueClear>Every paid fuel authorization has a confirmed dispense</QueueClear>
            )}
            <ActionBar label="Pump sale actions">
              <ActionDisclosure label="Record dispense" primary>
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
              </ActionDisclosure>
              <ActionDisclosure label="Authorize fuel payment">
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
              </ActionDisclosure>
              <ActionDisclosure label="Cancel unused payment">
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
              </ActionDisclosure>
            </ActionBar>
          </section>

          <Workbench
            scope="fuel"
            sections={[
              {
                id: "wet-stock",
                label: "Wet stock",
                count: reconciliations.length,
                content: (
                  <>
                    <ActionBar label="Wet-stock actions">
                      <ActionDisclosure label="Generate reconciliation" primary>
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
                      </ActionDisclosure>
                      <ActionDisclosure label="Approve or lock">
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
                      </ActionDisclosure>
                    </ActionBar>
                    <section className="min-w-0" aria-label="Wet-stock reconciliations">
                      <SectionTitle meta={reconciliations.length || undefined}>Wet-stock reconciliations</SectionTitle>
                      {reconciliations.length ? (
                        <DataTable>
                          <thead>
                            <tr>
                              <Th>Reconciliation</Th>
                              <Th>Status</Th>
                              <Th align="right">Variance</Th>
                              <Th priority={2}>Period end</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {reconciliations.map((row) => {
                              const gallons = Number.parseFloat(row.metric);
                              return (
                                <Tr key={row.id}>
                                  <Td className="font-mono tabular-nums">{row.title}</Td>
                                  <Td>
                                    <StatusText status={row.status} />
                                  </Td>
                                  <Td
                                    align="right"
                                    className={gallons < 0 ? "text-[oklch(0.52_0.19_27)] dark:text-red-400" : undefined}
                                  >
                                    {formatMeasure(row.metric).replace(" variance", "")}
                                  </Td>
                                  <Td priority={2}>
                                    <When value={row.occurredAt} timeZone={projection.timezone} />
                                  </Td>
                                </Tr>
                              );
                            })}
                          </tbody>
                        </DataTable>
                      ) : (
                        <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">No reconciliations yet</p>
                      )}
                    </section>
                  </>
                ),
              },
              {
                id: "prices",
                label: "Prices",
                content: (
                  <ActionBar label="Price actions">
                    <ActionDisclosure label="Authorize price" primary>
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
                          label="Effective at"
                          name="effectiveAt"
                          defaultValue={zonedNowInput(projection.timezone)}
                          required
                        />
                      </FormGrid>
                    </ActionDisclosure>
                  </ActionBar>
                ),
              },
              {
                id: "tanks",
                label: "Tanks and deliveries",
                content: (
                  <ActionBar label="Tank actions">
                    <ActionDisclosure label="Record tank reading" primary>
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
                          label="Measured at"
                          name="measuredAt"
                          defaultValue={zonedNowInput(projection.timezone)}
                          required
                        />
                        <TextField
                          label="External reference"
                          name="externalReference"
                        />
                      </FormGrid>
                    </ActionDisclosure>
                    <ActionDisclosure label="Receive fuel delivery">
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
                    </ActionDisclosure>
                  </ActionBar>
                ),
              },
              {
                id: "setup",
                label: "Setup",
                content: (
                  <ActionBar label="Setup actions">
                    <ActionDisclosure label="Configure fuel topology">{topologyForm}</ActionDisclosure>
                  </ActionBar>
                ),
              },
            ]}
          />
        </>
      ) : null}
    </PlatformPage>
  );
}

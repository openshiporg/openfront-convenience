import {
  approveMoneyServiceSettlementAction,
  configureMoneyServiceProviderAction,
  generateMoneyServiceSettlementAction,
  recordMoneyServiceTransactionAction,
  voidMoneyServiceTransactionAction,
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

const path = "/dashboard/platform/money-services";
const serviceValues = [
  { value: "money_order", label: "Money order" },
  { value: "money_transfer", label: "Money transfer" },
  { value: "bill_payment", label: "Bill payment" },
  { value: "check_cashing", label: "Check cashing" },
  { value: "stored_value", label: "Stored value" },
  { value: "atm_other", label: "ATM / other" },
];

export async function MoneyServicesPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("money_services", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return (
    <PlatformPage
      title="Money Services"
      description="Money orders, bill payments and transfers confirmed by your provider."
      {...state}
    >
      {projection ? (
        <>
          <p role="status" className="text-sm text-muted-foreground">Provider authorization required</p>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <ActionPanel
              title="Configure external provider"
              description="Stores non-secret adapter configuration and optional opaque secret-manager reference."
            >
              <FormGrid
                action={configureMoneyServiceProviderAction}
                submit="Save provider"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <TextField label="Provider name" name="name" required />
                <TextField label="Code" name="code" required />
                <EnumField
                  label="Service"
                  name="serviceType"
                  values={serviceValues}
                />
                <TextField
                  label="Adapter key"
                  name="adapterKey"
                  defaultValue="manual_external"
                  required
                />
                <TextField
                  label="External agent reference"
                  name="externalAgentReference"
                />
                <TextField label="Jurisdiction label" name="jurisdictionCode" />
                <TextField
                  label="Credential reference"
                  name="credentialReference"
                  placeholder="env://MONEY_PROVIDER_KEY"
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Record externally confirmed transaction"
              description="Requires a provider reference. Cash activity also requires an open register session."
            >
              <FormGrid
                action={recordMoneyServiceTransactionAction}
                submit="Record confirmation"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Provider"
                  name="providerId"
                  options={controls.moneyServiceProviders ?? []}
                />
                <EnumField
                  label="Service"
                  name="serviceType"
                  values={serviceValues}
                />
                <SelectField
                  label="Employee"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <SelectField
                  label="Open register for cash"
                  name="registerSessionId"
                  options={controls.registerSessions ?? []}
                  required={false}
                />
                <TextField
                  label="External transaction reference"
                  name="externalTransactionReference"
                  required
                />
                <EnumField
                  label="Cash direction"
                  name="cashDirection"
                  values={[
                    { value: "in", label: "Cash in" },
                    { value: "out", label: "Cash out" },
                    { value: "none", label: "No cash" },
                  ]}
                />
                <TextField
                  label="Face amount (cents)"
                  name="faceAmountCents"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Fee (cents)"
                  name="feeCents"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                />
                <TextField
                  label="Cash amount (cents)"
                  name="cashAmountCents"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                />
                <TextField
                  label="Provider settlement (signed cents)"
                  name="providerSettlementCents"
                  type="number"
                  step="1"
                  required
                />
                <TextField
                  label="Occurred at (ISO)"
                  name="occurredAt"
                  required
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Void externally"
              description="Requires the provider's void confirmation and reverses recorded cash while the original till remains open."
            >
              <FormGrid
                action={voidMoneyServiceTransactionAction}
                submit="Record void"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Confirmed transaction"
                  name="transactionId"
                  options={controls.moneyServiceTransactions ?? []}
                />
                <SelectField
                  label="Employee"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <TextField
                  label="External void reference"
                  name="externalVoidReference"
                  required
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Generate provider settlement"
              description="Aggregates externally confirmed transactions and compares the operational expectation with the provider report."
            >
              <FormGrid
                action={generateMoneyServiceSettlementAction}
                submit="Generate settlement"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Provider"
                  name="providerId"
                  options={controls.moneyServiceProviders ?? []}
                />
                <TextField
                  label="Trading date"
                  name="tradingDate"
                  type="date"
                  required
                />
                <TextField
                  label="Period start (ISO)"
                  name="periodStartedAt"
                  required
                />
                <TextField
                  label="Period end (ISO)"
                  name="periodEndedAt"
                  required
                />
                <TextField
                  label="Reported settlement (signed cents)"
                  name="reportedSettlementCents"
                  type="number"
                  step="1"
                  required
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Approve settlement"
              description="Generate StoreDay evidence with the exact trading date and period first; variance also requires an explicit operator disposition note."
            >
              <FormGrid
                action={approveMoneyServiceSettlementAction}
                submit="Approve settlement"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Settlement"
                  name="settlementId"
                  options={controls.moneyServiceSettlements ?? []}
                />
                <SelectField
                  label="Approver"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <TextField label="Disposition notes" name="notes" />
              </FormGrid>
            </ActionPanel>
          </div>
          <EvidenceTable
            rows={projection.rows}
            title="Externally confirmed transactions"
          />
        </>
      ) : null}
    </PlatformPage>
  );
}

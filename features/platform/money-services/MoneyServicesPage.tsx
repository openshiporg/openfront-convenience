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
import { PanelGrid } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
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
      title="Money Services" state={{ tone: "warn", label: "Provider authorization required" }}
      {...state}
    >
      {projection ? (
        <Workbench
          scope="money-services"
          sections={[
            {
              id: "transactions",
              label: "Transactions",
              count: projection.rows.length,
              content: (
                <>
                  <PanelGrid>
                    <ActionPanel title="Record externally confirmed transaction">
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
                    <ActionPanel title="Void externally">
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
                  </PanelGrid>
                  <EvidenceTable
                    rows={projection.rows}
                    title="Externally confirmed transactions"
                  />
                </>
              ),
            },
            {
              id: "settlement",
              label: "Settlement",
              content: (
                <PanelGrid>
                  <ActionPanel title="Generate provider settlement">
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
                  <ActionPanel title="Approve settlement">
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
                </PanelGrid>
              ),
            },
            {
              id: "provider",
              label: "Provider",
              content: (
                <PanelGrid>
                  <ActionPanel title="Configure external provider">
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
                </PanelGrid>
              ),
            },
          ]}
        />
      ) : null}
    </PlatformPage>
  );
}

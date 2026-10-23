import {
  approvePaymentReconciliationAction,
  configurePaymentProviderAction,
  generatePaymentReconciliationAction,
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

const path = "/dashboard/platform/payments";

export async function PaymentsPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("payments", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return <PlatformPage title="Payments" {...state}>
    {projection ? (
      <Workbench
        scope="payments"
        sections={[
          {
            id: "settlements",
            label: "Settlements",
            count: projection.rows.length,
            content: (
              <>
                <PanelGrid>
                  <ActionPanel title="Reconcile provider settlement">
                    <FormGrid action={generatePaymentReconciliationAction} submit="Generate reconciliation">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Payment provider" name="paymentProviderId" options={controls.paymentProviders ?? []} />
                      <TextField label="Period start (ISO + offset)" name="periodStartedAt" required />
                      <TextField label="Period end (ISO + offset)" name="periodEndedAt" required />
                      <TextField label="Reported fees (cents)" name="reportedFeeCents" type="number" min="0" step="1" defaultValue="0" required />
                      <TextField label="Reported settlement (signed cents)" name="reportedSettlementCents" type="number" step="1" required />
                      <TextField label="Review notes" name="notes" />
                    </FormGrid>
                  </ActionPanel>
                  <ActionPanel title="Approve reconciliation">
                    <FormGrid action={approvePaymentReconciliationAction} submit="Approve reconciliation">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Reconciliation" name="reconciliationId" options={controls.paymentReconciliations ?? []} />
                      <SelectField label="Approver" name="employeeId" options={controls.employees ?? []} />
                      <TextField label="Disposition notes" name="notes" />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
                <EvidenceTable rows={projection.rows} title="Settlements and provider events" />
              </>
            ),
          },
          {
            id: "providers",
            label: "Providers",
            content: (
              <PanelGrid>
                <ActionPanel title="Configure payment provider">
                  <FormGrid action={configurePaymentProviderAction} submit="Save provider">
                    <HiddenScope projection={projection} returnPath={path} />
                    <TextField label="Provider name" name="name" required />
                    <TextField label="Code" name="code" required />
                    <EnumField label="Adapter" name="adapterKey" values={[{ value: "manual_external", label: "Manual external terminal" }, { value: "hmac_json_v1", label: "Signed HMAC JSON v1" }]} />
                    <TextField label="Credential reference" name="credentialReference" placeholder="env://PAYMENT_WEBHOOK_KEY" />
                    <EnumField label="Initial state" name="activate" values={[{ value: "true", label: "Active" }, { value: "false", label: "Configured only" }]} />
                  </FormGrid>
                </ActionPanel>
              </PanelGrid>
            ),
          },
        ]}
      />
    ) : null}
  </PlatformPage>;
}

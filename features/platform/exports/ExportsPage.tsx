import {
  configureExportDestinationAction,
  generateAccountingExportAction,
  transitionExportBatchAction,
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
import { ExportDownloadPanel } from "./ExportDownloadPanel";

const path = "/dashboard/platform/exports";

export async function ExportsPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("exports", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return (
    <PlatformPage
      title="Exports"
      description="Export closed store days to accounting."
      {...state}
    >
      {projection ? (
        <>
          <div className="grid min-w-0 gap-4 xl:grid-cols-2">
            <ActionPanel
              title="Configure destination"
              description="Stores only non-secret adapter metadata and an optional opaque credential reference."
            >
              <FormGrid
                action={configureExportDestinationAction}
                submit="Save destination"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <TextField label="Destination name" name="name" required />
                <TextField label="Code" name="code" required />
                <EnumField
                  label="Type"
                  name="type"
                  values={[
                    { value: "accounting", label: "Accounting" },
                    { value: "provider", label: "Provider" },
                    { value: "data_warehouse", label: "Data warehouse" },
                  ]}
                />
                <TextField
                  label="Adapter key"
                  name="adapterKey"
                  defaultValue="manual_export"
                  required
                />
                <TextField
                  label="Credential reference"
                  name="credentialReference"
                  placeholder="env://ACCOUNTING_EXPORT_KEY"
                />
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Generate daily accounting batch"
              description="Requires reconciled/locked and tender-balanced store days; debit and credit totals must match."
            >
              <FormGrid
                action={generateAccountingExportAction}
                submit="Generate balanced batch"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Accounting destination"
                  name="destinationId"
                  options={controls.exportDestinations ?? []}
                />
                <SelectField
                  label="Generator"
                  name="employeeId"
                  options={controls.employees ?? []}
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
              </FormGrid>
            </ActionPanel>
            <ActionPanel
              title="Download accounting artifact"
              description="Recomputes the stored SHA-256 before returning the bounded CSV through the authenticated GraphQL resolver."
            >
              <ExportDownloadPanel
                businessId={projection.businessId!}
                batches={controls.exportBatches ?? []}
              />
            </ActionPanel>
            <ActionPanel
              title="Advance delivery"
              description="Ready → delivering → delivered. Failures can return to ready through controlled retry."
            >
              <FormGrid
                action={transitionExportBatchAction}
                submit="Apply transition"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Export batch"
                  name="batchId"
                  options={controls.exportBatches ?? []}
                />
                <EnumField
                  label="Next state"
                  name="nextStatus"
                  values={[
                    { value: "delivering", label: "Delivering" },
                    { value: "delivered", label: "Delivered" },
                    { value: "failed", label: "Failed" },
                    { value: "ready", label: "Retry / ready" },
                    { value: "cancelled", label: "Cancel" },
                  ]}
                />
                <TextField
                  label="External receipt reference"
                  name="externalReference"
                />
                <TextField label="Failure message" name="failureMessage" />
              </FormGrid>
            </ActionPanel>
          </div>
          <EvidenceTable rows={projection.rows} title="Export batches" />
        </>
      ) : null}
    </PlatformPage>
  );
}

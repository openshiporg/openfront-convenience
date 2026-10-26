import {
  configureExportDestinationAction,
  generateAccountingExportAction,
  transitionExportBatchAction,
} from "../actions";
import {
  EmptyState,
  EnumField,
  FormGrid,
  HiddenScope,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { DataTable, SectionTitle, StatusText, Td, Th, Tr, type DotTone } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { getPlatformProjection, type PlatformProjection, type PlatformSearch } from "../lib/projection";
import { ActionBar, Disclosure, NoteLine, ageText } from "../reconciliation/ledger-ui";
import { QueueRow } from "../reconciliation/QueueRow";
import { ExportDownloadPanel } from "./ExportDownloadPanel";

const path = "/dashboard/platform/exports";

const QUEUE_ORDER: Record<string, number> = { failed: 0, ready: 1, delivering: 2 };

function when(value: string | null, timeZone: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short", timeZone: timeZone || "UTC" });
}

export async function ExportsPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("exports", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const destinations = controls.exportDestinations ?? [];
  const rows = projection?.rows ?? [];
  const queue = rows
    .filter((row) => row.status in QUEUE_ORDER)
    .sort((left, right) => QUEUE_ORDER[left.status] - QUEUE_ORDER[right.status] || String(left.occurredAt).localeCompare(String(right.occurredAt)));
  const failed = queue.filter((row) => row.status === "failed").length;
  const pageState: { tone: DotTone; label: string } | null = projection
    ? !destinations.length
      ? { tone: "warn", label: "No accounting destination" }
      : failed
        ? { tone: "danger", label: `${failed} failed` }
        : queue.length
          ? { tone: "info", label: `${queue.length} waiting to deliver` }
          : { tone: "ok", label: "All delivered" }
    : null;
  const now = Date.now();

  return (
    <PlatformPage title="Exports" {...state} showMetrics={false} state={pageState}>
      {projection ? (
        <>
          <ActionBar>
            {destinations.length ? (
              <Disclosure label="Generate batch" title="Generate daily accounting batch" primary>
                <GenerateForm projection={projection} />
              </Disclosure>
            ) : (
              <Disclosure label="Add destination" title="Configure destination" primary>
                <DestinationForm projection={projection} />
              </Disclosure>
            )}
          </ActionBar>
          {!destinations.length ? (
            <NoteLine>Add an accounting destination before generating a batch.</NoteLine>
          ) : null}

          <section className="min-w-0" aria-labelledby="export-queue">
            <SectionTitle id="export-queue" meta={queue.length || undefined}>Needs you</SectionTitle>
            {queue.length ? (
              <DataTable aria-label="Batches to deliver">
                <thead>
                  <tr>
                    <Th>Batch</Th>
                    <Th>Status</Th>
                    <Th priority={2}>Contents</Th>
                    <Th align="right" priority={2}>Age</Th>
                    <Th align="right"><span className="sr-only">Action</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => (
                    <QueueRow
                      key={row.id}
                      colSpan={5}
                      tone={row.status === "failed" ? "danger" : null}
                      actionLabel={row.status === "failed" ? "Retry" : "Deliver"}
                      cells={
                        <>
                          <Td className="font-mono tabular-nums [overflow-wrap:anywhere]">{row.title}</Td>
                          <Td><StatusText status={row.status} /></Td>
                          <Td priority={2} className="text-muted-foreground">{row.detail}</Td>
                          <Td align="right" priority={2}>{ageText(row.occurredAt, now)}</Td>
                        </>
                      }
                    >
                      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                        <div className="min-w-0">
                          <h3 className="mb-2 text-[13px] font-medium text-foreground">Download</h3>
                          <ExportDownloadPanel
                            businessId={projection.businessId!}
                            batches={(controls.exportBatches ?? []).filter((batch) => batch.id === row.id)}
                          />
                        </div>
                        <div className="min-w-0">
                          <h3 className="mb-2 text-[13px] font-medium text-foreground">Advance delivery</h3>
                          <TransitionForm projection={projection} batchId={row.id} />
                        </div>
                      </div>
                    </QueueRow>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <NoteLine tone="ok">No batch waiting to be delivered.</NoteLine>
            )}
          </section>

          <Workbench
            scope="exports"
            sections={[
              {
                id: "batches",
                label: "Batches",
                count: rows.length,
                content: rows.length ? (
                  <DataTable aria-label="Export batches">
                    <thead>
                      <tr>
                        <Th>Batch</Th>
                        <Th>Status</Th>
                        <Th priority={2}>Contents</Th>
                        <Th align="right" priority={3}>Generated</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <Tr key={row.id}>
                          <Td className="font-mono tabular-nums [overflow-wrap:anywhere]">{row.title}</Td>
                          <Td><StatusText status={row.status} /></Td>
                          <Td priority={2} className="text-muted-foreground">{row.detail}</Td>
                          <Td align="right" priority={3}>{when(row.occurredAt, projection.timezone)}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </DataTable>
                ) : (
                  <EmptyState title="No export batches yet" />
                ),
              },
              {
                id: "destination",
                label: "Destinations",
                count: destinations.length,
                content: (
                  <>
                    {destinations.length ? (
                      <DataTable aria-label="Accounting destinations">
                        <thead>
                          <tr>
                            <Th>Destination</Th>
                            <Th>Status</Th>
                            <Th priority={2}>Type and code</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {destinations.map((destination) => (
                            <Tr key={destination.id}>
                              <Td className="font-medium">{destination.label}</Td>
                              <Td><StatusText status="active" /></Td>
                              <Td priority={2} className="font-mono text-[12px] text-muted-foreground">{destination.detail}</Td>
                            </Tr>
                          ))}
                        </tbody>
                      </DataTable>
                    ) : (
                      <EmptyState title="No active destination" />
                    )}
                    {destinations.length ? (
                      <ActionBar>
                        <Disclosure label="Add or update destination" title="Configure destination">
                          <DestinationForm projection={projection} />
                        </Disclosure>
                      </ActionBar>
                    ) : null}
                  </>
                ),
              },
            ]}
          />
        </>
      ) : null}
    </PlatformPage>
  );
}

function GenerateForm({ projection }: { projection: PlatformProjection }) {
  return (
    <FormGrid action={generateAccountingExportAction} submit="Generate balanced batch">
      <HiddenScope projection={projection} returnPath={path} />
      <SelectField label="Accounting destination" name="destinationId" options={projection.controls.exportDestinations ?? []} />
      <SelectField label="Generator" name="employeeId" options={projection.controls.employees ?? []} />
      <TextField label="Period start (ISO)" name="periodStartedAt" required />
      <TextField label="Period end (ISO)" name="periodEndedAt" required />
    </FormGrid>
  );
}

function TransitionForm({ projection, batchId }: { projection: PlatformProjection; batchId: string }) {
  return (
    <FormGrid action={transitionExportBatchAction} submit="Apply transition">
      <HiddenScope projection={projection} returnPath={path} />
      <input type="hidden" name="batchId" value={batchId} />
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
      <TextField label="External receipt reference" name="externalReference" />
      <TextField label="Failure message" name="failureMessage" />
    </FormGrid>
  );
}

function DestinationForm({ projection }: { projection: PlatformProjection }) {
  return (
    <FormGrid action={configureExportDestinationAction} submit="Save destination">
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
      <TextField label="Adapter key" name="adapterKey" defaultValue="manual_export" required />
      <TextField label="Credential reference" name="credentialReference" placeholder="env://ACCOUNTING_EXPORT_KEY" />
    </FormGrid>
  );
}

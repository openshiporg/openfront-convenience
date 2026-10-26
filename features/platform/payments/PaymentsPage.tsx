import {
  approvePaymentReconciliationAction,
  configurePaymentProviderAction,
  generatePaymentReconciliationAction,
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
import { formatMoney } from "../lib/scope";
import { ActionBar, Disclosure, NoteLine, StateText, centsOf, signedMoney, varianceState } from "../reconciliation/ledger-ui";
import { QueueRow } from "../reconciliation/QueueRow";

const path = "/dashboard/platform/payments";

const RECONCILIATION = "Provider settlement reconciliation";

function when(value: string | null, timeZone: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short", timeZone: timeZone || "UTC" });
}

export async function PaymentsPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("payments", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const providers = controls.paymentProviders ?? [];
  const rows = projection?.rows ?? [];
  const money = (cents: number) => formatMoney(cents, projection?.currencyCode);
  const pending = new Set((controls.paymentReconciliations ?? []).map((entry) => entry.id));
  // Settlements awaiting approval and failed webhook events; short variances first.
  const queue = rows
    .filter((row) => pending.has(row.id) || (row.detail !== RECONCILIATION && row.status === "failed"))
    .sort((left, right) => (centsOf(left.metric) ?? 0) - (centsOf(right.metric) ?? 0));
  const short = queue.filter((row) => (centsOf(row.metric) ?? 0) < 0).length;
  const pageState: { tone: DotTone; label: string } | null = projection
    ? !providers.length
      ? { tone: "warn", label: "No active payment provider" }
      : short
        ? { tone: "danger", label: `${short} short` }
        : queue.length
          ? { tone: "info", label: `${queue.length} to approve` }
          : { tone: "ok", label: "Settlements approved" }
    : null;
  const reconciliationRows = rows.some((row) => row.detail === RECONCILIATION);

  return (
    <PlatformPage title="Payments" {...state} showMetrics={false} state={pageState}>
      {projection ? (
        <>
          <ActionBar>
            {providers.length ? (
              <Disclosure label="Reconcile settlement" title="Reconcile provider settlement" primary>
                <FormGrid action={generatePaymentReconciliationAction} submit="Generate reconciliation">
                  <HiddenScope projection={projection} returnPath={path} />
                  <SelectField label="Payment provider" name="paymentProviderId" options={providers} />
                  <TextField label="Period start (ISO + offset)" name="periodStartedAt" required />
                  <TextField label="Period end (ISO + offset)" name="periodEndedAt" required />
                  <TextField label="Reported fees (cents)" name="reportedFeeCents" type="number" min="0" step="1" defaultValue="0" required />
                  <TextField label="Reported settlement (signed cents)" name="reportedSettlementCents" type="number" step="1" required />
                  <TextField label="Review notes" name="notes" />
                </FormGrid>
              </Disclosure>
            ) : (
              <Disclosure label="Add provider" title="Configure payment provider" primary>
                <ProviderForm projection={projection} />
              </Disclosure>
            )}
          </ActionBar>
          {!providers.length ? <NoteLine>No payment provider</NoteLine> : null}

          <section className="min-w-0" aria-labelledby="payments-queue">
            <SectionTitle id="payments-queue" meta={queue.length || undefined}>Needs you</SectionTitle>
            {queue.length ? (
              <DataTable aria-label="Settlements to approve">
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th>Status</Th>
                    <Th priority={2}>What</Th>
                    <Th align="right">Variance</Th>
                    <Th align="right"><span className="sr-only">Action</span></Th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((row) => {
                    const variance = centsOf(row.metric);
                    const isSettlement = pending.has(row.id);
                    const cells = (
                      <>
                        <Td className="font-mono tabular-nums [overflow-wrap:anywhere]">{row.title}</Td>
                        <Td><StatusText status={row.status} /></Td>
                        <Td priority={2} className="text-muted-foreground">{isSettlement ? "Approve the settlement" : row.detail}</Td>
                        <Td align="right" className={variance !== null && variance < 0 ? "text-[oklch(0.52_0.19_27)] dark:text-red-400" : ""}>
                          {variance === null ? "—" : signedMoney(variance, money)}
                        </Td>
                      </>
                    );
                    return isSettlement ? (
                      <QueueRow key={row.id} colSpan={5} tone={variance !== null && variance < 0 ? "danger" : null} actionLabel="Approve" cells={cells}>
                        <FormGrid action={approvePaymentReconciliationAction} submit="Approve reconciliation">
                          <HiddenScope projection={projection} returnPath={path} />
                          <input type="hidden" name="reconciliationId" value={row.id} />
                          <SelectField label="Approver" name="employeeId" options={controls.employees ?? []} />
                          <TextField label="Disposition notes" name="notes" />
                        </FormGrid>
                      </QueueRow>
                    ) : (
                      <Tr key={row.id}>
                        {cells}
                        <Td />
                      </Tr>
                    );
                  })}
                </tbody>
              </DataTable>
            ) : (
              <NoteLine tone="ok">No settlement waiting for approval.</NoteLine>
            )}
          </section>

          <Workbench
            scope="payments"
            sections={[
              {
                id: "settlements",
                label: reconciliationRows ? "Settlements" : "Provider events",
                count: rows.length,
                content: rows.length ? (
                  <DataTable aria-label="Settlements and provider events">
                    <thead>
                      <tr>
                        <Th>Reference</Th>
                        <Th>Status</Th>
                        <Th priority={2}>What</Th>
                        <Th align="right" priority={3}>{reconciliationRows ? "Period end" : "Received"}</Th>
                        <Th align="right">{reconciliationRows ? "Variance" : ""}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => {
                        const variance = centsOf(row.metric);
                        return (
                          <Tr key={row.id}>
                            <Td className="font-mono tabular-nums [overflow-wrap:anywhere]">{row.title}</Td>
                            <Td><StatusText status={row.status} /></Td>
                            <Td priority={2} className="text-muted-foreground">{row.detail}</Td>
                            <Td align="right" priority={3}>{when(row.occurredAt, projection.timezone)}</Td>
                            <Td align="right">
                              {variance === null ? (
                                ""
                              ) : (
                                <span className="inline-flex items-baseline gap-2">
                                  <StateText {...varianceState(variance)} />
                                  {signedMoney(variance, money)}
                                </span>
                              )}
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </DataTable>
                ) : (
                  <EmptyState title="No settlements or provider events yet" />
                ),
              },
              {
                id: "providers",
                label: "Providers",
                count: providers.length,
                content: (
                  <>
                    {providers.length ? (
                      <DataTable aria-label="Active payment providers">
                        <thead>
                          <tr>
                            <Th>Provider</Th>
                            <Th>Status</Th>
                            <Th priority={2}>Adapter and code</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {providers.map((provider) => (
                            <Tr key={provider.id}>
                              <Td className="font-medium">{provider.label}</Td>
                              <Td><StatusText status="active" /></Td>
                              <Td priority={2} className="font-mono text-[12px] text-muted-foreground">{provider.detail}</Td>
                            </Tr>
                          ))}
                        </tbody>
                      </DataTable>
                    ) : (
                      <EmptyState title="No active payment provider" />
                    )}
                    {providers.length ? (
                      <ActionBar>
                        <Disclosure label="Add or update provider" title="Configure payment provider">
                          <ProviderForm projection={projection} />
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

function ProviderForm({ projection }: { projection: PlatformProjection }) {
  return (
    <FormGrid action={configurePaymentProviderAction} submit="Save provider">
      <HiddenScope projection={projection} returnPath={path} />
      <TextField label="Provider name" name="name" required />
      <TextField label="Code" name="code" required />
      <EnumField label="Adapter" name="adapterKey" values={[{ value: "manual_external", label: "Manual external terminal" }, { value: "hmac_json_v1", label: "Signed HMAC JSON v1" }]} />
      <TextField label="Credential reference" name="credentialReference" placeholder="env://PAYMENT_WEBHOOK_KEY" />
      <EnumField label="Initial state" name="activate" values={[{ value: "true", label: "Active" }, { value: "false", label: "Configured only" }]} />
    </FormGrid>
  );
}

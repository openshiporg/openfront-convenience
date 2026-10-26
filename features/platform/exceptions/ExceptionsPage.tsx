import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { evaluateAlertsAction, transitionAlertAction } from "../actions";
import {
  EmptyState,
  EnumField,
  FormGrid,
  HiddenScope,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { CountBoxes, DataTable, SectionTitle, Td, Th, Tr, statusLabel, type DotTone } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { employeeName, type EmployeeRef } from "../lib/people";
import { getPlatformProjection, type PlatformProjection, type PlatformSearch } from "../lib/projection";
import { isToday } from "../fuel/ops-kit";
import { ActionBar, Disclosure, NoteLine, StateText, ageText } from "../reconciliation/ledger-ui";
import { QueueRow } from "../reconciliation/QueueRow";

const path = "/dashboard/platform/exceptions";

type Alert = {
  id: string;
  alertNumber: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  resourceType: string;
  observedValue: string | null;
  thresholdValue: string | null;
  detectedAt: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  store: { name: string } | null;
  acknowledgedBy: EmployeeRef;
};

const SEVERITY: Record<string, { rank: number; tone: DotTone }> = {
  critical: { rank: 0, tone: "danger" },
  warning: { rank: 1, tone: "warn" },
  info: { rank: 2, tone: "info" },
};

/** Alert rows with their owner and source; the projection carries only title and status. */
async function loadAlerts(projection: PlatformProjection): Promise<Alert[] | null> {
  const response = await keystoneClient<{ operationalAlerts: Alert[] }>(
    `query PlatformExceptionQueue($businessId: ID!, $storeId: ID!, $take: Int!) {
      operationalAlerts(
        where: {
          business: { id: { equals: $businessId } }
          OR: [{ store: { id: { equals: $storeId } } }, { store: null }]
        }
        orderBy: [{ detectedAt: desc }]
        take: $take
      ) {
        id alertNumber type title message severity status resourceType observedValue thresholdValue detectedAt acknowledgedAt resolvedAt
        store { name }
        acknowledgedBy { employeeNumber user { name } }
      }
    }`,
    { businessId: projection.businessId ?? "", storeId: projection.storeId ?? "", take: Math.max(projection.limit || 50, 50) },
  );
  return response.success ? response.data.operationalAlerts : null;
}

/** Fallback when the detailed query is not available: the projection's rows. */
function fromRows(rows: PlatformProjection["rows"]): Alert[] {
  return rows.map((row) => {
    const [severity = "warning", status = "open"] = row.status.split(" · ");
    return {
      id: row.id,
      alertNumber: row.metric,
      type: "other",
      title: row.title,
      message: row.detail,
      severity,
      status,
      resourceType: "",
      observedValue: null,
      thresholdValue: null,
      detectedAt: row.occurredAt,
      acknowledgedAt: null,
      resolvedAt: null,
      store: null,
      acknowledgedBy: null,
    };
  });
}

const sourceLabel = (alert: Alert) =>
  [alert.resourceType ? alert.resourceType.replace(/([a-z])([A-Z])/g, "$1 $2") : statusLabel(alert.type), alert.store?.name]
    .filter(Boolean)
    .join(" · ");

export async function ExceptionsPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("exceptions", searchParams);
  const projection = state.projection;
  const detailed = projection ? await loadAlerts(projection) : null;
  const alerts = projection ? (detailed ?? fromRows(projection.rows)) : [];
  const now = Date.now();
  const open = alerts
    .filter((alert) => alert.status === "open" || alert.status === "acknowledged")
    .sort(
      (left, right) =>
        (SEVERITY[left.severity]?.rank ?? 3) - (SEVERITY[right.severity]?.rank ?? 3) ||
        (left.status === "open" ? 0 : 1) - (right.status === "open" ? 0 : 1) ||
        String(left.detectedAt).localeCompare(String(right.detectedAt)),
    );
  const closed = alerts.filter((alert) => alert.status !== "open" && alert.status !== "acknowledged");
  const critical = open.filter((alert) => alert.severity === "critical").length;
  const unowned = open.filter((alert) => alert.status === "open").length;
  // Resolution times come only from the detailed read; without it the box stays blank.
  const resolvedToday = detailed
    ? closed.filter((alert) => alert.status === "resolved" && isToday(alert.resolvedAt, projection?.timezone)).length
    : null;
  const pageState: { tone: DotTone; label: string } | null = projection
    ? open.length
      ? { tone: critical ? "danger" : "warn", label: `${open.length} open${critical ? ` · ${critical} critical` : ""}${unowned ? ` · ${unowned} unowned` : ""}` }
      : { tone: "ok", label: "Queue clear" }
    : null;

  return (
    <PlatformPage title="Exceptions" {...state} showMetrics={false} state={pageState}>
      {projection ? (
        <>
          <ActionBar>
            <Disclosure label="Evaluate controls" title="Evaluate controls" primary>
              <FormGrid action={evaluateAlertsAction} submit="Evaluate now">
                <HiddenScope projection={projection} returnPath={path} />
                <TextField label="Cash variance threshold (cents)" name="cashVarianceThresholdCents" type="number" min="0" step="1" defaultValue="500" required />
                <TextField label="Fuel variance threshold (gallons)" name="fuelVarianceThresholdGallons" inputMode="decimal" defaultValue="0.5000" required />
                <TextField label="Expiry window (days)" name="expiryWindowDays" type="number" min="0" max="365" step="1" defaultValue="7" required />
              </FormGrid>
            </Disclosure>
          </ActionBar>

          <CountBoxes
            items={[
              { label: "Open", value: open.length, variance: critical ? -1 : null, note: critical ? `${critical} critical` : undefined },
              { label: "Unowned", value: unowned },
              { label: "Resolved today", value: resolvedToday ?? "–" },
            ]}
          />

          <Workbench
            scope="exceptions"
            sections={[
              {
                id: "queue",
                label: "Open queue",
                count: open.length,
                content: (
                  <section className="min-w-0" aria-labelledby="exception-queue">
                    <SectionTitle id="exception-queue" meta={open.length || undefined}>Exception queue</SectionTitle>
                    {open.length ? (
                      <DataTable aria-label="Exception queue">
                        <thead>
                          <tr>
                            <Th>Severity</Th>
                            <Th>Status</Th>
                            <Th>What</Th>
                            <Th priority={3}>Source</Th>
                            <Th align="right" priority={2}>Age</Th>
                            <Th priority={2}>Owner</Th>
                            <Th align="right"><span className="sr-only">Action</span></Th>
                          </tr>
                        </thead>
                        <tbody>
                          {open.map((alert) => (
                            <QueueRow
                              key={alert.id}
                              colSpan={7}
                              tone={alert.severity === "critical" ? "danger" : null}
                              actionLabel={alert.status === "open" ? "Own or resolve" : "Resolve"}
                              cells={
                                <>
                                  <Td><StateText tone={SEVERITY[alert.severity]?.tone ?? "muted"} label={statusLabel(alert.severity)} /></Td>
                                  <Td>
                                    <StateText tone={alert.status === "open" ? "info" : "muted"} label={alert.status === "open" ? "Unowned" : "Owned"} />
                                  </Td>
                                  <Td className="min-w-[12rem]">
                                    <p className="font-medium text-foreground [overflow-wrap:anywhere]">{alert.title || alert.alertNumber}</p>
                                    <p className="text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
                                      {alert.observedValue && alert.thresholdValue
                                        ? `${alert.observedValue} vs limit ${alert.thresholdValue}`
                                        : alert.message}
                                    </p>
                                  </Td>
                                  <Td priority={3} className="text-muted-foreground">{sourceLabel(alert) || "—"}</Td>
                                  <Td align="right" priority={2}>
                                    {alert.detectedAt ? <time dateTime={alert.detectedAt}>{ageText(alert.detectedAt, now)}</time> : "—"}
                                  </Td>
                                  <Td priority={2} className="whitespace-nowrap text-muted-foreground">
                                    {alert.acknowledgedBy ? employeeName(alert.acknowledgedBy) : "—"}
                                  </Td>
                                </>
                              }
                            >
                              <DispositionForm projection={projection} alert={alert} />
                            </QueueRow>
                          ))}
                        </tbody>
                      </DataTable>
                    ) : (
                      <NoteLine tone="ok">No open exceptions</NoteLine>
                    )}
                  </section>
                ),
              },
              {
                id: "history",
                label: "Resolved",
                count: closed.length,
                content: closed.length ? (
                  <DataTable aria-label="Resolved and dismissed exceptions">
                    <thead>
                      <tr>
                        <Th>Severity</Th>
                        <Th>Status</Th>
                        <Th>What</Th>
                        <Th priority={3}>Source</Th>
                        <Th align="right" priority={2}>Reference</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {closed.map((alert) => (
                        <Tr key={alert.id}>
                          <Td><StateText tone={SEVERITY[alert.severity]?.tone ?? "muted"} label={statusLabel(alert.severity)} /></Td>
                          <Td><StateText tone={alert.status === "resolved" ? "ok" : "muted"} label={statusLabel(alert.status)} /></Td>
                          <Td className="[overflow-wrap:anywhere]">{alert.title || alert.alertNumber}</Td>
                          <Td priority={3} className="text-muted-foreground">{sourceLabel(alert) || "—"}</Td>
                          <Td align="right" priority={2} className="text-muted-foreground">{alert.alertNumber}</Td>
                        </Tr>
                      ))}
                    </tbody>
                  </DataTable>
                ) : (
                  <EmptyState title="No resolved exceptions yet" />
                ),
              },
            ]}
          />
        </>
      ) : null}
    </PlatformPage>
  );
}

function DispositionForm({ projection, alert }: { projection: PlatformProjection; alert: Alert }) {
  const values =
    alert.status === "open"
      ? [
          { value: "acknowledged", label: "Own it (acknowledge)" },
          { value: "resolved", label: "Resolve" },
          { value: "dismissed", label: "Dismiss with reason" },
        ]
      : [
          { value: "resolved", label: "Resolve" },
          { value: "dismissed", label: "Dismiss with reason" },
        ];
  return (
    <FormGrid action={transitionAlertAction} submit="Apply disposition">
      <HiddenScope projection={projection} returnPath={path} />
      <input type="hidden" name="alertId" value={alert.id} />
      <SelectField label="Employee" name="employeeId" options={projection.controls.employees ?? []} />
      <EnumField label="Next state" name="nextStatus" values={values} />
      <div className="sm:col-span-2">
        <TextField label="Disposition notes" name="notes" />
      </div>
    </FormGrid>
  );
}

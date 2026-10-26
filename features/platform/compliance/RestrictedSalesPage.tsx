import { configureAgePolicyAction, transitionComplianceIncidentAction, verifyAgeAction } from "../actions";
import {
  EnumField,
  FormGrid,
  HiddenScope,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { DataTable, SectionTitle, StatusText, Td, Th, Tr, statusLabel, type DotTone } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { ActionBar, ActionDisclosure, PrereqNotice, QueueClear, ToneText, When, isToday } from "../fuel/ops-kit";
import { getPlatformProjection, type PlatformProjection, type PlatformSearch } from "../lib/projection";

const path = "/dashboard/platform/restricted-sales";

type Row = PlatformProjection["rows"][number];

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_TONE: Record<string, DotTone> = { critical: "danger", high: "danger", medium: "warn", low: "info" };
const OUTCOME_TONE: Record<string, DotTone> = { passed: "ok", declined: "warn", failed: "danger", overridden: "warn" };

/** Incident rows carry "severity · status"; verification rows carry the outcome. */
const isVerification = (row: Row) => row.metric === "Verification evidence";
const incidentParts = (row: Row) => {
  const [severity = "", status = ""] = row.status.split(" · ");
  return { severity, status };
};
const isOpenIncident = (row: Row) => !isVerification(row) && !["closed", "resolved"].includes(incidentParts(row).status);

function IncidentTable({ rows, timeZone, label }: { rows: Row[]; timeZone: string | null; label: string }) {
  return (
    <DataTable aria-label={label}>
      <thead>
        <tr>
          <Th>Incident</Th>
          <Th priority={2}>Type</Th>
          <Th priority={3}>Description</Th>
          <Th>Severity</Th>
          <Th>Status</Th>
          <Th priority={2}>Reported</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const { severity, status } = incidentParts(row);
          return (
            <Tr key={row.id}>
              <Td className="font-mono tabular-nums">{row.title}</Td>
              <Td priority={2}>{statusLabel(row.metric)}</Td>
              <Td priority={3} className="max-w-72 truncate">{row.detail || "—"}</Td>
              <Td>
                <ToneText tone={SEVERITY_TONE[severity] ?? "muted"}>{statusLabel(severity)}</ToneText>
              </Td>
              <Td>
                <StatusText status={status} />
              </Td>
              <Td priority={2}>
                <When value={row.occurredAt} timeZone={timeZone} />
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

function VerificationTable({ rows, timeZone, label }: { rows: Row[]; timeZone: string | null; label: string }) {
  return (
    <DataTable aria-label={label}>
      <thead>
        <tr>
          <Th>ID check</Th>
          <Th priority={2}>Method · age</Th>
          <Th>Outcome</Th>
          <Th priority={2}>Checked</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td className="font-mono tabular-nums">{row.title}</Td>
            <Td priority={2}>{statusLabel(row.detail)}</Td>
            <Td>
              <ToneText tone={OUTCOME_TONE[row.status] ?? "muted"}>{statusLabel(row.status)}</ToneText>
            </Td>
            <Td priority={2}>
              <When value={row.occurredAt} timeZone={timeZone} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export async function RestrictedSalesPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("compliance", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const timeZone = projection?.timezone ?? null;
  const rows = projection?.rows ?? [];
  const incidents = rows.filter((row) => !isVerification(row));
  const verifications = rows.filter(isVerification);
  const policies = controls.compliancePolicies ?? [];
  // Needs you: open incidents by severity, oldest first; then today's checks that didn't pass.
  const openIncidents = incidents
    .filter(isOpenIncident)
    .sort(
      (left, right) =>
        (SEVERITY_RANK[incidentParts(left).severity] ?? 9) - (SEVERITY_RANK[incidentParts(right).severity] ?? 9) ||
        (left.occurredAt ?? "").localeCompare(right.occurredAt ?? ""),
    );
  const notPassedToday = verifications.filter((row) => row.status !== "passed" && isToday(row.occurredAt, timeZone));

  return <PlatformPage
    title="Restricted Sales"
    showMetrics={false}
    state={!policies.length ? { tone: "warn", label: "Merchant authorization required" } : undefined}
    {...state}
  >
    {projection ? (
      <>
        {!policies.length ? (
          <PrereqNotice
            title="No active age policy"
            items={[
              {
                label: "ID checks need an active age-restriction policy",
                fix: (
                  <ActionDisclosure label="Configure policy" primary>
                    <FormGrid action={configureAgePolicyAction} submit="Save policy">
                      <HiddenScope projection={projection} returnPath={path} />
                      <TextField label="Policy name" name="name" required />
                      <TextField label="Policy code" name="code" required />
                      <TextField label="Jurisdiction label" name="jurisdiction" required />
                      <EnumField label="Status" name="status" values={[{ value: "draft", label: "Draft" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
                      <TextField label="Minimum age" name="minimumAge" type="number" min="1" max="120" step="1" required />
                      <TextField label="ID check threshold age" name="idCheckThresholdAge" type="number" min="0" max="120" step="1" />
                      <EnumField label="Manager override" name="managerOverrideAllowed" values={[{ value: "false", label: "Not allowed" }, { value: "true", label: "Allowed with reason" }]} />
                      <EnumField label="External scan required" name="scanRequired" values={[{ value: "false", label: "No" }, { value: "true", label: "Yes" }]} />
                      <SelectField label="Product scope (optional)" name="productId" options={controls.products ?? []} required={false} />
                      <SelectField label="Category scope (optional)" name="categoryId" options={controls.productCategories ?? []} required={false} />
                      <TextField label="Starts at (optional ISO)" name="startsAt" />
                      <TextField label="Ends at (optional ISO)" name="endsAt" />
                    </FormGrid>
                  </ActionDisclosure>
                ),
              },
            ]}
          />
        ) : null}

        <ActionBar label="Restricted sale actions">
          <ActionDisclosure label="Record ID check" primary={policies.length > 0}>
            <FormGrid action={verifyAgeAction} submit="Record ID check">
              <HiddenScope projection={projection} returnPath={path} />
              <SelectField label="Policy" name="policyId" options={controls.compliancePolicies ?? []} />
              <SelectField label="Verifier" name="employeeId" options={controls.employees ?? []} />
              <SelectField label="Open cart (optional)" name="cartId" options={controls.carts ?? []} required={false} />
              <SelectField label="Sale (optional)" name="saleId" options={controls.sales ?? []} required={false} />
              <EnumField label="Outcome" name="outcome" values={[{ value: "passed", label: "Passed" }, { value: "declined", label: "Declined" }, { value: "failed", label: "Failed" }, { value: "overridden", label: "Manager override" }]} />
              <EnumField label="Method" name="method" values={[{ value: "id_scan", label: "Externally scanned ID" }, { value: "visual_check", label: "Visual check" }, { value: "known_customer", label: "Known customer" }, { value: "manager_override", label: "Manager override" }]} />
              <TextField label="Verified age" name="ageAtVerification" type="number" min="0" max="120" step="1" required />
              <TextField label="Document type" name="documentType" placeholder="driver_license" />
              <TextField label="SHA-256 fingerprint" name="documentFingerprint" minLength={64} maxLength={64} />
              <TextField label="Override reason" name="overrideReason" />
              <TextField label="Manager PIN for override" name="managerPin" type="password" inputMode="numeric" />
            </FormGrid>
          </ActionDisclosure>
          <ActionDisclosure label="Disposition incident">
            <FormGrid action={transitionComplianceIncidentAction} submit="Record disposition">
              <HiddenScope projection={projection} returnPath={path} />
              <SelectField label="Incident" name="incidentId" options={controls.complianceIncidents ?? []} />
              <SelectField label="Responsible employee" name="employeeId" options={controls.employees ?? []} />
              <EnumField label="Next status" name="nextStatus" values={[{ value: "investigating", label: "Investigating" }, { value: "reported", label: "Reported externally" }, { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" }]} />
              <TextField label="Disposition / resolution" name="resolution" minLength={4} maxLength={2000} required />
            </FormGrid>
          </ActionDisclosure>
        </ActionBar>

        <section className="min-w-0 space-y-2" aria-label="Open incidents">
          <SectionTitle meta={openIncidents.length || undefined}>Open incidents</SectionTitle>
          {openIncidents.length ? (
            <IncidentTable rows={openIncidents} timeZone={timeZone} label="Open incidents" />
          ) : (
            <QueueClear>No open incidents</QueueClear>
          )}
        </section>

        {notPassedToday.length ? (
          <section className="min-w-0 space-y-2" aria-label="Checks not passed today">
            <SectionTitle meta={notPassedToday.length}>Checks not passed today</SectionTitle>
            <VerificationTable rows={notPassedToday} timeZone={timeZone} label="Checks not passed today" />
          </section>
        ) : null}

        <Workbench
          scope="restricted-sales"
          sections={[
            {
              id: "verify",
              label: "ID checks",
              count: verifications.length,
              content: verifications.length ? (
                <VerificationTable rows={verifications} timeZone={timeZone} label="ID checks" />
              ) : (
                <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">No ID checks recorded yet</p>
              ),
            },
            {
              id: "incidents",
              label: "Incidents",
              count: incidents.length,
              content: incidents.length ? (
                <IncidentTable rows={incidents} timeZone={timeZone} label="All incidents" />
              ) : (
                <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">No incidents recorded</p>
              ),
            },
            {
              id: "policy",
              label: "Policy",
              count: policies.length,
              content: (
                <>
                  {policies.length ? (
                    <DataTable aria-label="Active policies">
                      <thead>
                        <tr>
                          <Th>Policy</Th>
                          <Th>Minimum age</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {policies.map((policy) => (
                          <Tr key={policy.id}>
                            <Td>{policy.label}</Td>
                            <Td className="font-mono tabular-nums">{policy.detail}</Td>
                            <Td>
                              <StatusText status="active" />
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </DataTable>
                  ) : null}
                  {policies.length ? (
                    <ActionBar label="Policy actions">
                      <ActionDisclosure label="Configure policy">
                        <FormGrid action={configureAgePolicyAction} submit="Save policy">
                          <HiddenScope projection={projection} returnPath={path} />
                          <TextField label="Policy name" name="name" required />
                          <TextField label="Policy code" name="code" required />
                          <TextField label="Jurisdiction label" name="jurisdiction" required />
                          <EnumField label="Status" name="status" values={[{ value: "draft", label: "Draft" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
                          <TextField label="Minimum age" name="minimumAge" type="number" min="1" max="120" step="1" required />
                          <TextField label="ID check threshold age" name="idCheckThresholdAge" type="number" min="0" max="120" step="1" />
                          <EnumField label="Manager override" name="managerOverrideAllowed" values={[{ value: "false", label: "Not allowed" }, { value: "true", label: "Allowed with reason" }]} />
                          <EnumField label="External scan required" name="scanRequired" values={[{ value: "false", label: "No" }, { value: "true", label: "Yes" }]} />
                          <SelectField label="Product scope (optional)" name="productId" options={controls.products ?? []} required={false} />
                          <SelectField label="Category scope (optional)" name="categoryId" options={controls.productCategories ?? []} required={false} />
                          <TextField label="Starts at (optional ISO)" name="startsAt" />
                          <TextField label="Ends at (optional ISO)" name="endsAt" />
                        </FormGrid>
                      </ActionDisclosure>
                    </ActionBar>
                  ) : null}
                </>
              ),
            },
          ]}
        />
      </>
    ) : null}
  </PlatformPage>;
}

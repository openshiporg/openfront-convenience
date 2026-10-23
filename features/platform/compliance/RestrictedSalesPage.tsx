import { configureAgePolicyAction, transitionComplianceIncidentAction, verifyAgeAction } from "../actions";
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

const path = "/dashboard/platform/restricted-sales";

export async function RestrictedSalesPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("compliance", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return <PlatformPage title="Restricted Sales" state={{ tone: "warn", label: "Merchant authorization required" }} {...state}>
    {projection ? (
      <Workbench
        scope="restricted-sales"
        sections={[
          {
            id: "verify",
            label: "ID checks",
            count: projection.rows.length,
            content: (
              <>
                <PanelGrid>
                  <ActionPanel title="Record age verification">
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
                  </ActionPanel>
                  <ActionPanel title="Disposition compliance incident">
                    <FormGrid action={transitionComplianceIncidentAction} submit="Record disposition">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Incident" name="incidentId" options={controls.complianceIncidents ?? []} />
                      <SelectField label="Responsible employee" name="employeeId" options={controls.employees ?? []} />
                      <EnumField label="Next status" name="nextStatus" values={[{ value: "investigating", label: "Investigating" }, { value: "reported", label: "Reported externally" }, { value: "resolved", label: "Resolved" }, { value: "closed", label: "Closed" }]} />
                      <TextField label="Disposition / resolution" name="resolution" minLength={4} maxLength={2000} required />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
                <EvidenceTable rows={projection.rows} timeZone={projection.timezone} title="ID checks and incidents" />
              </>
            ),
          },
          {
            id: "policy",
            label: "Policy",
            content: (
              <PanelGrid>
                <ActionPanel title="Configure merchant policy">
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
                </ActionPanel>
              </PanelGrid>
            ),
          },
        ]}
      />
    ) : null}
  </PlatformPage>;
}

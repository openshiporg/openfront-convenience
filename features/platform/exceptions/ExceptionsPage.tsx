import { evaluateAlertsAction, transitionAlertAction } from "../actions";
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

const path = "/dashboard/platform/exceptions";

export async function ExceptionsPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("exceptions", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return <PlatformPage title="Exceptions" {...state}>
    {projection ? (
      <Workbench
        scope="exceptions"
        sections={[
          {
            id: "queue",
            label: "Queue",
            count: projection.rows.length,
            content: (
              <>
                <EvidenceTable rows={projection.rows} timeZone={projection.timezone} title="Exception queue" />
                <PanelGrid>
                  <ActionPanel title="Own or resolve alert">
                    <FormGrid action={transitionAlertAction} submit="Apply disposition">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Alert" name="alertId" options={controls.operationalAlerts ?? []} />
                      <SelectField label="Employee" name="employeeId" options={controls.employees ?? []} />
                      <EnumField label="Next state" name="nextStatus" values={[{ value: "acknowledged", label: "Acknowledge" }, { value: "resolved", label: "Resolve" }, { value: "dismissed", label: "Dismiss with reason" }]} />
                      <TextField label="Disposition notes" name="notes" />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
              </>
            ),
          },
          {
            id: "evaluate",
            label: "Evaluate",
            content: (
              <PanelGrid>
                <ActionPanel title="Evaluate controls">
                  <FormGrid action={evaluateAlertsAction} submit="Evaluate now">
                    <HiddenScope projection={projection} returnPath={path} />
                    <TextField label="Cash variance threshold (cents)" name="cashVarianceThresholdCents" type="number" min="0" step="1" defaultValue="500" required />
                    <TextField label="Fuel variance threshold (gallons)" name="fuelVarianceThresholdGallons" inputMode="decimal" defaultValue="0.5000" required />
                    <TextField label="Expiry window (days)" name="expiryWindowDays" type="number" min="0" max="365" step="1" defaultValue="7" required />
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

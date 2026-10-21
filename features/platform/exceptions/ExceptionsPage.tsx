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
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";

const path = "/dashboard/platform/exceptions";

export async function ExceptionsPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("exceptions", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return <PlatformPage title="Exceptions" description="Cash, fuel, stock and settlement issues that need attention." {...state}>
    {projection ? <>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]">
        <EvidenceTable rows={projection.rows} title="Exception queue" />
        <div className="space-y-4">
          <ActionPanel title="Evaluate controls" description="Creates deduplicated alerts from immutable source evidence and configured review thresholds.">
            <FormGrid action={evaluateAlertsAction} submit="Evaluate now">
              <HiddenScope projection={projection} returnPath={path} />
              <TextField label="Cash variance threshold (cents)" name="cashVarianceThresholdCents" type="number" min="0" step="1" defaultValue="500" required />
              <TextField label="Fuel variance threshold (gallons)" name="fuelVarianceThresholdGallons" inputMode="decimal" defaultValue="0.5000" required />
              <TextField label="Expiry window (days)" name="expiryWindowDays" type="number" min="0" max="365" step="1" defaultValue="7" required />
            </FormGrid>
          </ActionPanel>
          <ActionPanel title="Own or resolve alert" description="Terminal disposition requires notes and retains actor/timestamp evidence.">
            <FormGrid action={transitionAlertAction} submit="Apply disposition">
              <HiddenScope projection={projection} returnPath={path} />
              <SelectField label="Alert" name="alertId" options={controls.operationalAlerts ?? []} />
              <SelectField label="Employee" name="employeeId" options={controls.employees ?? []} />
              <EnumField label="Next state" name="nextStatus" values={[{ value: "acknowledged", label: "Acknowledge" }, { value: "resolved", label: "Resolve" }, { value: "dismissed", label: "Dismiss with reason" }]} />
              <TextField label="Disposition notes" name="notes" />
            </FormGrid>
          </ActionPanel>
        </div>
      </div>
    </> : null}
  </PlatformPage>;
}

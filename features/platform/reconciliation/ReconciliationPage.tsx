import {
  approveStoreDayAction,
  generateStoreDayAction,
  prepareDepositAction,
  transitionDepositAction,
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

const path = "/dashboard/platform/reconciliation";

export async function ReconciliationPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("reconciliation", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  return <PlatformPage title="Reconciliation" description="Close the store day and reconcile cash and card totals." {...state}>
    {projection ? <>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ActionPanel title="Generate store day" description="Aggregates closed register sessions for one explicit trading period.">
          <FormGrid action={generateStoreDayAction} submit="Generate close package">
            <HiddenScope projection={projection} returnPath={path} />
            <TextField label="Trading date" name="tradingDate" type="date" required />
            <TextField label="Period start (ISO + offset)" name="periodStartedAt" placeholder="2026-07-19T00:00:00-04:00" required />
            <TextField label="Period end (ISO + offset)" name="periodEndedAt" placeholder="2026-07-20T00:00:00-04:00" required />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Approve or lock" description="Moves review evidence forward; terminal locked days cannot be reopened.">
          <FormGrid action={approveStoreDayAction} submit="Apply approval">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Store day" name="storeDayId" options={controls.storeDays ?? []} />
            <SelectField label="Approver" name="employeeId" options={controls.employees ?? []} />
            <EnumField label="Outcome" name="lock" values={[{ value: "false", label: "Approve" }, { value: "true", label: "Approve and lock" }]} />
            <TextField label="Review notes" name="notes" />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Prepare bank deposit" description="Captures bag reference, expected amount comparison, and preparing employee.">
          <FormGrid action={prepareDepositAction} submit="Prepare deposit">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Unlocked store day" name="storeDayId" options={controls.storeDays ?? []} />
            <SelectField label="Prepared by" name="employeeId" options={controls.employees ?? []} />
            <TextField label="Amount (cents)" name="amountCents" type="number" min="0" step="1" required />
            <TextField label="Bag reference" name="bagReference" required />
            <TextField label="Notes" name="notes" />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Advance deposit" description="Transitions prepared → deposited → verified while preserving settlement evidence.">
          <FormGrid action={transitionDepositAction} submit="Advance deposit">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Bank deposit" name="depositId" options={controls.bankDeposits ?? []} />
            <SelectField label="Employee" name="employeeId" options={controls.employees ?? []} />
            <EnumField label="Next state" name="nextStatus" values={[{ value: "in_transit", label: "In transit" }, { value: "deposited", label: "Deposited" }, { value: "verified", label: "Verified" }, { value: "voided", label: "Void" }]} />
            <TextField label="Bank reference" name="bankReference" />
            <TextField label="Notes" name="notes" />
          </FormGrid>
        </ActionPanel>
      </div>
      <EvidenceTable rows={projection.rows} title="Store-day close history" />
    </> : null}
  </PlatformPage>;
}

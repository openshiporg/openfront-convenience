import { adjustLoyaltyAction, configureLoyaltyProgramAction, enrollLoyaltyAction, expireLoyaltyPointsAction } from "../actions";
import {
  ActionPanel,
  EnumField,
  EvidenceTable,
  FormGrid,
  HiddenScope,
  LookupForm,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { PanelGrid } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { getPlatformProjection, type PlatformSearch } from "../lib/projection";

const path = "/dashboard/platform/loyalty";

export async function LoyaltyPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("loyalty", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const recentAccountOptions = controls.loyaltyAccounts ?? [];
  const searchedAccountOptions = state.loyaltyAccountSearch
    ? (controls.loyaltyAccountLookup ?? []).filter(
        (searched) =>
          !recentAccountOptions.some(
            (recent) => recent.id === searched.id,
          ),
      )
    : [];
  const accountActionOptions = [
    ...recentAccountOptions,
    ...searchedAccountOptions,
  ];
  return <PlatformPage title="Loyalty" {...state}>
    {projection ? (
      <Workbench
        scope="loyalty"
        sections={[
          {
            id: "members",
            label: "Members",
            count: projection.rows.length,
            content: (
              <>
                <LookupForm
                  action={path}
                  keep={{ businessId: projection.businessId, storeId: projection.storeId }}
                  name="loyaltyAccountSearch"
                  label="Account number"
                  placeholder="Full account number"
                  defaultValue={state.loyaltyAccountSearch}
                  submit="Find"
                  empty={state.loyaltyAccountSearch && !controls.loyaltyAccountLookup?.length ? "No account with that number" : false}
                />
                <PanelGrid>
                  <ActionPanel title="Enroll loyalty account">
                    <FormGrid action={enrollLoyaltyAction} submit="Enroll account">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Program" name="programId" options={controls.loyaltyPrograms ?? []} />
                      <TextField label="Email" name="email" type="email" />
                      <TextField label="Phone" name="phone" />
                      <EnumField label="Marketing opt-in" name="marketingOptIn" values={[{ value: "false", label: "No" }, { value: "true", label: "Yes, captured from customer" }]} />
                    </FormGrid>
                  </ActionPanel>
                  <ActionPanel title="Adjust points">
                    <FormGrid action={adjustLoyaltyAction} submit="Post adjustment">
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField label="Loyalty account" name="accountId" options={accountActionOptions} />
                      <SelectField label="Employee" name="employeeId" options={controls.employees ?? []} />
                      <TextField label="Points delta" name="pointsDelta" type="number" step="1" placeholder="250 or -100" required />
                      <TextField label="Description" name="description" required />
                    </FormGrid>
                  </ActionPanel>
                </PanelGrid>
                <EvidenceTable rows={projection.rows} timeZone={projection.timezone} title="Loyalty ledger" />
              </>
            ),
          },
          {
            id: "program",
            label: "Program",
            content: (
              <PanelGrid>
                <ActionPanel title="Configure loyalty program">
                  <FormGrid action={configureLoyaltyProgramAction} submit="Save program">
                    <HiddenScope projection={projection} returnPath={path} />
                    <TextField label="Program name" name="name" required />
                    <TextField label="Program code" name="code" required />
                    <EnumField label="Status" name="status" values={[{ value: "draft", label: "Draft" }, { value: "active", label: "Active" }, { value: "paused", label: "Paused" }]} />
                    <TextField label="Points per dollar" name="pointsPerDollar" type="number" min="0" step="1" defaultValue="1" required />
                    <TextField label="Redemption points" name="redemptionPoints" type="number" min="1" step="1" defaultValue="100" required />
                    <TextField label="Redemption value (cents)" name="redemptionValueCents" type="number" min="0" step="1" defaultValue="100" required />
                    <TextField label="Points expire after days (optional)" name="pointsExpireAfterDays" type="number" min="1" step="1" />
                  </FormGrid>
                </ActionPanel>
                <ActionPanel title="Expire due points">
                  <FormGrid action={expireLoyaltyPointsAction} submit="Expire due points">
                    <HiddenScope projection={projection} returnPath={path} />
                    <SelectField label="Loyalty account" name="accountId" options={accountActionOptions} />
                    <TextField label="As of (ISO timestamp)" name="asOf" required />
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

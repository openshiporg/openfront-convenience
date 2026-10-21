import { adjustLoyaltyAction, configureLoyaltyProgramAction, enrollLoyaltyAction, expireLoyaltyPointsAction } from "../actions";
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
  return <PlatformPage title="Loyalty" description="Loyalty members, points earned and adjustments." {...state}>
    {projection ? <>
      <section
        aria-label="Find an exact loyalty account"
        className="grid min-w-0 gap-2 border bg-background p-4"
      >
        <form
          action={path}
          method="get"
          className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
        >
          <input
            type="hidden"
            name="businessId"
            value={projection.businessId ?? ""}
          />
          <input
            type="hidden"
            name="storeId"
            value={projection.storeId ?? ""}
          />
          <label className="grid min-w-0 gap-1 text-xs font-medium text-muted-foreground">
            Exact account number
            <input
              type="search"
              name="loyaltyAccountSearch"
              minLength={2}
              maxLength={80}
              autoComplete="off"
              defaultValue={state.loyaltyAccountSearch ?? ""}
              placeholder="Enter the full account number"
              className="h-10 min-w-0 border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="submit"
            className="h-10 border bg-background px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
          >
            Find account
          </button>
        </form>
        {state.loyaltyAccountSearch &&
        !controls.loyaltyAccountLookup?.length ? (
          <p className="text-sm text-muted-foreground" role="status">
            No unique exact active account match is available. Duplicate
            account numbers fail closed; resolve the account-number policy
            before selecting one.
          </p>
        ) : null}
      </section>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ActionPanel title="Configure loyalty program" description="Defines operator-owned earning, redemption, and optional expiry terms without inferring customer consent.">
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
        <ActionPanel title="Enroll loyalty account" description="Creates a stable program account from email or phone. Marketing consent is stored as the submitted choice, not inferred.">
          <FormGrid action={enrollLoyaltyAction} submit="Enroll account">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Program" name="programId" options={controls.loyaltyPrograms ?? []} />
            <TextField label="Email" name="email" type="email" />
            <TextField label="Phone" name="phone" />
            <EnumField label="Marketing opt-in" name="marketingOptIn" values={[{ value: "false", label: "No" }, { value: "true", label: "Yes, captured from customer" }]} />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Expire due points" description="Applies configured earned-entry expiry once using FIFO consumption evidence and an immutable expired ledger entry.">
          <FormGrid action={expireLoyaltyPointsAction} submit="Expire due points">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Loyalty account" name="accountId" options={accountActionOptions} />
            <TextField label="As of (ISO timestamp)" name="asOf" required />
          </FormGrid>
        </ActionPanel>
        <ActionPanel title="Adjust points" description="For reasoned service adjustments only; rejects zero changes and any debit that creates a negative balance.">
          <FormGrid action={adjustLoyaltyAction} submit="Post adjustment">
            <HiddenScope projection={projection} returnPath={path} />
            <SelectField label="Loyalty account" name="accountId" options={accountActionOptions} />
            <SelectField label="Employee" name="employeeId" options={controls.employees ?? []} />
            <TextField label="Points delta" name="pointsDelta" type="number" step="1" placeholder="250 or -100" required />
            <TextField label="Description" name="description" required />
          </FormGrid>
        </ActionPanel>
      </div>
      <EvidenceTable rows={projection.rows} title="Loyalty ledger" />
    </> : null}
  </PlatformPage>;
}

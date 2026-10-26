import { adjustLoyaltyAction, configureLoyaltyProgramAction, enrollLoyaltyAction, expireLoyaltyPointsAction } from "../actions";
import {
  EnumField,
  FormGrid,
  HiddenScope,
  LookupForm,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { DataTable, SectionTitle, StatusText, Td, Th, Tr, type DotTone } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { ActionBar, ActionDisclosure, PrereqNotice, QueueClear, ToneText, When, isToday } from "../fuel/ops-kit";
import { getPlatformProjection, type PlatformOption, type PlatformSearch } from "../lib/projection";

const path = "/dashboard/platform/loyalty";

/** "250 points" / "Gold · -40 points" → -40. */
const pointsOf = (detail: string | null | undefined) => {
  const match = /(-?\d+) points/.exec(detail ?? "");
  return match ? Number(match[1]) : null;
};
const pointsClass = (points: number | null) =>
  points !== null && points < 0 ? "text-[oklch(0.52_0.19_27)] dark:text-red-400" : undefined;

function AccountTable({ accounts, label }: { accounts: PlatformOption[]; label: string }) {
  return (
    <DataTable aria-label={label}>
      <thead>
        <tr>
          <Th>Account</Th>
          <Th>Status</Th>
          <Th align="right">Points</Th>
        </tr>
      </thead>
      <tbody>
        {accounts.map((account) => {
          const points = pointsOf(account.detail);
          return (
            <Tr key={account.id}>
              <Td className="font-mono tabular-nums">{account.label}</Td>
              <Td>
                {points !== null && points < 0 ? <ToneText tone="danger">Negative balance</ToneText> : <StatusText status="active" />}
              </Td>
              <Td align="right" className={pointsClass(points)}>
                {account.detail}
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

export async function LoyaltyPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("loyalty", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const timeZone = projection?.timezone ?? null;
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
  const ledger = projection?.rows ?? [];
  const programs = controls.loyaltyPrograms ?? [];

  // Needs you: negative balances first, then today's manual adjustments to check.
  const queue: Array<{ id: string; ref: string; what: string; tone: DotTone; state: string; figure: string; at: string | null }> = [
    ...recentAccountOptions
      .filter((account) => (pointsOf(account.detail) ?? 0) < 0)
      .map((account) => ({
        id: account.id,
        ref: account.label,
        what: "Account balance",
        tone: "danger" as DotTone,
        state: "Negative balance",
        figure: account.detail ?? "",
        at: null,
      })),
    ...ledger
      .filter((row) => row.status === "manual_adjustment" && isToday(row.occurredAt, timeZone))
      .map((row) => ({
        id: row.id,
        ref: row.title,
        what: row.detail,
        tone: "warn" as DotTone,
        state: "Manual adjustment",
        figure: row.metric,
        at: row.occurredAt,
      })),
  ];

  return <PlatformPage title="Loyalty" showMetrics={false} {...state}>
    {projection ? (
      <>
        {!programs.length ? (
          <PrereqNotice
            title="No active loyalty program"
            items={[
              {
                label: "Members can't be enrolled until a program is active",
                fix: (
                  <ActionDisclosure label="Configure program" primary>
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
                  </ActionDisclosure>
                ),
              },
            ]}
          />
        ) : null}

        <ActionBar label="Loyalty actions">
          <ActionDisclosure label="Enroll account" primary={programs.length > 0}>
            <FormGrid action={enrollLoyaltyAction} submit="Enroll account">
              <HiddenScope projection={projection} returnPath={path} />
              <SelectField label="Program" name="programId" options={controls.loyaltyPrograms ?? []} />
              <TextField label="Email" name="email" type="email" />
              <TextField label="Phone" name="phone" />
              <EnumField label="Marketing opt-in" name="marketingOptIn" values={[{ value: "false", label: "No" }, { value: "true", label: "Yes, captured from customer" }]} />
            </FormGrid>
          </ActionDisclosure>
          <ActionDisclosure label="Adjust points">
            <FormGrid action={adjustLoyaltyAction} submit="Post adjustment">
              <HiddenScope projection={projection} returnPath={path} />
              <SelectField label="Loyalty account" name="accountId" options={accountActionOptions} />
              <SelectField label="Employee" name="employeeId" options={controls.employees ?? []} />
              <TextField label="Points delta" name="pointsDelta" type="number" step="1" placeholder="250 or -100" required />
              <TextField label="Description" name="description" required />
            </FormGrid>
          </ActionDisclosure>
          <ActionDisclosure label="Expire due points">
            <FormGrid action={expireLoyaltyPointsAction} submit="Expire due points">
              <HiddenScope projection={projection} returnPath={path} />
              <SelectField label="Loyalty account" name="accountId" options={accountActionOptions} />
              <TextField label="As of (ISO timestamp)" name="asOf" required />
            </FormGrid>
          </ActionDisclosure>
        </ActionBar>

        <section className="min-w-0 space-y-2" aria-label="Needs you">
          <SectionTitle meta={queue.length || undefined}>Needs you</SectionTitle>
          {queue.length ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Account</Th>
                  <Th priority={2}>Detail</Th>
                  <Th>Status</Th>
                  <Th align="right">Points</Th>
                  <Th priority={3}>When</Th>
                </tr>
              </thead>
              <tbody>
                {queue.map((item) => (
                  <Tr key={item.id}>
                    <Td className="font-mono tabular-nums">{item.ref}</Td>
                    <Td priority={2} className="max-w-64 truncate">{item.what}</Td>
                    <Td>
                      <ToneText tone={item.tone}>{item.state}</ToneText>
                    </Td>
                    <Td align="right" className={pointsClass(pointsOf(item.figure))}>
                      {item.figure}
                    </Td>
                    <Td priority={3}>
                      <When value={item.at} timeZone={timeZone} />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <QueueClear>No negative balances or manual adjustments today</QueueClear>
          )}
        </section>

        <Workbench
          scope="loyalty"
          sections={[
            {
              id: "ledger",
              label: "Ledger",
              count: ledger.length,
              content: ledger.length ? (
                <DataTable aria-label="Loyalty ledger">
                  <thead>
                    <tr>
                      <Th>Account</Th>
                      <Th priority={2}>Description</Th>
                      <Th>Type</Th>
                      <Th align="right">Points</Th>
                      <Th priority={2}>When</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((row) => (
                      <Tr key={row.id}>
                        <Td className="font-mono tabular-nums">{row.title}</Td>
                        <Td priority={2} className="max-w-72 truncate">{row.detail || "—"}</Td>
                        <Td>
                          <StatusText status={row.status} />
                        </Td>
                        <Td align="right" className={pointsClass(pointsOf(row.metric))}>
                          {row.metric}
                        </Td>
                        <Td priority={2}>
                          <When value={row.occurredAt} timeZone={timeZone} />
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </DataTable>
              ) : (
                <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">Nothing recorded yet</p>
              ),
            },
            {
              id: "members",
              label: "Members",
              count: recentAccountOptions.length,
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
                  {state.loyaltyAccountSearch && controls.loyaltyAccountLookup?.length ? (
                    <AccountTable accounts={controls.loyaltyAccountLookup} label="Found account" />
                  ) : null}
                  {recentAccountOptions.length ? (
                    <AccountTable accounts={recentAccountOptions} label="Recently active accounts" />
                  ) : (
                    <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">No members enrolled yet</p>
                  )}
                </>
              ),
            },
            {
              id: "program",
              label: "Program",
              count: programs.length,
              content: (
                <>
                  {programs.length ? (
                    <DataTable aria-label="Active programs">
                      <thead>
                        <tr>
                          <Th>Program</Th>
                          <Th>Code</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {programs.map((program) => (
                          <Tr key={program.id}>
                            <Td>{program.label}</Td>
                            <Td className="font-mono tabular-nums">{program.detail}</Td>
                            <Td>
                              <StatusText status="active" />
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </DataTable>
                  ) : null}
                  {programs.length ? (
                    <ActionBar label="Program actions">
                      <ActionDisclosure label="Configure program">
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

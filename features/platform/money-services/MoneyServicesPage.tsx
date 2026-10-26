import Link from "next/link";
import type { ReactNode } from "react";

import {
  approveMoneyServiceSettlementAction,
  configureMoneyServiceProviderAction,
  generateMoneyServiceSettlementAction,
  recordMoneyServiceTransactionAction,
  voidMoneyServiceTransactionAction,
} from "../actions";
import {
  EnumField,
  FormGrid,
  HiddenScope,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import {
  CountBoxes,
  DataTable,
  SectionTitle,
  StatusText,
  Td,
  Th,
  Tr,
  buttonClass,
} from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { ActionBar, ActionDisclosure, PrereqNotice, QueueClear, ToneText, When, isToday, money, parseMoney } from "../fuel/ops-kit";
import { getPlatformProjection, type PlatformProjection, type PlatformSearch } from "../lib/projection";
import { scopeQuery } from "../lib/scope";

const path = "/dashboard/platform/money-services";
const serviceValues = [
  { value: "money_order", label: "Money order" },
  { value: "money_transfer", label: "Money transfer" },
  { value: "bill_payment", label: "Bill payment" },
  { value: "check_cashing", label: "Check cashing" },
  { value: "stored_value", label: "Stored value" },
  { value: "atm_other", label: "ATM / other" },
];

const sentence = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : "—");

function TransactionTable({
  rows,
  timeZone,
  label,
}: {
  rows: PlatformProjection["rows"];
  timeZone: string | null;
  label: string;
}) {
  return (
    <DataTable aria-label={label}>
      <thead>
        <tr>
          <Th>Transaction</Th>
          <Th>Service</Th>
          <Th>Status</Th>
          <Th align="right">Face</Th>
          <Th priority={2}>Time</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td className="font-mono tabular-nums">{row.title}</Td>
            <Td>{sentence(row.detail)}</Td>
            <Td>
              <StatusText status={row.status} />
            </Td>
            <Td align="right" className={["voided", "refunded"].includes(row.status) ? "text-muted-foreground line-through" : undefined}>
              {row.metric.replace(/ face$/, "")}
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

export async function MoneyServicesPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("money_services", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const currency = projection?.currencyCode ?? null;
  const timeZone = projection?.timezone ?? null;
  const rows = projection?.rows ?? [];
  const today = rows.filter((row) => isToday(row.occurredAt, timeZone));
  const counted = (list: typeof rows) =>
    list
      .filter((row) => !["voided", "refunded"].includes(row.status))
      .reduce((sum, row) => sum + (parseMoney(row.metric) ?? 0), 0);
  const awaiting = controls.moneyServiceTransactions ?? [];
  // detail is "service · $amount".
  const awaitingCents = awaiting.reduce((sum, row) => sum + (parseMoney(row.detail?.split(" · ").pop()) ?? 0), 0);
  const settlements = controls.moneyServiceSettlements ?? [];
  const providers = controls.moneyServiceProviders ?? [];
  const exceptions = Number(projection?.metrics.find((metric) => metric.label === "Settlement exceptions")?.value ?? 0) || 0;

  const missing = [
    !providers.length && {
      label: "No active money service provider for this store",
      fix: (
        <ActionDisclosure label="Configure provider">
          <FormGrid
            action={configureMoneyServiceProviderAction}
            submit="Save provider"
          >
            <HiddenScope projection={projection!} returnPath={path} />
            <TextField label="Provider name" name="name" required />
            <TextField label="Code" name="code" required />
            <EnumField
              label="Service"
              name="serviceType"
              values={serviceValues}
            />
            <TextField
              label="Adapter key"
              name="adapterKey"
              defaultValue="manual_external"
              required
            />
            <TextField
              label="External agent reference"
              name="externalAgentReference"
            />
            <TextField label="Jurisdiction label" name="jurisdictionCode" />
            <TextField
              label="Credential reference"
              name="credentialReference"
              placeholder="env://MONEY_PROVIDER_KEY"
            />
          </FormGrid>
        </ActionDisclosure>
      ),
    },
    !(controls.registerSessions ?? []).length && {
      label: "No open register, needed for cash in or out",
      fix: (
        <Link href={`/dashboard/platform/tills${projection ? scopeQuery(projection) : ""}`} className={buttonClass}>
          Open a register
        </Link>
      ),
    },
  ].filter(Boolean) as Array<{ label: string; fix: ReactNode }>;

  return (
    <PlatformPage
      title="Money Services"
      showMetrics={false}
      state={!providers.length ? { tone: "warn", label: "Provider authorization required" } : undefined}
      {...state}
    >
      {projection ? (
        <>
          {missing.length ? <PrereqNotice title="Before recording a transaction" items={missing} /> : null}

          <ActionBar label="Money service actions">
            <ActionDisclosure label="Record transaction" primary>
              <FormGrid
                action={recordMoneyServiceTransactionAction}
                submit="Record confirmation"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Provider"
                  name="providerId"
                  options={controls.moneyServiceProviders ?? []}
                />
                <EnumField
                  label="Service"
                  name="serviceType"
                  values={serviceValues}
                />
                <SelectField
                  label="Employee"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <SelectField
                  label="Open register for cash"
                  name="registerSessionId"
                  options={controls.registerSessions ?? []}
                  required={false}
                />
                <TextField
                  label="External transaction reference"
                  name="externalTransactionReference"
                  required
                />
                <EnumField
                  label="Cash direction"
                  name="cashDirection"
                  values={[
                    { value: "in", label: "Cash in" },
                    { value: "out", label: "Cash out" },
                    { value: "none", label: "No cash" },
                  ]}
                />
                <TextField
                  label="Face amount (cents)"
                  name="faceAmountCents"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Fee (cents)"
                  name="feeCents"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                />
                <TextField
                  label="Cash amount (cents)"
                  name="cashAmountCents"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue="0"
                />
                <TextField
                  label="Provider settlement (signed cents)"
                  name="providerSettlementCents"
                  type="number"
                  step="1"
                  required
                />
                <TextField
                  label="Occurred at (ISO)"
                  name="occurredAt"
                  required
                />
              </FormGrid>
            </ActionDisclosure>
            <ActionDisclosure label="Void transaction">
              <FormGrid
                action={voidMoneyServiceTransactionAction}
                submit="Record void"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Confirmed transaction"
                  name="transactionId"
                  options={controls.moneyServiceTransactions ?? []}
                />
                <SelectField
                  label="Employee"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <TextField
                  label="External void reference"
                  name="externalVoidReference"
                  required
                />
              </FormGrid>
            </ActionDisclosure>
          </ActionBar>

          {rows.length || awaiting.length || exceptions ? (
            <CountBoxes
              items={[
                { label: "Face today", value: money(counted(today), currency), note: `${today.length} transactions` },
                { label: "Confirmed, awaiting settlement", value: money(awaitingCents, currency), note: `${awaiting.length} transactions` },
                {
                  label: "Settlement exceptions",
                  value: exceptions,
                  variance: exceptions ? -exceptions : 0,
                  note: exceptions ? "Variance to review" : "Balanced",
                },
              ]}
            />
          ) : null}

          <section className="min-w-0 space-y-2" aria-label="Pending settlement">
            <SectionTitle meta={settlements.length || undefined}>Pending settlement</SectionTitle>
            {settlements.length ? (
              <>
                <DataTable>
                  <thead>
                    <tr>
                      <Th>Settlement</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((settlement) => (
                      <Tr key={settlement.id}>
                        <Td className="font-mono tabular-nums">{settlement.label}</Td>
                        <Td>
                          <ToneText tone={/disput/i.test(settlement.detail ?? "") ? "danger" : "warn"}>
                            {settlement.detail || "In review"}
                          </ToneText>
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </DataTable>
                <ActionBar label="Settlement review">
                  <ActionDisclosure label="Approve settlement" primary>
                    <FormGrid
                      action={approveMoneyServiceSettlementAction}
                      submit="Approve settlement"
                    >
                      <HiddenScope projection={projection} returnPath={path} />
                      <SelectField
                        label="Settlement"
                        name="settlementId"
                        options={controls.moneyServiceSettlements ?? []}
                      />
                      <SelectField
                        label="Approver"
                        name="employeeId"
                        options={controls.employees ?? []}
                      />
                      <TextField label="Disposition notes" name="notes" />
                    </FormGrid>
                  </ActionDisclosure>
                </ActionBar>
              </>
            ) : (
              <QueueClear>No settlement waiting for review</QueueClear>
            )}
          </section>

          <section className="min-w-0 space-y-2" aria-label="Today's transactions">
            <SectionTitle meta={today.length || undefined}>Today&apos;s transactions</SectionTitle>
            {today.length ? (
              <TransactionTable rows={today} timeZone={timeZone} label="Today's transactions" />
            ) : (
              <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">No transactions today</p>
            )}
          </section>

          <Workbench
            scope="money-services"
            sections={[
              {
                id: "transactions",
                label: "All transactions",
                count: rows.length,
                content: rows.length ? (
                  <TransactionTable rows={rows} timeZone={timeZone} label="Externally confirmed transactions" />
                ) : (
                  <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">Nothing recorded yet</p>
                ),
              },
              {
                id: "settlement",
                label: "Settlement",
                content: (
                  <ActionBar label="Settlement actions">
                    <ActionDisclosure label="Generate provider settlement" primary>
                      <FormGrid
                        action={generateMoneyServiceSettlementAction}
                        submit="Generate settlement"
                      >
                        <HiddenScope projection={projection} returnPath={path} />
                        <SelectField
                          label="Provider"
                          name="providerId"
                          options={controls.moneyServiceProviders ?? []}
                        />
                        <TextField
                          label="Trading date"
                          name="tradingDate"
                          type="date"
                          required
                        />
                        <TextField
                          label="Period start (ISO)"
                          name="periodStartedAt"
                          required
                        />
                        <TextField
                          label="Period end (ISO)"
                          name="periodEndedAt"
                          required
                        />
                        <TextField
                          label="Reported settlement (signed cents)"
                          name="reportedSettlementCents"
                          type="number"
                          step="1"
                          required
                        />
                      </FormGrid>
                    </ActionDisclosure>
                  </ActionBar>
                ),
              },
              {
                id: "provider",
                label: "Provider",
                count: providers.length,
                content: (
                  <>
                    {providers.length ? (
                      <DataTable aria-label="Active providers">
                        <thead>
                          <tr>
                            <Th>Provider</Th>
                            <Th>Service · code</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {providers.map((provider) => (
                            <Tr key={provider.id}>
                              <Td>{provider.label}</Td>
                              <Td className="font-mono tabular-nums">{provider.detail}</Td>
                            </Tr>
                          ))}
                        </tbody>
                      </DataTable>
                    ) : null}
                    {providers.length ? (
                      <ActionBar label="Provider actions">
                        <ActionDisclosure label="Configure provider">
                          <FormGrid
                            action={configureMoneyServiceProviderAction}
                            submit="Save provider"
                          >
                            <HiddenScope projection={projection} returnPath={path} />
                            <TextField label="Provider name" name="name" required />
                            <TextField label="Code" name="code" required />
                            <EnumField
                              label="Service"
                              name="serviceType"
                              values={serviceValues}
                            />
                            <TextField
                              label="Adapter key"
                              name="adapterKey"
                              defaultValue="manual_external"
                              required
                            />
                            <TextField
                              label="External agent reference"
                              name="externalAgentReference"
                            />
                            <TextField label="Jurisdiction label" name="jurisdictionCode" />
                            <TextField
                              label="Credential reference"
                              name="credentialReference"
                              placeholder="env://MONEY_PROVIDER_KEY"
                            />
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
    </PlatformPage>
  );
}

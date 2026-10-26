import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import {
  approveStoreDayAction,
  generateStoreDayAction,
  prepareDepositAction,
  transitionDepositAction,
} from "../actions";
import {
  EmptyState,
  EnumField,
  FormGrid,
  HiddenScope,
  PlatformPage,
  SelectField,
  TextField,
} from "../components/PlatformPage";
import { CountBoxes, DataTable, SectionTitle, StatusText, Td, Th, Tr, statusLabel, type DotTone } from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { zonedNowInput } from "../lib/form-values";
import { getPlatformProjection, type PlatformProjection, type PlatformSearch } from "../lib/projection";
import { formatMoney } from "../lib/scope";
import { ActionBar, Disclosure, NoteLine, StateText, centsOf, signedMoney, varianceState } from "./ledger-ui";
import { QueueRow } from "./QueueRow";

const path = "/dashboard/platform/reconciliation";

type DayLine = {
  id: string;
  dimension: string;
  dimensionKey: string;
  label: string;
  expectedCents: number;
  actualCents: number;
  varianceCents: number;
  sourceCount: number;
};

type DayDetail = {
  id: string;
  tradingDate: string;
  status: string;
  currencyCode: string;
  expectedCashCents: number;
  countedCashCents: number;
  cashOverShortCents: number;
  depositedCashCents: number;
  undepositedCashCents: number;
  registerSessionCount: number;
  exceptionCount: number;
  lines: DayLine[];
};

/** The latest store day's ruled figures: per tender and per till. */
async function loadDay(id: string | undefined): Promise<DayDetail | null> {
  if (!id) return null;
  const response = await keystoneClient<{ storeDay: DayDetail | null }>(
    `query PlatformStoreDayCount($id: ID!) {
      storeDay(where: { id: $id }) {
        id tradingDate status currencyCode expectedCashCents countedCashCents cashOverShortCents
        depositedCashCents undepositedCashCents registerSessionCount exceptionCount
        lines(take: 500) { id dimension dimensionKey label expectedCents actualCents varianceCents sourceCount }
      }
    }`,
    { id },
  );
  return response.success ? response.data.storeDay : null;
}

/** Cash expected in the tills still open; the same read the Tills queue uses. */
async function loadOpenTills(storeId: string | null): Promise<{ count: number; expectedCents: number } | null> {
  if (!storeId) return null;
  const response = await keystoneClient<{ registerSessions: Array<{ expectedCashCents: number }> }>(
    `query PlatformReconOpenTills($where: RegisterSessionWhereInput!) {
      registerSessions(where: $where, take: 200) { expectedCashCents }
    }`,
    {
      where: {
        AND: [{ store: { id: { equals: storeId } } }, { status: { in: ["open", "closing", "suspended"] } }],
      },
    },
  );
  if (!response.success) return null;
  const sessions = response.data.registerSessions;
  return { count: sessions.length, expectedCents: sessions.reduce((sum, session) => sum + session.expectedCashCents, 0) };
}

const QUEUE_ORDER: Record<string, number> = { out_of_date: 0, reopened: 1, in_review: 2, reconciled: 3 };

export async function ReconciliationPage({ searchParams }: { searchParams: PlatformSearch }) {
  const state = await getPlatformProjection("reconciliation", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const rows = projection?.rows ?? [];
  const today = zonedNowInput(projection?.timezone).slice(0, 10);
  const latest = rows[0];
  const day = projection ? await loadDay(latest?.id) : null;
  const openTills = projection && !day ? await loadOpenTills(projection.storeId) : null;
  const money = (cents: number) => formatMoney(cents, day?.currencyCode || projection?.currencyCode);

  const todayRow = rows.find((row) => row.title === today);
  const variance = day?.cashOverShortCents ?? 0;
  const pageState: { tone: DotTone; label: string } | null = !projection
    ? null
    : !todayRow
      ? { tone: "warn", label: "Today not closed" }
      : todayRow.status === "out_of_date"
        ? { tone: "warn", label: "Today out of date" }
        : day && day.tradingDate === today && variance !== 0
          ? { tone: varianceState(variance).tone, label: `Today ${variance < 0 ? "short" : "over"} ${money(Math.abs(variance))}` }
          : { tone: "ok", label: `Today balanced · ${statusLabel(todayRow.status).toLowerCase()}` };

  return (
    <PlatformPage title="Reconciliation" {...state} showMetrics={false} state={pageState}>
      {projection ? (
        <>
          <ActionBar>
            <Disclosure label={todayRow ? "Regenerate store day" : "Generate store day"} title="Generate close package" primary>
              <GenerateForm projection={projection} />
            </Disclosure>
          </ActionBar>

          {day ? <DayCount day={day} today={today} money={money} /> : (
            <section className="min-w-0" aria-labelledby="day-count">
              <SectionTitle id="day-count" meta="No store day generated yet">
                <span className="font-mono tabular-nums">{today}</span>
              </SectionTitle>
              <CountBoxes
                items={[
                  {
                    label: "Expected",
                    value: openTills ? money(openTills.expectedCents) : "–",
                    note: openTills ? `${openTills.count} ${openTills.count === 1 ? "till" : "tills"} open` : undefined,
                  },
                  { label: "Counted", value: "–" },
                  { label: "Over / short", value: "–" },
                ]}
              />
            </section>
          )}

          <NeedsYou projection={projection} />

          <Workbench
            scope="reconciliation"
            sections={[
              {
                id: "close",
                label: "Store days",
                count: rows.length,
                content: <DayLedger rows={rows} timeZone={projection.timezone} money={money} />,
              },
              {
                id: "deposit",
                label: "Bank deposits",
                count: controls.bankDeposits?.length ?? 0,
                content: (
                  <>
                    <ActionBar>
                      <Disclosure label="Prepare deposit" title="Prepare bank deposit">
                        {controls.storeDays?.length ? (
                          <FormGrid action={prepareDepositAction} submit="Prepare deposit">
                            <HiddenScope projection={projection} returnPath={path} />
                            <SelectField label="Unlocked store day" name="storeDayId" options={controls.storeDays ?? []} />
                            <SelectField label="Prepared by" name="employeeId" options={controls.employees ?? []} />
                            <TextField label="Amount (cents)" name="amountCents" type="number" min="0" step="1" required />
                            <TextField label="Bag reference" name="bagReference" required />
                            <TextField label="Notes" name="notes" />
                          </FormGrid>
                        ) : (
                          <NoteLine>No unlocked store day to deposit</NoteLine>
                        )}
                      </Disclosure>
                    </ActionBar>
                    <DepositTable projection={projection} />
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

function GenerateForm({ projection }: { projection: PlatformProjection }) {
  const now = zonedNowInput(projection.timezone);
  return (
    <FormGrid action={generateStoreDayAction} submit="Generate close package">
      <HiddenScope projection={projection} returnPath={path} />
      <TextField label="Trading date" name="tradingDate" type="date" defaultValue={now.slice(0, 10)} required />
      <TextField label="Period start" name="periodStartedAt" defaultValue={`${now.slice(0, 10)}T00:00`} required />
      <TextField label="Period end" name="periodEndedAt" defaultValue={now} required />
    </FormGrid>
  );
}

/** Expected / counted / over-short per tender, then variance by till, short first. */
function DayCount({ day, today, money }: { day: DayDetail; today: string; money: (cents: number) => string }) {
  const tenders = day.lines.filter((line) => line.dimension === "tender" && line.dimensionKey !== "cash");
  const tills = day.lines
    .filter((line) => line.dimension === "register")
    .sort((left, right) => left.varianceCents - right.varianceCents);
  const tenderRows: Array<{ key: string; label: string; expected: number; counted: number; variance: number; note: string }> = [
    {
      key: "cash",
      label: "Cash",
      expected: day.expectedCashCents,
      counted: day.countedCashCents,
      variance: day.cashOverShortCents,
      note: `${day.registerSessionCount} ${day.registerSessionCount === 1 ? "till" : "tills"} counted`,
    },
    ...tenders.map((line) => ({
      key: line.id,
      label: line.label ? line.label[0].toUpperCase() + line.label.slice(1) : line.dimensionKey,
      expected: line.expectedCents,
      counted: line.actualCents,
      variance: line.varianceCents,
      note: `${line.sourceCount} ${line.sourceCount === 1 ? "tender" : "tenders"}`,
    })),
  ];
  return (
    <section className="min-w-0 space-y-5" aria-labelledby="day-count">
      <div className="min-w-0">
        <SectionTitle id="day-count" meta={day.tradingDate === today ? "Today" : "Latest closed day"}>
          <span className="inline-flex flex-wrap items-baseline gap-x-3">
            <span className="font-mono tabular-nums">{day.tradingDate}</span>
            <StatusText status={day.status} />
          </span>
        </SectionTitle>
        <div className="grid min-w-0 gap-3">
          {tenderRows.map((tender) => {
            const shown = varianceState(tender.variance);
            return (
              <div key={tender.key} className="grid min-w-0 gap-1.5 md:grid-cols-[8rem_minmax(0,1fr)] md:items-center md:gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-foreground">{tender.label}</p>
                  <p className="text-[12px] text-muted-foreground">{tender.note}</p>
                </div>
                <CountBoxes
                  items={[
                    { label: "Expected", value: money(tender.expected) },
                    { label: "Counted", value: money(tender.counted) },
                    {
                      label: "Over / short",
                      value: signedMoney(tender.variance, money),
                      variance: tender.variance,
                      note: shown.label,
                    },
                  ]}
                />
              </div>
            );
          })}
          {day.undepositedCashCents !== 0 || day.depositedCashCents !== 0 ? (
            <div className="grid min-w-0 gap-1.5 md:grid-cols-[8rem_minmax(0,1fr)] md:items-center md:gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-foreground">Bank deposit</p>
                <p className="text-[12px] text-muted-foreground">Counted cash to bank</p>
              </div>
              <CountBoxes
                items={[
                  { label: "Counted cash", value: money(day.countedCashCents) },
                  { label: "Deposited", value: money(day.depositedCashCents) },
                  {
                    label: "Not deposited",
                    value: money(day.undepositedCashCents),
                    note: day.undepositedCashCents > 0 ? "Still in the safe" : "All deposited",
                  },
                ]}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-w-0">
        <SectionTitle meta={tills.length || undefined}>Variance by till</SectionTitle>
        {tills.length ? (
          <DataTable aria-label="Variance by till">
            <thead>
              <tr>
                <Th>Till</Th>
                <Th>Status</Th>
                <Th align="right" priority={2}>Expected</Th>
                <Th align="right" priority={2}>Counted</Th>
                <Th align="right">Over / short</Th>
              </tr>
            </thead>
            <tbody>
              {tills.map((till) => {
                const shown = varianceState(till.varianceCents);
                return (
                  <Tr key={till.id}>
                    <Td className="font-medium">{till.label}</Td>
                    <Td><StateText tone={shown.tone} label={shown.label} /></Td>
                    <Td align="right" priority={2}>{money(till.expectedCents)}</Td>
                    <Td align="right" priority={2}>{money(till.actualCents)}</Td>
                    <Td
                      align="right"
                      className={till.varianceCents < 0 ? "text-[oklch(0.52_0.19_27)] dark:text-red-400" : till.varianceCents === 0 ? "text-emerald-700 dark:text-emerald-400" : ""}
                    >
                      {signedMoney(till.varianceCents, money)}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
        ) : (
          <NoteLine tone="muted">No closed till sessions in this store day.</NoteLine>
        )}
      </div>
    </section>
  );
}

/** Store days and deposits waiting on the manager, out of date and reopened first. */
function NeedsYou({ projection }: { projection: PlatformProjection }) {
  const controls = projection.controls;
  const statusById = new Map(projection.rows.map((row) => [row.id, row.status]));
  const outOfDate = projection.rows.filter((row) => row.status === "out_of_date");
  const days = [
    ...outOfDate.map((row) => ({ id: row.id, date: row.title, status: "out_of_date", detail: row.detail })),
    ...(controls.storeDays ?? [])
      .filter((option) => statusById.get(option.id) !== "out_of_date")
      .map((option) => {
        const row = projection.rows.find((entry) => entry.id === option.id);
        return { id: option.id, date: option.label, status: row?.status ?? "in_review", detail: row?.detail ?? "" };
      }),
  ].sort((left, right) => (QUEUE_ORDER[left.status] ?? 9) - (QUEUE_ORDER[right.status] ?? 9) || left.date.localeCompare(right.date));
  const deposits = controls.bankDeposits ?? [];
  const total = days.length + deposits.length;
  return (
    <section className="min-w-0" aria-labelledby="recon-queue">
      <SectionTitle id="recon-queue" meta={total || undefined}>Needs you</SectionTitle>
      {total ? (
        <DataTable aria-label="Needs you">
          <thead>
            <tr>
              <Th>Record</Th>
              <Th>Status</Th>
              <Th priority={2}>What</Th>
              <Th align="right"><span className="sr-only">Action</span></Th>
            </tr>
          </thead>
          <tbody>
            {days.map((entry) => (
              <QueueRow
                key={entry.id}
                colSpan={4}
                tone={entry.status === "out_of_date" ? "warn" : null}
                actionLabel={entry.status === "out_of_date" ? "Regenerate" : entry.status === "reconciled" ? "Lock" : "Approve"}
                cells={
                  <>
                    <Td className="font-mono tabular-nums">{entry.date}</Td>
                    <Td><StatusText status={entry.status} /></Td>
                    <Td priority={2} className="text-muted-foreground">
                      {entry.status === "out_of_date"
                        ? entry.detail
                        : entry.status === "reconciled"
                          ? "Approved, not locked"
                          : `Awaiting approval · ${entry.detail}`}
                    </Td>
                  </>
                }
              >
                {entry.status === "out_of_date" ? (
                  <GenerateFormFor projection={projection} tradingDate={entry.date} />
                ) : (
                  <FormGrid action={approveStoreDayAction} submit={entry.status === "reconciled" ? "Lock store day" : "Apply approval"}>
                    <HiddenScope projection={projection} returnPath={path} />
                    <input type="hidden" name="storeDayId" value={entry.id} />
                    <SelectField label="Approver" name="employeeId" options={controls.employees ?? []} />
                    <EnumField
                      label="Outcome"
                      name="lock"
                      defaultValue={entry.status === "reconciled" ? "true" : "false"}
                      values={[{ value: "false", label: "Approve" }, { value: "true", label: "Approve and lock" }]}
                    />
                    <TextField label="Review notes" name="notes" />
                  </FormGrid>
                )}
              </QueueRow>
            ))}
            {deposits.map((deposit) => (
              <QueueRow
                key={deposit.id}
                colSpan={4}
                actionLabel="Advance"
                cells={
                  <>
                    <Td className="font-mono tabular-nums">{deposit.label}</Td>
                    <Td><StatusText status={(deposit.detail ?? "prepared").toLowerCase().replaceAll(" ", "_")} /></Td>
                    <Td priority={2} className="text-muted-foreground">Bank deposit not verified</Td>
                  </>
                }
              >
                <AdvanceDepositForm projection={projection} depositId={deposit.id} />
              </QueueRow>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <NoteLine tone="ok">Nothing waiting: no store day to approve and no deposit in transit.</NoteLine>
      )}
    </section>
  );
}

function GenerateFormFor({ projection, tradingDate }: { projection: PlatformProjection; tradingDate: string }) {
  const now = zonedNowInput(projection.timezone);
  const isToday = now.slice(0, 10) === tradingDate;
  return (
    <FormGrid action={generateStoreDayAction} submit="Generate close package">
      <HiddenScope projection={projection} returnPath={path} />
      <TextField label="Trading date" name="tradingDate" type="date" defaultValue={tradingDate} required />
      <TextField label="Period start" name="periodStartedAt" defaultValue={`${tradingDate}T00:00`} required />
      <TextField label="Period end" name="periodEndedAt" defaultValue={isToday ? now : `${tradingDate}T23:59`} required />
    </FormGrid>
  );
}

function AdvanceDepositForm({ projection, depositId }: { projection: PlatformProjection; depositId: string }) {
  return (
    <FormGrid action={transitionDepositAction} submit="Advance deposit">
      <HiddenScope projection={projection} returnPath={path} />
      <input type="hidden" name="depositId" value={depositId} />
      <SelectField label="Employee" name="employeeId" options={projection.controls.employees ?? []} />
      <EnumField
        label="Next state"
        name="nextStatus"
        values={[
          { value: "in_transit", label: "In transit" },
          { value: "deposited", label: "Deposited" },
          { value: "verified", label: "Verified" },
          { value: "voided", label: "Void" },
        ]}
      />
      <TextField label="Bank reference" name="bankReference" />
      <TextField label="Notes" name="notes" />
    </FormGrid>
  );
}

function DayLedger({ rows, timeZone, money }: { rows: PlatformProjection["rows"]; timeZone: string | null; money: (cents: number) => string }) {
  if (!rows.length) return <EmptyState title="No store days yet" />;
  return (
    <DataTable aria-label="Store-day close history">
      <thead>
        <tr>
          <Th>Trading date</Th>
          <Th>Status</Th>
          <Th priority={2}>Detail</Th>
          <Th priority={3}>Generated</Th>
          <Th align="right">Net receipts</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <Tr key={row.id}>
            <Td className="font-mono tabular-nums">{row.title}</Td>
            <Td><StatusText status={row.status} /></Td>
            <Td priority={2} className="text-muted-foreground">{row.detail || "—"}</Td>
            <Td priority={3} className="whitespace-nowrap text-muted-foreground">
              {row.occurredAt ? (
                <time dateTime={row.occurredAt}>
                  {new Date(row.occurredAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short", timeZone: timeZone || "UTC" })}
                </time>
              ) : "—"}
            </Td>
            <Td align="right">{centsOf(row.metric) === null ? row.metric || "—" : money(centsOf(row.metric) ?? 0)}</Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );
}

function DepositTable({ projection }: { projection: PlatformProjection }) {
  const deposits = projection.controls.bankDeposits ?? [];
  if (!deposits.length) return <NoteLine tone="ok">No open bank deposits.</NoteLine>;
  return (
    <DataTable aria-label="Open bank deposits">
      <thead>
        <tr>
          <Th>Deposit</Th>
          <Th>Status</Th>
          <Th align="right"><span className="sr-only">Action</span></Th>
        </tr>
      </thead>
      <tbody>
        {deposits.map((deposit) => (
          <QueueRow
            key={deposit.id}
            colSpan={3}
            actionLabel="Advance"
            cells={
              <>
                <Td className="font-mono tabular-nums">{deposit.label}</Td>
                <Td><StatusText status={(deposit.detail ?? "prepared").toLowerCase().replaceAll(" ", "_")} /></Td>
              </>
            }
          >
            <AdvanceDepositForm projection={projection} depositId={deposit.id} />
          </QueueRow>
        ))}
      </tbody>
    </DataTable>
  );
}

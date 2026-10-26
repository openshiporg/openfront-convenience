import Link from "next/link";
import type { ReactNode } from "react";

import {
  activateLotteryPackAction,
  approveLotterySettlementAction,
  closeLotteryPackAction,
  configureLotteryGameAction,
  generateLotterySettlementAction,
  receiveLotteryPackAction,
  recordLotteryPackSaleAction,
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
  type DotTone,
} from "../components/cv-ui";
import { Workbench } from "../components/Workbench";
import { ActionBar, ActionDisclosure, PrereqNotice, QueueClear, ToneText, When, money, parseMoney } from "../fuel/ops-kit";
import { getPlatformProjection, type PlatformProjection, type PlatformSearch } from "../lib/projection";
import { scopeQuery } from "../lib/scope";

const path = "/dashboard/platform/lottery";

type Pack = {
  id: string;
  packNumber: string;
  game: string;
  sold: number | null;
  received: number | null;
  status: string;
  varianceCents: number;
  varianceText: string;
  updatedAt: string | null;
};

/** Pack rows carry "Game · sold/received sold" and "$x variance" (see the lottery projection). */
function toPack(row: PlatformProjection["rows"][number]): Pack {
  const match = /^(.*) · (\d+)\/(\d+) sold$/.exec(row.detail);
  return {
    id: row.id,
    packNumber: row.title,
    game: match?.[1] ?? row.detail,
    sold: match ? Number(match[2]) : null,
    received: match ? Number(match[3]) : null,
    status: row.status,
    varianceCents: parseMoney(row.metric) ?? 0,
    varianceText: row.metric.replace(/ variance$/, ""),
    updatedAt: row.occurredAt,
  };
}

const SELLING = ["activated", "in_sale"];
const varianceClass = (cents: number) =>
  cents < 0 ? "text-[oklch(0.52_0.19_27)] dark:text-red-400" : cents === 0 ? "text-muted-foreground" : undefined;

function PackTable({ packs, timeZone, label }: { packs: Pack[]; timeZone: string | null; label: string }) {
  return (
    <DataTable aria-label={label}>
      <thead>
        <tr>
          <Th>Pack</Th>
          <Th>Game</Th>
          <Th align="right">Sold</Th>
          <Th align="right" priority={2}>
            Left
          </Th>
          <Th>Status</Th>
          <Th align="right">Variance</Th>
          <Th priority={3}>Updated</Th>
        </tr>
      </thead>
      <tbody>
        {packs.map((pack) => (
          <Tr key={pack.id}>
            <Td className="font-mono tabular-nums">{pack.packNumber}</Td>
            <Td className="max-w-48 truncate">{pack.game}</Td>
            <Td align="right">{pack.sold === null ? "—" : `${pack.sold} / ${pack.received}`}</Td>
            <Td align="right" priority={2}>
              {pack.sold === null || pack.received === null ? "—" : pack.received - pack.sold}
            </Td>
            <Td>
              <StatusText status={pack.status} />
            </Td>
            <Td align="right" className={varianceClass(pack.varianceCents)}>
              {pack.varianceText}
            </Td>
            <Td priority={3}>
              <When value={pack.updatedAt} timeZone={timeZone} />
            </Td>
          </Tr>
        ))}
      </tbody>
    </DataTable>
  );
}

export async function LotteryPage({
  searchParams,
}: {
  searchParams: PlatformSearch;
}) {
  const state = await getPlatformProjection("lottery", searchParams);
  const projection = state.projection;
  const controls = projection?.controls ?? {};
  const currency = projection?.currencyCode ?? null;
  const timeZone = projection?.timezone ?? null;
  const packs = (projection?.rows ?? []).map(toPack);
  const selling = packs.filter((pack) => SELLING.includes(pack.status));
  const received = packs.filter((pack) => pack.status === "received");
  const custody = packs.filter((pack) => !["settled", "returned"].includes(pack.status));
  const games = controls.lotteryGames ?? [];
  const registers = controls.registerSessions ?? [];
  const settlements = controls.lotterySettlements ?? [];

  // A ticket sale posts only with an active game, an activated pack and an open register.
  const missing = [
    !games.length && {
      label: "No active lottery game",
      fix: (
        <ActionDisclosure label="Configure game">
          <FormGrid action={configureLotteryGameAction} submit="Save game">
            <HiddenScope projection={projection!} returnPath={path} />
            <TextField label="Game name" name="name" required />
            <TextField label="Game code" name="gameCode" required />
            <TextField
              label="Jurisdiction label"
              name="jurisdictionCode"
              required
            />
            <TextField label="Operator name" name="operatorName" required />
            <TextField
              label="Ticket price (cents)"
              name="ticketPriceCents"
              type="number"
              min="1"
              step="1"
              required
            />
            <TextField
              label="Tickets per pack"
              name="ticketsPerPack"
              type="number"
              min="1"
              step="1"
              required
            />
          </FormGrid>
        </ActionDisclosure>
      ),
    },
    games.length && !selling.length && {
      label: received.length ? "No pack activated for sale" : "No pack received",
      fix: <span className="text-[12px] text-muted-foreground">Use Receive pack or Activate pack below</span>,
    },
    !registers.length && {
      label: "No open register",
      fix: (
        <Link href={`/dashboard/platform/tills${projection ? scopeQuery(projection) : ""}`} className={buttonClass}>
          Open a register
        </Link>
      ),
    },
  ].filter(Boolean) as Array<{ label: string; fix: ReactNode }>;

  const soldTickets = selling.reduce((sum, pack) => sum + (pack.sold ?? 0), 0);
  const receivedTickets = selling.reduce((sum, pack) => sum + (pack.received ?? 0), 0);
  const varianceCents = custody.reduce((sum, pack) => sum + pack.varianceCents, 0);

  // Needs you: short packs first, then disputed and in-review settlements, then packs waiting to be activated.
  const queue: Array<{ id: string; ref: string; what: string; tone: DotTone; state: string; figure: string; rank: number }> = [
    ...custody
      .filter((pack) => pack.varianceCents !== 0)
      .map((pack) => ({
        id: pack.id,
        ref: pack.packNumber,
        what: pack.game,
        tone: (pack.varianceCents < 0 ? "danger" : "warn") as DotTone,
        state: pack.varianceCents < 0 ? "Short" : "Over",
        figure: pack.varianceText,
        rank: pack.varianceCents < 0 ? 0 : 1,
      })),
    ...settlements.map((settlement) => ({
      id: settlement.id,
      ref: settlement.label,
      what: "Daily settlement",
      tone: "warn" as DotTone,
      state: settlement.detail || "In review",
      figure: "",
      rank: /disput/i.test(settlement.detail ?? "") ? 1 : 2,
    })),
    ...received.map((pack) => ({
      id: pack.id,
      ref: pack.packNumber,
      what: pack.game,
      tone: "info" as DotTone,
      state: "Waiting to activate",
      figure: pack.received === null ? "" : `${pack.received} tickets`,
      rank: 3,
    })),
  ].sort((left, right) => left.rank - right.rank);

  return (
    <PlatformPage
      title="Lottery"
      showMetrics={false}
      state={missing.length ? { tone: "warn", label: "Merchant authorization required" } : undefined}
      {...state}
    >
      {projection ? (
        <>
          {missing.length ? (
            <PrereqNotice title="Ticket sales can't be recorded yet" items={missing} />
          ) : null}

          <ActionBar label="Lottery actions">
            <ActionDisclosure label="Record sold ticket range" primary>
              <FormGrid
                action={recordLotteryPackSaleAction}
                submit="Record range"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Activated pack"
                  name="packId"
                  options={controls.lotteryPacks ?? []}
                />
                <SelectField
                  label="Open register"
                  name="registerSessionId"
                  options={controls.registerSessions ?? []}
                />
                <SelectField
                  label="Employee"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <TextField
                  label="First ticket"
                  name="firstTicketNumber"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Last ticket"
                  name="lastTicketNumber"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Cash portion (cents)"
                  name="cashAmountCents"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Occurred at (optional ISO)"
                  name="occurredAt"
                />
              </FormGrid>
            </ActionDisclosure>
            <ActionDisclosure label="Receive pack">
              <FormGrid action={receiveLotteryPackAction} submit="Receive pack">
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Game"
                  name="gameId"
                  options={controls.lotteryGames ?? []}
                />
                <SelectField
                  label="Receiver"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <TextField label="Pack number" name="packNumber" required />
                <TextField
                  label="First ticket number"
                  name="firstTicketNumber"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
                <TextField
                  label="Last ticket number"
                  name="lastTicketNumber"
                  type="number"
                  min="0"
                  step="1"
                  required
                />
              </FormGrid>
            </ActionDisclosure>
            <ActionDisclosure label="Activate pack">
              <FormGrid
                action={activateLotteryPackAction}
                submit="Activate pack"
              >
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Received pack"
                  name="packId"
                  options={controls.lotteryPacks ?? []}
                />
                <SelectField
                  label="Employee"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
              </FormGrid>
            </ActionDisclosure>
            <ActionDisclosure label="Return or void remaining">
              <FormGrid action={closeLotteryPackAction} submit="Close pack">
                <HiddenScope projection={projection} returnPath={path} />
                <SelectField
                  label="Open pack"
                  name="packId"
                  options={controls.lotteryPacks ?? []}
                />
                <SelectField
                  label="Employee"
                  name="employeeId"
                  options={controls.employees ?? []}
                />
                <EnumField
                  label="Disposition"
                  name="disposition"
                  values={[
                    { value: "returned", label: "Returned to operator" },
                    { value: "void_remaining", label: "Void remaining range" },
                  ]}
                />
                <TextField label="Reason" name="reason" required />
              </FormGrid>
            </ActionDisclosure>
          </ActionBar>

          {selling.length || varianceCents !== 0 ? (
            <CountBoxes
              items={[
                { label: "Tickets sold, selling packs", value: soldTickets, note: `of ${receivedTickets} received` },
                { label: "Tickets left", value: receivedTickets - soldTickets },
                { label: "Sales vs cash, over / short", value: money(varianceCents, currency), variance: varianceCents },
              ]}
            />
          ) : null}

          <section className="min-w-0 space-y-2" aria-label="Needs you">
            <SectionTitle meta={queue.length || undefined}>Needs you</SectionTitle>
            {queue.length ? (
              <DataTable>
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th>Item</Th>
                    <Th>Status</Th>
                    <Th align="right" priority={2}>
                      Figure
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map((item) => (
                    <Tr key={`${item.rank}-${item.id}`}>
                      <Td className="font-mono tabular-nums">{item.ref}</Td>
                      <Td className="max-w-56 truncate">{item.what}</Td>
                      <Td>
                        <ToneText tone={item.tone}>{item.state}</ToneText>
                      </Td>
                      <Td align="right" priority={2} className={item.rank === 0 ? varianceClass(-1) : undefined}>
                        {item.figure || "—"}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <QueueClear>No short packs or settlements waiting</QueueClear>
            )}
          </section>

          <Workbench
            scope="lottery"
            sections={[
              {
                id: "sales",
                label: "Active packs",
                count: selling.length,
                content: selling.length ? (
                  <PackTable packs={selling} timeZone={timeZone} label="Active packs" />
                ) : (
                  <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">No packs on sale</p>
                ),
              },
              {
                id: "packs",
                label: "All packs",
                count: packs.length,
                content: packs.length ? (
                  <PackTable packs={packs} timeZone={timeZone} label="Pack custody and sales" />
                ) : (
                  <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">No packs received yet</p>
                ),
              },
              {
                id: "settlement",
                label: "Settlement",
                count: settlements.length,
                content: (
                  <ActionBar label="Settlement actions">
                    <ActionDisclosure label="Approve settlement" primary={settlements.length > 0}>
                      <FormGrid
                        action={approveLotterySettlementAction}
                        submit="Approve settlement"
                      >
                        <HiddenScope projection={projection} returnPath={path} />
                        <SelectField
                          label="Settlement"
                          name="settlementId"
                          options={controls.lotterySettlements ?? []}
                        />
                        <SelectField
                          label="Approver"
                          name="employeeId"
                          options={controls.employees ?? []}
                        />
                        <TextField label="Disposition notes" name="notes" />
                      </FormGrid>
                    </ActionDisclosure>
                    <ActionDisclosure label="Generate daily settlement" primary={!settlements.length}>
                      <FormGrid
                        action={generateLotterySettlementAction}
                        submit="Generate settlement"
                      >
                        <HiddenScope projection={projection} returnPath={path} />
                        <TextField
                          label="Trading date"
                          name="tradingDate"
                          type="date"
                          required
                        />
                        <TextField label="Operator name" name="operatorName" required />
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
                          label="Online sales (cents)"
                          name="onlineSalesCents"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue="0"
                        />
                        <TextField
                          label="Payouts (cents)"
                          name="payoutCents"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue="0"
                        />
                        <TextField
                          label="Commission (cents)"
                          name="commissionCents"
                          type="number"
                          min="0"
                          step="1"
                          defaultValue="0"
                        />
                        <TextField
                          label="Reported settlement (cents)"
                          name="reportedSettlementCents"
                          type="number"
                          min="0"
                          step="1"
                          required
                        />
                      </FormGrid>
                    </ActionDisclosure>
                  </ActionBar>
                ),
              },
              {
                id: "games",
                label: "Games",
                count: games.length,
                content: (
                  <>
                    {games.length ? (
                      <DataTable aria-label="Active games">
                        <thead>
                          <tr>
                            <Th>Game</Th>
                            <Th>Code</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {games.map((game) => (
                            <Tr key={game.id}>
                              <Td>{game.label}</Td>
                              <Td className="font-mono tabular-nums">{game.detail}</Td>
                            </Tr>
                          ))}
                        </tbody>
                      </DataTable>
                    ) : null}
                    {games.length ? (
                      <ActionBar label="Game actions">
                        <ActionDisclosure label="Configure game">
                          <FormGrid action={configureLotteryGameAction} submit="Save game">
                            <HiddenScope projection={projection} returnPath={path} />
                            <TextField label="Game name" name="name" required />
                            <TextField label="Game code" name="gameCode" required />
                            <TextField
                              label="Jurisdiction label"
                              name="jurisdictionCode"
                              required
                            />
                            <TextField label="Operator name" name="operatorName" required />
                            <TextField
                              label="Ticket price (cents)"
                              name="ticketPriceCents"
                              type="number"
                              min="1"
                              step="1"
                              required
                            />
                            <TextField
                              label="Tickets per pack"
                              name="ticketsPerPack"
                              type="number"
                              min="1"
                              step="1"
                              required
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

import Link from "next/link";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { CountBoxes, DataTable, SectionTitle, StatusText, Td, Th, Tr } from "../../components/cv-ui";
import { shortRef } from "../../lib/labels";
import { loadPlatformList } from "../../lib/list-query";
import { employeeName, type EmployeeRef } from "../../lib/people";
import type { PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";
import { LedgerListShell } from "../../sales/LedgerListShell";

const STATUSES = [
  { value: "open", label: "Open" },
  { value: "closing", label: "Closing" },
  { value: "suspended", label: "Suspended" },
  { value: "closed", label: "Closed" },
];

type SessionRow = {
  id: string;
  sessionNumber: string;
  status: string;
  openingCashCents: number;
  expectedCashCents: number;
  countedCashCents: number | null;
  overShortCents: number | null;
  openedAt: string | null;
  closedAt: string | null;
  salesCount: number;
  register: { name: string } | null;
  employee: EmployeeRef;
};

const SELECTION = `id sessionNumber status openingCashCents expectedCashCents countedCashCents overShortCents openedAt closedAt salesCount
      register { name }
      employee { employeeNumber user { name } }`;

/** Short drawers first, then closing and suspended, then open ones; oldest first within each. */
function queueRank(session: SessionRow): number {
  if (session.status === "closed" && (session.overShortCents ?? 0) < 0) return 0;
  if (session.status === "closing") return 1;
  if (session.status === "suspended") return 2;
  return 3;
}

export async function TillListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const storeWhere = { store: { id: { equals: scope.storeId ?? "" } } };
  const [result, queueResponse] = await Promise.all([
    loadPlatformList<SessionRow>({
      path: "register-sessions",
      search,
      scopeWhere: storeWhere,
      statuses: STATUSES,
      selection: SELECTION,
    }),
    // The drawers that need the manager: every one still open, and closed drawers that came up short.
    scope.storeId
      ? keystoneClient<{ registerSessions: SessionRow[] }>(
          `query TillQueue($where: RegisterSessionWhereInput!) {
            registerSessions(where: $where, orderBy: { openedAt: asc }, take: 30) { ${SELECTION} }
          }`,
          {
            where: {
              AND: [
                storeWhere,
                {
                  OR: [
                    { status: { in: ["open", "closing", "suspended"] } },
                    { AND: [{ status: { equals: "closed" } }, { overShortCents: { lt: 0 } }] },
                  ],
                },
              ],
            },
          },
        )
      : Promise.resolve(null),
  ]);
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, scope.currencyCode);
  const q = scopeQuery(scope);
  const queue = (queueResponse?.success ? queueResponse.data.registerSessions : [])
    .slice()
    .sort((a, b) => queueRank(a) - queueRank(b));
  const loaded = Boolean(queueResponse?.success);
  const live = queue.filter((session) => session.status !== "closed");
  const expectedLive = live.reduce((sum, session) => sum + session.expectedCashCents, 0);
  const floatLive = live.reduce((sum, session) => sum + session.openingCashCents, 0);
  const shortClosed = queue.filter((session) => session.status === "closed");
  const shortTotal = shortClosed.reduce((sum, session) => sum + (session.overShortCents ?? 0), 0);
  const countedClosed = shortClosed.filter((session) => session.countedCashCents != null);
  const countedTotal = countedClosed.reduce((sum, session) => sum + (session.countedCashCents ?? 0), 0);

  const lead = (
    <>
      <CountBoxes
        items={[
          { label: "Drawers open", value: loaded ? live.length : "–" },
          { label: "Opening floats", value: loaded ? money(floatLive) : "–" },
          { label: "Expected in drawers", value: loaded ? money(expectedLive) : "–" },
          {
            label: "Counted",
            value: countedClosed.length ? money(countedTotal) : "–",
          },
          {
            label: "Over / short",
            value: shortClosed.length ? `−${money(Math.abs(shortTotal))}` : "–",
            variance: shortClosed.length ? shortTotal : null,
            note: shortClosed.length ? `${shortClosed.length} short ${shortClosed.length === 1 ? "close" : "closes"}` : undefined,
          },
        ]}
      />
      <section aria-labelledby="till-queue" className="min-w-0">
        <SectionTitle id="till-queue" meta={queue.length || undefined}>
          Needs you
        </SectionTitle>
        {queue.length ? (
          <SessionTable sessions={queue} money={money} q={q} timeZone={scope.timezone} label="Drawers that need the manager" />
        ) : (
          <p className="py-2 text-sm text-muted-foreground">No open drawers and no short closes</p>
        )}
      </section>
    </>
  );

  return (
    <LedgerListShell
      title="Tills"
      scope={scope}
      basePath="/dashboard/platform/tills"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "till session", plural: "till sessions" }}
      empty="No till sessions"
      lead={lead}
    >
      <SessionTable sessions={result.items} money={money} q={q} timeZone={scope.timezone} label="Till sessions" />
    </LedgerListShell>
  );
}

function varianceText(session: SessionRow, money: (cents: number | null | undefined) => string) {
  if (session.status !== "closed" || session.overShortCents == null) return { text: "—", className: "text-muted-foreground" };
  const variance = session.overShortCents;
  if (variance === 0) return { text: "Balanced", className: "text-emerald-700 dark:text-emerald-400" };
  return variance < 0
    ? { text: `Short ${money(Math.abs(variance))}`, className: "text-[oklch(0.52_0.19_27)] dark:text-red-400" }
    : { text: `Over ${money(variance)}`, className: "text-foreground" };
}

function SessionTable({
  sessions,
  money,
  q,
  timeZone,
  label,
}: {
  sessions: SessionRow[];
  money: (cents: number | null | undefined) => string;
  q: string;
  timeZone: string | null;
  label: string;
}) {
  return (
    <DataTable aria-label={label}>
      <thead>
        <tr>
          <Th>Register</Th>
          <Th priority={2}>Cashier</Th>
          <Th priority={3}>Opened</Th>
          <Th align="right" priority={3}>
            Sales
          </Th>
          <Th align="right" priority={2}>
            Expected
          </Th>
          <Th align="right" priority={2}>
            Counted
          </Th>
          <Th align="right">Variance</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {sessions.map((session) => {
          const variance = varianceText(session, money);
          return (
            <Tr key={session.id}>
              <Td className="max-sm:py-2.5">
                <Link
                  href={`/dashboard/platform/tills/${session.id}${q}`}
                  className="inline-flex min-h-6 flex-wrap items-baseline gap-x-2 font-medium text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring max-sm:min-h-10 max-sm:items-center"
                >
                  {session.register?.name ?? "Till"}
                  <span className="font-mono text-[12px] text-muted-foreground">{shortRef(session.sessionNumber)}</span>
                </Link>
              </Td>
              <Td priority={2} className="text-muted-foreground">
                {employeeName(session.employee)}
              </Td>
              <Td priority={3} className="whitespace-nowrap text-muted-foreground">
                {formatWhen(session.openedAt, timeZone)}
              </Td>
              <Td align="right" priority={3}>
                {session.salesCount}
              </Td>
              <Td align="right" priority={2}>
                {money(session.expectedCashCents)}
              </Td>
              <Td align="right" priority={2}>
                {session.countedCashCents == null ? <span className="text-muted-foreground">—</span> : money(session.countedCashCents)}
              </Td>
              <Td align="right" className={`whitespace-nowrap ${variance.className}`}>
                {variance.text}
              </Td>
              <Td>
                <StatusText status={session.status === "closed" && (session.overShortCents ?? 0) < 0 ? "closed_short" : session.status} />
              </Td>
            </Tr>
          );
        })}
      </tbody>
    </DataTable>
  );
}

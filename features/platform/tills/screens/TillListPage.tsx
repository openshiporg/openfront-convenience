import { ListRow, PlatformListShell } from "../../components/PlatformListShell";
import { shortRef } from "../../lib/labels";
import { loadPlatformList } from "../../lib/list-query";
import { employeeName, type EmployeeRef } from "../../lib/people";
import type { PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";

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

export async function TillListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const result = await loadPlatformList<SessionRow>({
    path: "register-sessions",
    search,
    scopeWhere: { store: { id: { equals: scope.storeId ?? "" } } },
    statuses: STATUSES,
    selection: `id sessionNumber status openingCashCents expectedCashCents countedCashCents overShortCents openedAt closedAt salesCount
      register { name }
      employee { employeeNumber user { name } }`,
  });
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, scope.currencyCode);
  return (
    <PlatformListShell
      title="Tills"
      scope={scope}
      basePath="/dashboard/platform/tills"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "till session", plural: "till sessions" }}
      empty="No till sessions"
    >
      {result.items.map((session) => {
        const variance = session.overShortCents ?? 0;
        return (
          <ListRow
            key={session.id}
            href={`/dashboard/platform/tills/${session.id}${scopeQuery(scope)}`}
            title={`${session.register?.name ?? "Till"} · ${shortRef(session.sessionNumber)}`}
            status={session.status}
            meta={[
              employeeName(session.employee),
              `opened ${formatWhen(session.openedAt, scope.timezone)}`,
              session.closedAt ? `closed ${formatWhen(session.closedAt, scope.timezone)}` : null,
              `${session.salesCount} ${session.salesCount === 1 ? "sale" : "sales"}`,
            ]
              .filter(Boolean)
              .join(" · ")}
            figure={session.status === "closed" ? money(session.countedCashCents) : money(session.expectedCashCents)}
            figureMeta={
              session.status === "closed"
                ? variance === 0
                  ? "Balanced"
                  : `${variance > 0 ? "Over" : "Short"} ${money(Math.abs(variance))}`
                : "Expected in drawer"
            }
          />
        );
      })}
    </PlatformListShell>
  );
}

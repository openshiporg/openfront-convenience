import { ListRow, PlatformListShell } from "../../components/PlatformListShell";
import { loadPlatformList } from "../../lib/list-query";
import type { PlatformSearch } from "../../lib/projection";
import { formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "closed", label: "Closed" },
];

type AccountRow = {
  id: string;
  accountNumber: string;
  email: string;
  phone: string;
  status: string;
  tier: string;
  pointsBalance: number;
  lifetimePoints: number;
  lastVisitAt: string | null;
  user: { name: string } | null;
  program: { name: string } | null;
};

export async function CustomerListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const result = await loadPlatformList<AccountRow>({
    path: "loyalty-accounts",
    search,
    scopeWhere: { business: { id: { equals: scope.businessId ?? "" } } },
    statuses: STATUSES,
    selection: `id accountNumber email phone status tier pointsBalance lifetimePoints lastVisitAt user { name } program { name }`,
  });
  return (
    <PlatformListShell
      title="Customers"
      scope={scope}
      basePath="/dashboard/platform/customers"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "member", plural: "members" }}
      empty="No loyalty members"
    >
      {result.items.map((account) => (
        <ListRow
          key={account.id}
          href={`/dashboard/platform/customers/${account.id}${scopeQuery(scope)}`}
          title={account.user?.name || account.email || account.phone || account.accountNumber}
          status={account.status}
          meta={[
            account.accountNumber,
            account.tier || null,
            account.email || null,
            account.phone || null,
            account.lastVisitAt ? `last visit ${formatWhen(account.lastVisitAt, scope.timezone)}` : "no visits yet",
          ]
            .filter(Boolean)
            .join(" · ")}
          figure={`${account.pointsBalance ?? 0} pts`}
          figureMeta={`${account.lifetimePoints ?? 0} lifetime`}
        />
      ))}
    </PlatformListShell>
  );
}

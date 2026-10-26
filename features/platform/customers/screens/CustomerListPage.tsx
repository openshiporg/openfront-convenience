import Link from "next/link";

import { PlatformListShell } from "../../components/PlatformListShell";
import { StatusText, Td, Th, Tr, statusLabel } from "../../components/cv-ui";
import { BareTable } from "../../reconciliation/ledger-ui";
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
      <BareTable label="Loyalty members">
        <thead>
          <tr>
            <Th>Member</Th>
            <Th>Status</Th>
            <Th priority={2}>Account</Th>
            <Th priority={3}>Tier</Th>
            <Th priority={3}>Contact</Th>
            <Th priority={2}>Last visit</Th>
            <Th align="right">Points</Th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((account) => (
            <Tr key={account.id} className="relative">
              <Td className="font-medium">
                <Link
                  href={`/dashboard/platform/customers/${account.id}${scopeQuery(scope)}`}
                  className="[overflow-wrap:anywhere] after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {account.user?.name || account.email || account.phone || account.accountNumber}
                </Link>
              </Td>
              <Td><StatusText status={account.status} /></Td>
              <Td priority={2} className="font-mono text-[12px] text-muted-foreground">{account.accountNumber}</Td>
              <Td priority={3} className="text-muted-foreground">{account.tier ? statusLabel(account.tier) : "—"}</Td>
              <Td priority={3} className="text-muted-foreground [overflow-wrap:anywhere]">{account.email || account.phone || "—"}</Td>
              <Td priority={2} className="whitespace-nowrap text-muted-foreground">
                {account.lastVisitAt ? formatWhen(account.lastVisitAt, scope.timezone) : "No visits yet"}
              </Td>
              <Td align="right">
                {account.pointsBalance ?? 0}
                <span className="block text-[12px] text-muted-foreground">{account.lifetimePoints ?? 0} lifetime</span>
              </Td>
            </Tr>
          ))}
        </tbody>
      </BareTable>
    </PlatformListShell>
  );
}

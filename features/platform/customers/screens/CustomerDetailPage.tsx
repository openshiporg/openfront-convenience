import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { adjustLoyaltyAction } from "../../actions";
import { BandRow, DetailSection, FactList, PlatformDetailShell } from "../../components/PlatformDetailShell";
import { ActionPanel, FormGrid, HiddenScope, SelectField, TextField } from "../../components/PlatformPage";
import { ListBand, statusLabel } from "../../components/cv-ui";
import { shortRef } from "../../lib/labels";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { getStoreOptions } from "../../lib/store-options";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";

type Account = {
  id: string;
  accountNumber: string;
  email: string;
  phone: string;
  status: string;
  tier: string;
  pointsBalance: number;
  lifetimePoints: number;
  marketingOptIn: boolean;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
  user: { name: string; email: string } | null;
  program: { name: string; pointsPerDollar: string; redemptionPoints: number; redemptionValueCents: number } | null;
  entries: Array<{ id: string; type: string; pointsDelta: number; balanceAfter: number; description: string; occurredAt: string | null; sale: { id: string; receiptNumber: string } | null }>;
};

export async function CustomerDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PlatformSearch }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const scope = await getPlatformScope(search);
  const [response, options] = await Promise.all([
    keystoneClient<{ loyaltyAccount: Account | null; sales: Array<{ id: string; receiptNumber: string; status: string; totalCents: number; currencyCode: string; completedAt: string | null }> }>(
      `query PlatformCustomer($id: ID!) {
        loyaltyAccount(where: { id: $id }) {
          id accountNumber email phone status tier pointsBalance lifetimePoints marketingOptIn firstVisitAt lastVisitAt
          user { name email }
          program { name pointsPerDollar redemptionPoints redemptionValueCents }
          entries(orderBy: { occurredAt: desc }, take: 50) { id type pointsDelta balanceAfter description occurredAt sale { id receiptNumber } }
        }
        sales(where: { loyaltyAccount: { id: { equals: $id } } }, orderBy: { completedAt: desc }, take: 20) { id receiptNumber status totalCents currencyCode completedAt }
      }`,
      { id },
    ),
    getStoreOptions(scope),
  ]);
  if (!response.success || !response.data.loyaltyAccount) notFound();
  const account = response.data.loyaltyAccount;
  const path = `/dashboard/platform/customers/${account.id}`;
  const q = scopeQuery(scope);
  const name = account.user?.name || account.email || account.phone || account.accountNumber;
  return (
    <PlatformDetailShell
      section="Customers"
      sectionHref={`/dashboard/platform/customers${q}`}
      title={name}
      status={account.status}
      meta={[account.accountNumber, account.email, account.phone].filter(Boolean).join(" · ")}
      notice={searchValue(search, "notice")}
      error={searchValue(search, "error")}
      aside={
        <ActionPanel title="Adjust points">
          <FormGrid action={adjustLoyaltyAction} submit="Adjust">
            <HiddenScope projection={scope} returnPath={path} />
            <input type="hidden" name="accountId" value={account.id} />
            <SelectField label="Employee" name="employeeId" options={options.employees} defaultValue={options.employees[0]?.id} />
            <TextField label="Points (+ or −)" name="pointsDelta" type="number" step="1" required />
            <TextField label="Reason" name="description" required />
          </FormGrid>
        </ActionPanel>
      }
    >
      <FactList
        facts={[
          ["Balance", `${account.pointsBalance ?? 0} pts`],
          ["Lifetime", `${account.lifetimePoints ?? 0} pts`],
          ["Program", account.program?.name ?? "—"],
          ["Redeems", account.program ? `${account.program.redemptionPoints} pts = ${formatMoney(account.program.redemptionValueCents, scope.currencyCode)}` : "—"],
          ["Marketing", account.marketingOptIn ? "Opted in" : "Opted out"],
          ["Member since", formatWhen(account.firstVisitAt, scope.timezone)],
        ]}
      />
      <DetailSection title="Points activity" meta={account.entries.length}>
        {account.entries.length ? (
          <ListBand>
            {account.entries.map((entry) => (
              <BandRow
                key={entry.id}
                title={statusLabel(entry.type)}
                meta={[formatWhen(entry.occurredAt, scope.timezone), entry.description || null, entry.sale ? shortRef(entry.sale.receiptNumber) : null].filter(Boolean).join(" · ")}
                figure={`${entry.pointsDelta > 0 ? "+" : ""}${entry.pointsDelta} → ${entry.balanceAfter}`}
              />
            ))}
          </ListBand>
        ) : (
          <p className="text-sm text-muted-foreground">No points activity</p>
        )}
      </DetailSection>
      <DetailSection title="Purchases" meta={response.data.sales.length}>
        {response.data.sales.length ? (
          <ListBand>
            {response.data.sales.map((sale) => (
              <Link key={sale.id} href={`/dashboard/platform/sales/${sale.id}${q}`} className="block hover:bg-background">
                <BandRow title={shortRef(sale.receiptNumber)} status={sale.status} meta={formatWhen(sale.completedAt, scope.timezone)} figure={formatMoney(sale.totalCents, sale.currencyCode)} />
              </Link>
            ))}
          </ListBand>
        ) : (
          <p className="text-sm text-muted-foreground">No purchases</p>
        )}
      </DetailSection>
    </PlatformDetailShell>
  );
}

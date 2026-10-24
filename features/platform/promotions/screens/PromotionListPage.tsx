import { ListRow, PlatformListShell } from "../../components/PlatformListShell";
import { loadPlatformList } from "../../lib/list-query";
import type { PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Draft" },
  { value: "paused", label: "Paused" },
  { value: "expired", label: "Expired" },
  { value: "archived", label: "Archived" },
];

type PromotionRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  stackable: boolean;
  usageLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  redemptionsCount: number;
  rules: Array<{ ruleType: string; benefitMethod: string; valueBasisPoints: number | null; valueCents: number | null }>;
};

/** "15% off", "$1.00 off", "$2.99 each", "free item". */
export function benefitText(rule: PromotionRow["rules"][number] | undefined, currency: string | null): string {
  if (!rule) return "No rule";
  switch (rule.benefitMethod) {
    case "percentage":
      return `${(rule.valueBasisPoints ?? 0) / 100}% off`;
    case "fixed_amount":
      return `${formatMoney(rule.valueCents ?? 0, currency)} off`;
    case "fixed_price":
      return `${formatMoney(rule.valueCents ?? 0, currency)} each`;
    default:
      return "Free item";
  }
}

export async function PromotionListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const result = await loadPlatformList<PromotionRow>({
    path: "promotions",
    search,
    scopeWhere: { business: { id: { equals: scope.businessId ?? "" } } },
    statuses: STATUSES,
    selection: `id name code status stackable usageLimit startsAt endsAt redemptionsCount
      rules(take: 1, orderBy: { priority: asc }) { ruleType benefitMethod valueBasisPoints valueCents }`,
  });
  return (
    <PlatformListShell
      title="Promotions"
      scope={scope}
      basePath="/dashboard/platform/promotions"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "promotion", plural: "promotions" }}
      empty="No promotions"
    >
      {result.items.map((promotion) => (
        <ListRow
          key={promotion.id}
          href={`/dashboard/platform/pricing${scopeQuery(scope)}#promotions`}
          title={promotion.name}
          status={promotion.status}
          meta={[
            benefitText(promotion.rules[0], scope.currencyCode),
            promotion.rules[0] ? promotion.rules[0].ruleType.replaceAll("_", " ") : null,
            promotion.code ? `code ${promotion.code}` : null,
            `${formatWhen(promotion.startsAt, scope.timezone)}${promotion.endsAt ? ` – ${formatWhen(promotion.endsAt, scope.timezone)}` : ""}`,
            promotion.stackable ? "stackable" : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          figure={`${promotion.redemptionsCount} used`}
          figureMeta={promotion.usageLimit ? `limit ${promotion.usageLimit}` : undefined}
        />
      ))}
    </PlatformListShell>
  );
}

import Link from "next/link";

import { DataTable, SectionTitle, StatusText, Td, Th, Tr, type DotTone } from "../../components/cv-ui";
import { QueueClear, ToneText } from "../../fuel/ops-kit";
import { loadPlatformList } from "../../lib/list-query";
import type { PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";
import { PromotionListShell } from "../PromotionListShell";

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

const DAY = 86_400_000;

/** What on an active or scheduled promotion needs the manager, worst first; null when nothing does. */
function attention(promotion: PromotionRow, now: number): { tone: DotTone; label: string; rank: number } | null {
  const ends = promotion.endsAt ? Date.parse(promotion.endsAt) : null;
  const starts = promotion.startsAt ? Date.parse(promotion.startsAt) : null;
  const limit = promotion.usageLimit;
  if (promotion.status === "active") {
    if (limit && promotion.redemptionsCount >= limit) return { tone: "danger", label: "Usage limit reached", rank: 0 };
    if (ends !== null && ends <= now) return { tone: "warn", label: "Past end date", rank: 1 };
    if (limit && promotion.redemptionsCount >= limit * 0.9) return { tone: "warn", label: "Near usage limit", rank: 2 };
    if (ends !== null && ends - now <= 3 * DAY) return { tone: "info", label: "Ends within 3 days", rank: 3 };
  }
  if (promotion.status === "scheduled" && starts !== null && starts <= now && (ends === null || ends > now)) {
    return { tone: "warn", label: "Start time passed, not active", rank: 1 };
  }
  return null;
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
  const href = `/dashboard/platform/pricing${scopeQuery(scope)}#promotions`;
  const now = Date.now();
  const queue = result.items
    .map((promotion) => ({ promotion, flag: attention(promotion, now) }))
    .filter((entry): entry is { promotion: PromotionRow; flag: NonNullable<ReturnType<typeof attention>> } => Boolean(entry.flag))
    .sort((left, right) => left.flag.rank - right.flag.rank);
  const windowText = (promotion: PromotionRow) =>
    `${formatWhen(promotion.startsAt, scope.timezone)}${promotion.endsAt ? ` – ${formatWhen(promotion.endsAt, scope.timezone)}` : ""}`;

  const lead = result.error ? null : (
    <section className="min-w-0 space-y-2" aria-label="Needs you">
      <SectionTitle meta={queue.length || undefined}>Needs you</SectionTitle>
      {queue.length ? (
        <DataTable>
          <thead>
            <tr>
              <Th>Promotion</Th>
              <Th>Status</Th>
              <Th align="right">Used</Th>
              <Th priority={2}>Window</Th>
            </tr>
          </thead>
          <tbody>
            {queue.map(({ promotion, flag }) => (
              <Tr key={promotion.id}>
                <Td>
                  <Link href={href} className="font-medium text-foreground underline-offset-4 hover:underline">
                    {promotion.name}
                  </Link>
                </Td>
                <Td>
                  <ToneText tone={flag.tone}>{flag.label}</ToneText>
                </Td>
                <Td align="right">
                  {promotion.redemptionsCount}
                  {promotion.usageLimit ? ` / ${promotion.usageLimit}` : ""}
                </Td>
                <Td priority={2} className="whitespace-nowrap text-muted-foreground">
                  {windowText(promotion)}
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <QueueClear>No promotion on this page is past its end, at its limit or stuck before start</QueueClear>
      )}
    </section>
  );

  return (
    <PromotionListShell
      title="Promotions"
      scope={scope}
      basePath="/dashboard/platform/promotions"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "promotion", plural: "promotions" }}
      empty="No promotions"
      lead={lead}
    >
      <DataTable aria-label="Promotions">
        <thead>
          <tr>
            <Th>Promotion</Th>
            <Th priority={2}>Code</Th>
            <Th>Benefit</Th>
            <Th priority={3}>Rule</Th>
            <Th priority={3}>Window</Th>
            <Th>Status</Th>
            <Th align="right">Used</Th>
            <Th align="right" priority={2}>
              Limit
            </Th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((promotion) => (
            <Tr key={promotion.id}>
              <Td>
                <Link href={href} className="font-medium text-foreground underline-offset-4 hover:underline">
                  {promotion.name}
                </Link>
                {promotion.stackable ? <span className="ml-2 text-[12px] text-muted-foreground">Stackable</span> : null}
              </Td>
              <Td priority={2} className="font-mono tabular-nums text-muted-foreground">
                {promotion.code || "—"}
              </Td>
              <Td className="whitespace-nowrap">{benefitText(promotion.rules[0], scope.currencyCode)}</Td>
              <Td priority={3} className="text-muted-foreground">
                {promotion.rules[0] ? promotion.rules[0].ruleType.replaceAll("_", " ") : "—"}
              </Td>
              <Td priority={3} className="whitespace-nowrap text-muted-foreground">
                {windowText(promotion)}
              </Td>
              <Td>
                <StatusText status={promotion.status} />
              </Td>
              <Td align="right">{promotion.redemptionsCount}</Td>
              <Td align="right" priority={2}>
                {promotion.usageLimit ?? "—"}
              </Td>
            </Tr>
          ))}
        </tbody>
      </DataTable>
    </PromotionListShell>
  );
}

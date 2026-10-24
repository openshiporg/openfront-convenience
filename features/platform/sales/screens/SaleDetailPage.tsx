import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { BandRow, DetailSection, FactList, PlatformDetailShell } from "../../components/PlatformDetailShell";
import { ListBand, pillClass, statusLabel, trackClass } from "../../components/cv-ui";
import { quantityText, shortRef } from "../../lib/labels";
import { employeeName, type EmployeeRef } from "../../lib/people";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";

type Sale = {
  id: string;
  receiptNumber: string;
  status: string;
  source: string;
  currencyCode: string;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  refundedCents: number;
  startedAt: string | null;
  completedAt: string | null;
  voidedAt: string | null;
  cashier: EmployeeRef;
  customer: { name: string; email: string } | null;
  loyaltyAccount: { id: string; accountNumber: string } | null;
  registerSession: { id: string; sessionNumber: string; register: { name: string } | null } | null;
  lines: Array<{ id: string; lineNumber: number; titleSnapshot: string; variantTitleSnapshot: string; skuSnapshot: string; quantity: string; unitPriceCents: number; discountCents: number; taxCents: number; totalCents: number; ageVerified: boolean; regulatedSaleType: string; product: { id: string } | null }>;
  tenders: Array<{ id: string; method: string; status: string; amountCents: number; tenderedCents: number | null; changeCents: number; refundedCents: number; cardBrand: string; processedAt: string | null }>;
  refunds: Array<{ id: string; refundNumber: string; status: string; reason: string; amountCents: number; processedAt: string | null; lines: Array<{ id: string; quantity: string; totalCents: number; saleLine: { titleSnapshot: string } | null }> }>;
  returns: Array<{ id: string; returnNumber: string; status: string; reason: string; lines: Array<{ id: string; quantity: string; disposition: string; condition: string; saleLine: { titleSnapshot: string } | null }> }>;
  ageVerifications: Array<{ id: string; verificationNumber: string; outcome: string; method: string; ageAtVerification: number | null; verifiedAt: string | null }>;
  promotionRedemptions: Array<{ id: string; amountCents: number; codeSnapshot: string; promotion: { name: string } | null }>;
};

export async function SaleDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PlatformSearch }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const scope = await getPlatformScope(search);
  const response = await keystoneClient<{ sale: Sale | null }>(
    `query PlatformSale($id: ID!) {
      sale(where: { id: $id }) {
        id receiptNumber status source currencyCode subtotalCents discountCents taxCents totalCents refundedCents startedAt completedAt voidedAt
        cashier { employeeNumber user { name } }
        customer { name email }
        loyaltyAccount { id accountNumber }
        registerSession { id sessionNumber register { name } }
        lines(orderBy: { lineNumber: asc }) { id lineNumber titleSnapshot variantTitleSnapshot skuSnapshot quantity unitPriceCents discountCents taxCents totalCents ageVerified regulatedSaleType product { id } }
        tenders { id method status amountCents tenderedCents changeCents refundedCents cardBrand processedAt }
        refunds(orderBy: { requestedAt: desc }) { id refundNumber status reason amountCents processedAt lines { id quantity totalCents saleLine { titleSnapshot } } }
        returns { id returnNumber status reason lines { id quantity disposition condition saleLine { titleSnapshot } } }
        ageVerifications { id verificationNumber outcome method ageAtVerification verifiedAt }
        promotionRedemptions { id amountCents codeSnapshot promotion { name } }
      }
    }`,
    { id },
  );
  if (!response.success || !response.data.sale) notFound();
  const sale = response.data.sale;
  const money = (cents: number | null | undefined) => formatMoney(cents ?? 0, sale.currencyCode);
  const q = scopeQuery(scope);
  return (
    <PlatformDetailShell
      section="Sales"
      sectionHref={`/dashboard/platform/sales${q}`}
      title={shortRef(sale.receiptNumber)}
      status={sale.status}
      meta={`${formatWhen(sale.completedAt ?? sale.startedAt, scope.timezone)} · ${employeeName(sale.cashier)} · ${sale.receiptNumber}`}
      notice={searchValue(search, "notice")}
      error={searchValue(search, "error")}
      aside={
        <section className="min-w-0 rounded-2xl bg-muted/45 p-1 ring-1 ring-inset ring-border/60" aria-label="Totals">
          <dl className="space-y-1 rounded-xl bg-background px-4 py-3 font-mono text-sm tabular-nums shadow-[0_1px_2px_rgb(0_0_0/0.1)] dark:bg-zinc-900">
            {[
              ["Subtotal", money(sale.subtotalCents)],
              ["Discount", sale.discountCents ? `−${money(sale.discountCents)}` : money(0)],
              ["Tax", money(sale.taxCents)],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 text-muted-foreground">
                <dt className="font-sans">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-dashed pt-2 text-base font-semibold">
              <dt className="font-sans">Total</dt>
              <dd>{money(sale.totalCents)}</dd>
            </div>
            {sale.refundedCents ? (
              <div className="flex justify-between gap-3 text-muted-foreground">
                <dt className="font-sans">Refunded</dt>
                <dd>−{money(sale.refundedCents)}</dd>
              </div>
            ) : null}
          </dl>
          <div className={`${trackClass} mt-1 w-full flex-wrap justify-center`}>
            <Link className={pillClass} href={`/dashboard/platform/pos/receipt/${sale.id}${q}`}>
              Receipt
            </Link>
            {["completed", "partially_refunded"].includes(sale.status) ? (
              <Link className={pillClass} href={`/dashboard/platform/pos${scopeQuery(scope, { refundHistorySearch: sale.receiptNumber, voidReceiptSearch: sale.receiptNumber })}#refunds`}>
                Refund or void
              </Link>
            ) : null}
          </div>
        </section>
      }
    >
      <FactList
        facts={[
          ["Till", sale.registerSession ? `${sale.registerSession.register?.name ?? "Till"} · ${shortRef(sale.registerSession.sessionNumber)}` : "—"],
          ["Customer", sale.customer ? `${sale.customer.name}` : "Walk-in"],
          ["Loyalty", sale.loyaltyAccount?.accountNumber ?? "None"],
          ["Source", statusLabel(sale.source)],
          ["Completed", formatWhen(sale.completedAt, scope.timezone)],
          ["Voided", sale.voidedAt ? formatWhen(sale.voidedAt, scope.timezone) : "No"],
        ]}
      />
      <DetailSection title="Items" meta={sale.lines.length}>
        <ListBand>
          {sale.lines.map((line) => (
            <BandRow
              key={line.id}
              title={line.product ? <Link className="hover:underline" href={`/dashboard/platform/products/${line.product.id}${q}`}>{line.titleSnapshot}</Link> : line.titleSnapshot}
              state={line.regulatedSaleType !== "none" ? { tone: line.ageVerified ? "ok" : "warn", label: line.ageVerified ? "ID checked" : "ID not recorded" } : null}
              meta={[
                line.variantTitleSnapshot,
                line.skuSnapshot,
                `${quantityText(line.quantity)} × ${money(line.unitPriceCents)}`,
                line.discountCents ? `−${money(line.discountCents)}` : null,
                line.taxCents ? `tax ${money(line.taxCents)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              figure={money(line.totalCents)}
            />
          ))}
        </ListBand>
      </DetailSection>
      <DetailSection title="Payments" meta={sale.tenders.length}>
        <ListBand>
          {sale.tenders.map((tender) => (
            <BandRow
              key={tender.id}
              title={statusLabel(tender.method)}
              status={tender.status}
              meta={[
                tender.cardBrand || null,
                tender.tenderedCents != null && tender.method === "cash" ? `tendered ${money(tender.tenderedCents)} · change ${money(tender.changeCents)}` : null,
                tender.refundedCents ? `${money(tender.refundedCents)} refunded` : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined}
              figure={money(tender.amountCents)}
            />
          ))}
        </ListBand>
      </DetailSection>
      {sale.refunds.length ? (
        <DetailSection title="Refunds" meta={sale.refunds.length}>
          <ListBand>
            {sale.refunds.map((refund) => (
              <BandRow
                key={refund.id}
                title={shortRef(refund.refundNumber)}
                status={refund.status}
                meta={`${statusLabel(refund.reason)} · ${formatWhen(refund.processedAt, scope.timezone)} · ${refund.lines.map((line) => `${quantityText(line.quantity)} × ${line.saleLine?.titleSnapshot ?? "item"}`).join(", ")}`}
                figure={money(refund.amountCents)}
              />
            ))}
          </ListBand>
        </DetailSection>
      ) : null}
      {sale.returns.length ? (
        <DetailSection title="Returns" meta={sale.returns.length}>
          <ListBand>
            {sale.returns.map((entry) => (
              <BandRow
                key={entry.id}
                title={shortRef(entry.returnNumber)}
                status={entry.status}
                meta={`${statusLabel(entry.reason)} · ${entry.lines.map((line) => `${quantityText(line.quantity)} × ${line.saleLine?.titleSnapshot ?? "item"} (${statusLabel(line.condition)}, ${statusLabel(line.disposition).toLowerCase()})`).join(", ")}`}
              />
            ))}
          </ListBand>
        </DetailSection>
      ) : null}
      {sale.ageVerifications.length ? (
        <DetailSection title="ID checks" meta={sale.ageVerifications.length}>
          <ListBand>
            {sale.ageVerifications.map((check) => (
              <BandRow
                key={check.id}
                title={check.verificationNumber}
                status={check.outcome}
                meta={`${statusLabel(check.method)}${check.ageAtVerification ? ` · age ${check.ageAtVerification}` : ""} · ${formatWhen(check.verifiedAt, scope.timezone)}`}
              />
            ))}
          </ListBand>
        </DetailSection>
      ) : null}
      {sale.promotionRedemptions.length ? (
        <DetailSection title="Promotions" meta={sale.promotionRedemptions.length}>
          <ListBand>
            {sale.promotionRedemptions.map((entry) => (
              <BandRow key={entry.id} title={entry.promotion?.name ?? "Promotion"} meta={entry.codeSnapshot || undefined} figure={`−${money(entry.amountCents)}`} />
            ))}
          </ListBand>
        </DetailSection>
      ) : null}
    </PlatformDetailShell>
  );
}

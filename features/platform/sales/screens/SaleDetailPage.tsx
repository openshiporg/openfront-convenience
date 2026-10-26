import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import type { ReactNode } from "react";

import { DetailSection, PlatformDetailShell } from "../../components/PlatformDetailShell";
import {
  DataTable,
  Dot,
  StatusText,
  Td,
  Th,
  Tr,
  buttonClass,
  primaryButtonClass,
  statusLabel,
  statusTone,
} from "../../components/cv-ui";
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
  const refundable = ["completed", "partially_refunded"].includes(sale.status);
  const receiptHref = `/dashboard/platform/pos/receipt/${sale.id}${q}`;
  const refundHref = `/dashboard/platform/pos${scopeQuery(scope, { refundHistorySearch: sale.receiptNumber, voidReceiptSearch: sale.receiptNumber })}#refunds`;
  const stateLabel =
    sale.status === "completed"
      ? `Completed · ${money(sale.totalCents)}`
      : sale.status === "partially_refunded"
        ? `Partly refunded · ${money(sale.refundedCents)} of ${money(sale.totalCents)}`
        : sale.status === "refunded"
          ? `Refunded · ${money(sale.refundedCents)}`
          : sale.status === "voided"
            ? "Voided"
            : sale.status === "open"
              ? "Open, not completed"
              : statusLabel(sale.status);
  return (
    <PlatformDetailShell
      section="Sales"
      sectionHref={`/dashboard/platform/sales${q}`}
      title={shortRef(sale.receiptNumber)}
      state={{ tone: statusTone(sale.status), label: stateLabel }}
      meta={
        <>
          {formatWhen(sale.completedAt ?? sale.startedAt, scope.timezone)} · {employeeName(sale.cashier)} ·{" "}
          <span className="font-mono text-[12px]">{sale.receiptNumber}</span>
        </>
      }
      notice={searchValue(search, "notice")}
      error={searchValue(search, "error")}
      aside={
        <section className="min-w-0 rounded-md border bg-background" aria-label="Totals">
          <dl className="space-y-1 px-4 py-3 font-mono text-[13px] tabular-nums">
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
            <div className="flex items-baseline justify-between gap-3 border-t border-dashed border-foreground/30 pt-2">
              <dt className="font-sans text-[13px] font-medium">Total</dt>
              <dd className="text-xl font-medium tracking-tight">{money(sale.totalCents)}</dd>
            </div>
            {sale.refundedCents ? (
              <div className="flex justify-between gap-3 text-[oklch(0.52_0.19_27)] dark:text-red-400">
                <dt className="font-sans">Refunded</dt>
                <dd>−{money(sale.refundedCents)}</dd>
              </div>
            ) : null}
          </dl>
          <div className="flex flex-wrap gap-2 border-t px-4 py-3">
            {refundable ? (
              <>
                <Link className={primaryButtonClass} href={refundHref}>
                  Refund or void
                </Link>
                <Link className={buttonClass} href={receiptHref}>
                  Receipt
                </Link>
              </>
            ) : (
              <Link className={primaryButtonClass} href={receiptHref}>
                Receipt
              </Link>
            )}
          </div>
        </section>
      }
    >
      <dl className="grid min-w-0 gap-x-8 text-[13px] sm:grid-cols-2">
        {(
          [
            ["Till", sale.registerSession ? (
              <Link className="hover:underline" href={`/dashboard/platform/tills/${sale.registerSession.id}${q}`}>
                {sale.registerSession.register?.name ?? "Till"} · <span className="font-mono text-[12px]">{shortRef(sale.registerSession.sessionNumber)}</span>
              </Link>
            ) : "—"],
            ["Customer", sale.customer ? sale.customer.name : "Walk-in"],
            ["Loyalty", sale.loyaltyAccount ? <span className="font-mono text-[12px]">{sale.loyaltyAccount.accountNumber}</span> : "None"],
            ["Source", statusLabel(sale.source)],
            ["Completed", formatWhen(sale.completedAt, scope.timezone)],
            ["Voided", sale.voidedAt ? formatWhen(sale.voidedAt, scope.timezone) : "No"],
          ] as Array<[string, ReactNode]>
        ).map(([label, value]) => (
          <div key={label} className="flex min-w-0 items-baseline justify-between gap-4 border-b py-2">
            <dt className="shrink-0 text-[12px] font-medium text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right text-foreground [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
      <DetailSection title="Items" meta={sale.lines.length}>
        <DataTable aria-label="Items">
          <thead>
            <tr>
              <Th>Item</Th>
              <Th priority={3}>SKU</Th>
              <Th align="right" priority={2}>
                Qty
              </Th>
              <Th align="right" priority={2}>
                Price
              </Th>
              <Th align="right" priority={3}>
                Discount
              </Th>
              <Th align="right" priority={3}>
                Tax
              </Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((line) => (
              <Tr key={line.id}>
                <Td>
                  <span className="font-medium">
                    {line.product ? (
                      <Link className="hover:underline" href={`/dashboard/platform/products/${line.product.id}${q}`}>
                        {line.titleSnapshot}
                      </Link>
                    ) : (
                      line.titleSnapshot
                    )}
                  </span>
                  {line.variantTitleSnapshot ? <span className="ml-1.5 text-muted-foreground">{line.variantTitleSnapshot}</span> : null}
                  <span className="text-muted-foreground md:hidden">
                    {" "}
                    · {quantityText(line.quantity)} × {money(line.unitPriceCents)}
                  </span>
                  {line.regulatedSaleType !== "none" ? (
                    <span className="mt-0.5 flex items-baseline gap-1.5 text-[12px] text-muted-foreground">
                      <Dot tone={line.ageVerified ? "ok" : "warn"} />
                      {line.ageVerified ? "ID checked" : "ID not recorded"}
                    </span>
                  ) : null}
                </Td>
                <Td priority={3} className="font-mono text-[12px] text-muted-foreground">
                  {line.skuSnapshot || "—"}
                </Td>
                <Td align="right" priority={2}>
                  {quantityText(line.quantity)}
                </Td>
                <Td align="right" priority={2}>
                  {money(line.unitPriceCents)}
                </Td>
                <Td align="right" priority={3}>
                  {line.discountCents ? `−${money(line.discountCents)}` : "—"}
                </Td>
                <Td align="right" priority={3}>
                  {line.taxCents ? money(line.taxCents) : "—"}
                </Td>
                <Td align="right">{money(line.totalCents)}</Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </DetailSection>
      <DetailSection title="Payments" meta={sale.tenders.length}>
        <DataTable aria-label="Payments">
          <thead>
            <tr>
              <Th>Method</Th>
              <Th priority={2}>Detail</Th>
              <Th align="right">Amount</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {sale.tenders.map((tender) => (
              <Tr key={tender.id}>
                <Td className="font-medium">{statusLabel(tender.method)}</Td>
                <Td priority={2} className="text-muted-foreground">
                  {[
                    tender.cardBrand || null,
                    tender.tenderedCents != null && tender.method === "cash" ? `tendered ${money(tender.tenderedCents)} · change ${money(tender.changeCents)}` : null,
                    tender.refundedCents ? `${money(tender.refundedCents)} refunded` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Td>
                <Td align="right">{money(tender.amountCents)}</Td>
                <Td>
                  <StatusText status={tender.status} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </DetailSection>
      {sale.refunds.length ? (
        <DetailSection title="Refunds" meta={sale.refunds.length}>
          <DataTable aria-label="Refunds">
            <thead>
              <tr>
                <Th>Refund</Th>
                <Th priority={2}>Reason</Th>
                <Th priority={3}>Lines</Th>
                <Th priority={2}>Processed</Th>
                <Th align="right">Amount</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {sale.refunds.map((refund) => (
                <Tr key={refund.id}>
                  <Td className="font-mono text-[12px]">{shortRef(refund.refundNumber)}</Td>
                  <Td priority={2}>{statusLabel(refund.reason)}</Td>
                  <Td priority={3} className="text-muted-foreground">
                    {refund.lines.map((line) => `${quantityText(line.quantity)} × ${line.saleLine?.titleSnapshot ?? "item"}`).join(", ")}
                  </Td>
                  <Td priority={2} className="whitespace-nowrap text-muted-foreground">
                    {formatWhen(refund.processedAt, scope.timezone)}
                  </Td>
                  <Td align="right">{money(refund.amountCents)}</Td>
                  <Td>
                    <StatusText status={refund.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </DetailSection>
      ) : null}
      {sale.returns.length ? (
        <DetailSection title="Returns" meta={sale.returns.length}>
          <DataTable aria-label="Returns">
            <thead>
              <tr>
                <Th>Return</Th>
                <Th priority={2}>Reason</Th>
                <Th>Lines</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {sale.returns.map((entry) => (
                <Tr key={entry.id}>
                  <Td className="font-mono text-[12px]">{shortRef(entry.returnNumber)}</Td>
                  <Td priority={2}>{statusLabel(entry.reason)}</Td>
                  <Td className="text-muted-foreground">
                    {entry.lines
                      .map((line) => `${quantityText(line.quantity)} × ${line.saleLine?.titleSnapshot ?? "item"} (${statusLabel(line.condition)}, ${statusLabel(line.disposition).toLowerCase()})`)
                      .join(", ")}
                  </Td>
                  <Td>
                    <StatusText status={entry.status} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </DetailSection>
      ) : null}
      {sale.ageVerifications.length ? (
        <DetailSection title="ID checks" meta={sale.ageVerifications.length}>
          <DataTable aria-label="ID checks">
            <thead>
              <tr>
                <Th>Check</Th>
                <Th priority={2}>Method</Th>
                <Th align="right" priority={2}>
                  Age
                </Th>
                <Th priority={3}>Verified</Th>
                <Th>Outcome</Th>
              </tr>
            </thead>
            <tbody>
              {sale.ageVerifications.map((check) => (
                <Tr key={check.id}>
                  <Td className="font-mono text-[12px]">{check.verificationNumber}</Td>
                  <Td priority={2}>{statusLabel(check.method)}</Td>
                  <Td align="right" priority={2}>
                    {check.ageAtVerification ?? "—"}
                  </Td>
                  <Td priority={3} className="whitespace-nowrap text-muted-foreground">
                    {formatWhen(check.verifiedAt, scope.timezone)}
                  </Td>
                  <Td>
                    <StatusText status={check.outcome} />
                  </Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </DetailSection>
      ) : null}
      {sale.promotionRedemptions.length ? (
        <DetailSection title="Promotions" meta={sale.promotionRedemptions.length}>
          <DataTable aria-label="Promotions">
            <thead>
              <tr>
                <Th>Promotion</Th>
                <Th priority={2}>Code</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {sale.promotionRedemptions.map((entry) => (
                <Tr key={entry.id}>
                  <Td>{entry.promotion?.name ?? "Promotion"}</Td>
                  <Td priority={2} className="font-mono text-[12px]">
                    {entry.codeSnapshot || "—"}
                  </Td>
                  <Td align="right">−{money(entry.amountCents)}</Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </DetailSection>
      ) : null}
    </PlatformDetailShell>
  );
}

import Link from "next/link";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { Dot, buttonClass } from "../components/cv-ui";
import { PrintReceiptButton } from "./PrintReceiptButton";

type Receipt = {
  receiptNumber: string;
  status: string;
  store: { name: string; code: string; timezone: string };
  cashier: { name: string | null; employeeNumber: string } | null;
  currencyCode: string;
  completedAt: string | null;
  voidedAt: string | null;
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
  refundedCents: number;
  paymentDetailsAvailable: boolean;
  lines: Array<{ lineNumber: number; description: string; sku: string; quantity: string; unitPriceCents: number; discountCents: number; taxRateBasisPoints: number; taxInclusive: boolean; taxCents: number; totalCents: number }>;
  tenders: Array<{ method: string; status: string; amountCents: number; tenderedCents: number | null; changeCents: number; cardBrand: string; cardLast4: string }>;
  refunds: Array<{ refundNumber: string; status: string; amountCents: number; processedAt: string | null; tenderAllocations: Array<{ method: string; amountCents: number; providerRefundId: string }> }>;
};

const money = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

export async function SaleReceiptRoute({ params, searchParams }: {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ businessId?: string; storeId?: string }>;
}) {
  const [{ saleId }, query] = await Promise.all([params, searchParams]);
  return <SaleReceiptPage saleId={saleId} businessId={query.businessId ?? ""} storeId={query.storeId ?? ""} />;
}

export async function SaleReceiptPage({ saleId, businessId, storeId }: { saleId: string; businessId: string; storeId: string }) {
  const response = await keystoneClient<{ posSaleReceipt: Receipt }>(`
    query OperationalReceipt($input: PosSaleReceiptInput!) { posSaleReceipt(input: $input) }
  `, { input: { businessId, storeId, saleId } });
  if (!response.success) {
    return <main className="mx-auto max-w-md p-6"><h1 className="flex items-baseline gap-2 text-xl font-semibold"><Dot tone="danger" />Receipt unavailable</h1><p className="mt-2 text-sm text-destructive">{response.error}</p></main>;
  }
  const receipt = response.data.posSaleReceipt;
  return (
    <main className="mx-auto max-w-md p-4 sm:p-8 print:max-w-none print:p-0">
      <div className="mb-5 flex items-center justify-between gap-3 print:hidden">
        <Link className={buttonClass} href={`/dashboard/platform/pos?businessId=${encodeURIComponent(businessId)}&storeId=${encodeURIComponent(storeId)}`}>Back to POS</Link>
        <PrintReceiptButton />
      </div>
      <article className="rounded-sm bg-white px-5 py-6 font-mono text-black shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_24px_rgb(0_0_0/0.08)] ring-1 ring-black/5 print:shadow-none print:ring-0" aria-labelledby="receipt-title">
        <header className="border-b border-dashed border-black/30 pb-4 text-center">
          <h1 id="receipt-title" className="font-sans text-lg font-bold uppercase tracking-[0.08em]">{receipt.store.name}</h1>
          <p className="text-sm">Receipt {receipt.receiptNumber}</p>
          <p className="text-xs">{receipt.completedAt ? new Date(receipt.completedAt).toLocaleString("en-US", { timeZone: receipt.store.timezone }) : "Not completed"} · {receipt.status}</p>
        </header>
        <div className="divide-y divide-dashed divide-black/20">
          {receipt.lines.map((line) => <div key={line.lineNumber} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
            <div><p className="font-medium">{line.description}</p><p className="text-xs">{line.quantity} × {money(line.unitPriceCents, receipt.currencyCode)} · SKU {line.sku || "—"}</p>{line.discountCents ? <p className="text-xs">Discount −{money(line.discountCents, receipt.currencyCode)}</p> : null}<p className="text-xs">Tax {line.taxInclusive ? "included" : "added"} · {line.taxRateBasisPoints / 100}% · {money(line.taxCents, receipt.currencyCode)}</p></div>
            <p className="font-medium tabular-nums">{money(line.totalCents, receipt.currencyCode)}</p>
          </div>)}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-1 border-t border-dashed border-black/30 pt-4 text-sm tabular-nums">
          <dt>Subtotal</dt><dd className="text-right">{money(receipt.subtotalCents, receipt.currencyCode)}</dd>
          <dt>Discount</dt><dd className="text-right">−{money(receipt.discountCents, receipt.currencyCode)}</dd>
          <dt>Tax</dt><dd className="text-right">{money(receipt.taxCents, receipt.currencyCode)}</dd>
          <dt className="pt-1 text-base font-bold">Total</dt><dd className="pt-1 text-right text-base font-bold">{money(receipt.totalCents, receipt.currencyCode)}</dd>
          {receipt.refundedCents ? <><dt>Refunded</dt><dd className="text-right">−{money(receipt.refundedCents, receipt.currencyCode)}</dd></> : null}
        </dl>
        <section className="mt-5 border-t border-dashed border-black/30 pt-4"><h2 className="text-xs font-semibold uppercase tracking-[0.12em]">Tenders</h2>{receipt.paymentDetailsAvailable ? receipt.tenders.map((tender, index) => <p key={`${tender.method}-${index}`} className="mt-1 text-sm">{tender.method.replaceAll("_", " ")} · {money(tender.amountCents, receipt.currencyCode)}{tender.tenderedCents != null ? ` · tendered ${money(tender.tenderedCents, receipt.currencyCode)} · change ${money(tender.changeCents, receipt.currencyCode)}` : ""} · {tender.status}</p>) : <p className="mt-1 text-xs text-muted-foreground">Payment details unavailable</p>}</section>
        {receipt.refunds.length ? <section className="mt-5 border-t border-dashed border-black/30 pt-4"><h2 className="text-xs font-semibold uppercase tracking-[0.12em]">Refunds</h2>{receipt.refunds.map((refund) => <p key={refund.refundNumber} className="mt-1 text-sm">{refund.refundNumber} · {money(refund.amountCents, receipt.currencyCode)} · {refund.status}{refund.processedAt ? ` · posted ${new Date(refund.processedAt).toLocaleString("en-US", { timeZone: receipt.store.timezone })}` : ""}{refund.tenderAllocations.map((allocation, index) => <span key={index} className="block text-xs">{allocation.method.replaceAll("_", " ")} · {money(allocation.amountCents, receipt.currencyCode)}{allocation.providerRefundId ? ` · ${allocation.providerRefundId}` : ""}</span>)}</p>)}</section> : null}
        <footer className="mt-6 border-t border-dashed border-black/30 pt-4 text-center text-xs uppercase tracking-[0.12em]">Cashier {receipt.cashier?.name || receipt.cashier?.employeeNumber || "—"}</footer>
      </article>
    </main>
  );
}

// One confirmation email per online pickup order, sent after the posting transaction has committed.
// The AuditEvent row is the dedupe record: its eventNumber is deterministic and unique, so a replay,
// the settle call and the signed webhook can never claim the same order twice. Status lives in metadata.
// Guests carry no email in this checkout, so only a signed-in customer (Sale.customer) is mailed;
// a guest order is recorded as skipped_no_recipient.

type Send = (order: any) => Promise<{ sent: boolean; error?: string }>;

export const CONFIRMATION_ACTION = "pickup.order.confirmation_email";

export function orderConfirmationConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_STORE_LINK);
}

export async function deliverOrderConfirmation(prisma: any, saleId: string, send?: Send) {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: { id: true, businessId: true, storeId: true, receiptNumber: true, currencyCode: true, totalCents: true, store: { select: { name: true } }, customer: { select: { email: true, name: true } },
        lines: { select: { titleSnapshot: true, variantTitleSnapshot: true, quantity: true, totalCents: true }, orderBy: { lineNumber: "asc" }, take: 100 } },
    });
    if (!sale) return;
    let audit: any;
    try {
      audit = await prisma.auditEvent.create({
        data: { businessId: sale.businessId, storeId: sale.storeId, eventNumber: `confirmation-email:${sale.id}`, action: CONFIRMATION_ACTION, resourceType: "Sale", resourceId: sale.id, result: "succeeded", actorType: "integration", occurredAt: new Date(), metadata: { status: "sending" } },
        select: { id: true },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") return; // already claimed
      throw error;
    }
    const mark = (status: string, error?: string) => prisma.auditEvent.update({ where: { id: audit.id }, data: { metadata: { status, ...(error ? { error: error.slice(0, 200) } : {}) } } });
    try {
      const email = sale.customer?.email;
      if (!email) { await mark("skipped_no_recipient"); return; }
      if (!orderConfirmationConfigured()) { await mark("skipped_not_configured"); return; }
      const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: sale.currencyCode || "USD" }).format((cents || 0) / 100);
      // Loaded lazily so the mail module never joins the keystone import graph at build time.
      const deliver = send || (await import("./orderMail")).sendOrderConfirmationEmail;
      const result = await deliver({
        to: email, storeName: sale.store?.name || "the store", orderNumber: sale.receiptNumber, name: sale.customer?.name || "there",
        lines: sale.lines.map((line: any) => ({ title: line.variantTitleSnapshot ? `${line.titleSnapshot} (${line.variantTitleSnapshot})` : line.titleSnapshot, quantity: String(line.quantity), total: money(line.totalCents) })),
        total: money(sale.totalCents),
        link: `${String(process.env.SMTP_STORE_LINK).replace(/\/$/, "")}/account/receipts/${encodeURIComponent(sale.id)}`,
      });
      await (result.sent ? mark("sent") : mark("failed", result.error || "send_failed"));
    } catch (error) {
      try { await mark("failed", error instanceof Error ? error.message : "send_failed"); } catch { /* the order is committed; bookkeeping must never surface */ }
    }
  } catch (error) {
    console.error("Order confirmation email bookkeeping failed:", error instanceof Error ? error.message : "unknown");
  }
}

/** Never throws; loaded lazily from the commit paths. */
export async function sendConfirmationAfterCommit(prisma: any, saleId: string) {
  try { await deliverOrderConfirmation(prisma, saleId); } catch { /* never fail the order */ }
}

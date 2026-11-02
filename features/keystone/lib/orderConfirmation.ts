// One confirmation email per online pickup order, sent after the posting transaction has committed.
// The AuditEvent row is the dedupe record: its eventNumber is deterministic and unique, so a replay,
// the settle call and the signed webhook can never claim the same order twice. Status lives in metadata.
// Recipient: the signed-in customer's email, else the guest's optional "Email for receipt" kept on
// Cart.metadata.receiptEmail (no account, no link to one). With neither, skipped_no_recipient.

type Send = (order: any) => Promise<{ sent: boolean; error?: string; messageId?: string; response?: string }>;

export const CONFIRMATION_ACTION = "pickup.order.confirmation_email";

export function orderConfirmationConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_STORE_LINK);
}

export async function deliverOrderConfirmation(prisma: any, saleId: string, proof?: { cartId: string; token: string } | null, send?: Send) {
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
    const mark = (status: string, error?: string, messageId?: string, response?: string) => prisma.auditEvent.update({ where: { id: audit.id }, data: { metadata: { status, ...(messageId ? { messageId: messageId.slice(0, 200) } : {}), ...(response ? { smtpResponse: response.slice(0, 300) } : {}), ...(error ? { error: error.slice(0, 200) } : {}) } } });
    try {
      const cart = await prisma.cart.findFirst({ where: { saleId: sale.id }, select: { id: true, metadata: true } });
      const guestEmail = (cart?.metadata as { receiptEmail?: unknown } | null)?.receiptEmail;
      const email = sale.customer?.email || (typeof guestEmail === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail) ? guestEmail : "");
      if (!email) { await mark("skipped_no_recipient"); return; }
      if (!orderConfirmationConfigured()) { await mark("skipped_not_configured"); return; }
      const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: sale.currencyCode || "USD" }).format((cents || 0) / 100);
      // Loaded lazily so the mail module never joins the keystone import graph at build time.
      const deliver = send || (await import("./orderMail")).sendOrderConfirmationEmail;
      const result = await deliver({
        to: email, storeName: sale.store?.name || "the store", orderNumber: sale.receiptNumber, name: sale.customer?.name || "there",
        lines: sale.lines.map((line: any) => ({ title: line.variantTitleSnapshot ? `${line.titleSnapshot} (${line.variantTitleSnapshot})` : line.titleSnapshot, quantity: String(line.quantity), total: money(line.totalCents) })),
        total: money(sale.totalCents),
        link: receiptLink(sale.id, Boolean(sale.customer?.email), proof, cart?.id),
      });
      await (result.sent ? mark("sent", undefined, result.messageId, result.response) : mark("failed", result.error || "send_failed"));
    } catch (error) {
      try { await mark("failed", error instanceof Error ? error.message : "send_failed"); } catch { /* the order is committed; bookkeeping must never surface */ }
    }
  } catch (error) {
    console.error("Order confirmation email bookkeeping failed:", error instanceof Error ? error.message : "unknown");
  }
}

/** A signed-in customer reads the order in their account. A guest reads it on the guest receipt page: with the
 *  basket proof when this request holds it, else the page's own possession cookie in the same browser. */
function receiptLink(saleId: string, signedIn: boolean, proof: { cartId: string; token: string } | null | undefined, cartId?: string) {
  const base = String(process.env.SMTP_STORE_LINK).replace(/\/$/, "");
  if (signedIn) return `${base}/account/receipts/${encodeURIComponent(saleId)}`;
  if (proof && cartId && proof.cartId === cartId) return `${base}/checkout/complete?cart=${encodeURIComponent(proof.cartId)}&token=${encodeURIComponent(proof.token)}`;
  return `${base}/checkout/complete`;
}

/** Never throws; loaded lazily from the commit paths. */
export async function sendConfirmationAfterCommit(prisma: any, saleId: string, proof?: { cartId: string; token: string } | null) {
  try { await deliverOrderConfirmation(prisma, saleId, proof); } catch { /* never fail the order */ }
}

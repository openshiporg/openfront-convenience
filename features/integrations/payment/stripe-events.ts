import type { VerifiedPaymentWebhook } from "./types";

/**
 * Maps a signature-verified Stripe event onto the domain webhook shape so the
 * existing dedupe/evidence path in paymentWebhookOperations handles it.
 * Returns null for event types the convenience ledger does not act on.
 */
export function mapStripeEvent(event: any): VerifiedPaymentWebhook | null {
  if (!event || typeof event.id !== "string" || !event.id || typeof event.type !== "string") {
    throw new Error("Unsupported webhook event");
  }
  const object = event.data?.object ?? {};
  const occurredAt = new Date(Number(event.created) * 1000);
  const base = { externalEventId: event.id, occurredAt: Number.isFinite(occurredAt.getTime()) ? occurredAt : new Date(), failureCode: null as string | null };
  const currency = typeof object.currency === "string" ? object.currency.toUpperCase() : null;
  if (event.type === "payment_intent.succeeded") {
    return { ...base, eventType: "payment.captured", providerPaymentId: String(object.id), providerRefundId: null, amountCents: Number.isSafeInteger(object.amount_received) ? object.amount_received : null, currencyCode: currency };
  }
  if (event.type === "payment_intent.payment_failed") {
    return { ...base, eventType: "payment.failed", providerPaymentId: String(object.id), providerRefundId: null, amountCents: null, currencyCode: currency, failureCode: String(object.last_payment_error?.code ?? "").slice(0, 100) || null };
  }
  if (event.type === "charge.refunded") {
    const refunds: any[] = Array.isArray(object.refunds?.data) ? object.refunds.data : [];
    const latest = refunds[0];
    return {
      ...base,
      eventType: "refund.completed",
      providerPaymentId: typeof object.payment_intent === "string" ? object.payment_intent : null,
      providerRefundId: typeof latest?.id === "string" ? latest.id : null,
      amountCents: latest && Number.isSafeInteger(latest.amount) ? latest.amount : null,
      currencyCode: currency,
    };
  }
  return null;
}

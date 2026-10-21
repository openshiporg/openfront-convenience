import { createHash, randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import { fingerprintInput } from "../lib/idempotency";
import { getPaymentProviderAdapter } from "../utils/paymentProviderAdapter";

export type PaymentWebhookResult = {
  id: string;
  status: string;
  replayed: boolean;
};

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function integrationAlert(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    storeId: string | null;
    fingerprint: string;
    title: string;
    message: string;
    resourceType: string;
    resourceId: string;
  },
) {
  const existing = await transaction.operationalAlert.findUnique({ where: { fingerprint: input.fingerprint } });
  if (existing) return existing;
  return transaction.operationalAlert.create({
    data: {
      businessId: input.businessId,
      storeId: input.storeId,
      alertNumber: `ALT-${randomUUID()}`,
      fingerprint: input.fingerprint,
      type: "integration_failure",
      severity: "critical",
      status: "open",
      title: input.title,
      message: input.message,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      detectedAt: new Date(),
    },
  });
}

export async function ingestPaymentWebhook(
  context: Context,
  input: { paymentProviderId: string; rawBody: string; headers: Headers },
): Promise<PaymentWebhookResult> {
  if (!input.paymentProviderId || input.paymentProviderId.length > 100) throw new Error("Payment provider is invalid");
  if (!input.rawBody || Buffer.byteLength(input.rawBody, "utf8") > 256 * 1024) {
    throw new Error("Webhook body must be between 1 byte and 256 KiB");
  }
  const provider = await context.prisma.paymentProvider.findFirst({
    where: { id: input.paymentProviderId, status: "active" },
  });
  if (!provider?.businessId) throw new Error("Active payment provider not found");
  const providerBusinessId: string = provider.businessId;
  const adapter = getPaymentProviderAdapter(provider.adapterKey);
  if (!adapter.supportsWebhooks) throw new Error("Payment provider does not accept webhooks");
  const event = adapter.verifyWebhook({
    rawBody: input.rawBody,
    headers: input.headers,
    credentialReference: provider.credentialReference || null,
  });
  const payloadDigest = digest(input.rawBody);
  const lookupKey = `${provider.id}:${event.externalEventId}`;

  return context.prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`payment-webhook:${lookupKey}`}))::text AS "locked"`,
    );
    const existing = await transaction.webhookEvent.findUnique({ where: { lookupKey } });
    if (existing) {
      if (existing.payloadDigest !== payloadDigest || existing.eventType !== event.eventType) {
        throw new Error("Webhook event ID was reused with different evidence");
      }
      return { id: existing.id, status: existing.status, replayed: true };
    }

    const webhook = await transaction.webhookEvent.create({
      data: {
        businessId: provider.businessId,
        paymentProviderId: provider.id,
        externalEventId: event.externalEventId,
        lookupKey,
        eventType: event.eventType,
        payloadDigest,
        status: "processing",
        attemptCount: 1,
        receivedAt: new Date(),
        metadata: { occurredAt: event.occurredAt.toISOString() },
      },
    });

    let storeId: string | null = null;
    let resourceType = "PaymentProvider";
    let resourceId = provider.id;
    let status: "processed" | "ignored" | "failed" = "ignored";
    let lastError = "";

    if (event.eventType.startsWith("payment.") && event.providerPaymentId) {
      const tender = await transaction.tender.findUnique({
        where: { providerLookupKey: `${provider.id}:${event.providerPaymentId}` },
      });
      if (tender) {
        storeId = tender.storeId;
        resourceType = "Tender";
        resourceId = tender.id;
        const amountMatches = event.amountCents == null || event.amountCents === tender.amountCents;
        const currencyMatches = event.currencyCode == null || event.currencyCode === tender.currencyCode;
        if (!amountMatches || !currencyMatches) {
          status = "failed";
          lastError = "Signed provider event did not match recorded tender amount/currency";
        } else {
          status = "processed";
          if (event.eventType === "payment.failed") {
            await integrationAlert(transaction, {
              businessId: providerBusinessId,
              storeId,
              fingerprint: `payment-webhook-failed:${provider.id}:${event.externalEventId}`,
              title: "Provider reported a payment failure",
              message: "A signed provider event conflicts with a recorded tender and requires operator reconciliation.",
              resourceType,
              resourceId,
            });
          }
        }
      }
    } else if (event.eventType.startsWith("refund.") && event.providerRefundId) {
      const providerLookupKey = `${provider.id}:${event.providerRefundId}`;
      const [allocation, legacyRefund] = await Promise.all([
        transaction.refundTenderAllocation.findUnique({
          where: { providerLookupKey },
          include: { refund: true },
        }),
        transaction.refund.findUnique({ where: { providerLookupKey } }),
      ]);
      const refund = allocation?.refund ?? legacyRefund;
      if (refund) {
        storeId = refund.storeId;
        resourceType = "Refund";
        resourceId = refund.id;
        const expectedAmountCents = allocation?.amountCents ?? refund.amountCents;
        const expectedCurrencyCode = allocation?.currencyCode ?? refund.currencyCode;
        const amountMatches = event.amountCents == null || event.amountCents === expectedAmountCents;
        const currencyMatches = event.currencyCode == null || event.currencyCode === expectedCurrencyCode;
        if (!amountMatches || !currencyMatches) {
          status = "failed";
          lastError = "Signed provider event did not match recorded refund amount/currency";
        } else {
          status = "processed";
          if (event.eventType === "refund.failed") {
            await integrationAlert(transaction, {
              businessId: providerBusinessId,
              storeId,
              fingerprint: `refund-webhook-failed:${provider.id}:${event.externalEventId}`,
              title: "Provider reported a refund failure",
              message: "A signed provider event conflicts with a recorded refund and requires operator reconciliation.",
              resourceType,
              resourceId,
            });
          }
        }
      }
    }

    if (status === "failed") {
      await integrationAlert(transaction, {
        businessId: providerBusinessId,
        storeId,
        fingerprint: `payment-webhook-mismatch:${provider.id}:${event.externalEventId}`,
        title: "Payment webhook mismatch",
        message: lastError,
        resourceType,
        resourceId,
      });
    }

    const processedAt = new Date();
    await transaction.webhookEvent.update({
      where: { id: webhook.id },
      data: { status, processedAt, lastError },
    });
    await transaction.auditEvent.create({
      data: {
        businessId: provider.businessId,
        storeId,
        eventNumber: randomUUID(),
        action: `payment_webhook.${event.eventType}`,
        resourceType,
        resourceId,
        result: status === "failed" ? "failed" : "succeeded",
        actorType: "integration",
        requestId: event.externalEventId,
        changes: { webhookEventId: webhook.id, status },
        occurredAt: processedAt,
        metadata: { paymentProviderId: provider.id, payloadDigest },
      },
    });
    const payload = {
      businessId: provider.businessId,
      storeId,
      paymentProviderId: provider.id,
      webhookEventId: webhook.id,
      eventType: event.eventType,
      status,
      resource: { type: resourceType, id: resourceId },
    };
    await transaction.outboxEvent.create({
      data: {
        businessId: provider.businessId,
        storeId,
        eventKey: `payment-webhook:${webhook.id}:v1`,
        topic: `convenience.payment_webhook.${event.eventType}.v1`,
        schemaVersion: 1,
        aggregateType: resourceType,
        aggregateId: resourceId,
        action: `payment_webhook.${event.eventType}`,
        payload,
        payloadHash: fingerprintInput(payload),
        status: "pending",
        attempts: 0,
        totalAttempts: 0,
        replayCount: 0,
        maxAttempts: 8,
        availableAt: processedAt,
        occurredAt: event.occurredAt,
      },
    });
    return { id: webhook.id, status, replayed: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

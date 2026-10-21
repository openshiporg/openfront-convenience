import { createHmac, timingSafeEqual } from "node:crypto";

import { verifySignedPaymentAuthority } from "./authority";
import type { PaymentProviderAdapter, VerifiedPaymentWebhook } from "./types";

function environmentValue(reference: string | null): string {
  const match = /^env:\/\/([A-Z][A-Z0-9_]{2,127})$/.exec(reference ?? "");
  if (!match) throw new Error("HMAC webhooks require an env:// credential reference");
  const value = process.env[match[1]];
  if (!value || value.length < 32) throw new Error("Webhook verification material is unavailable");
  return value;
}

function safeText(value: unknown, label: string, required = true): string | null {
  if (value == null && !required) return null;
  if (typeof value !== "string") throw new Error(`${label} must be text`);
  const normalized = value.trim();
  if (!normalized && !required) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(normalized)) {
    throw new Error(`${label} contains unsupported characters`);
  }
  return normalized;
}

function optionalCents(value: unknown): number | null {
  if (value == null) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error("Webhook amount must be a non-negative integer number of cents");
  }
  return Number(value);
}

function parseVerifiedEvent(rawBody: string): VerifiedPaymentWebhook {
  let value: unknown;
  try {
    value = JSON.parse(rawBody);
  } catch {
    throw new Error("Webhook body must be valid JSON");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Webhook body must be an object");
  }
  const event = value as Record<string, unknown>;
  const data = event.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Webhook data must be an object");
  }
  const detail = data as Record<string, unknown>;
  const eventType = safeText(event.type, "Webhook event type");
  const supported = ["payment.captured", "payment.failed", "refund.completed", "refund.failed"] as const;
  if (!supported.includes(eventType as (typeof supported)[number])) {
    throw new Error("Unsupported webhook event type");
  }
  const occurredAt = new Date(String(event.occurredAt ?? ""));
  if (!Number.isFinite(occurredAt.getTime())) throw new Error("Webhook occurredAt must be an ISO timestamp");
  const currency = detail.currencyCode == null ? null : String(detail.currencyCode).trim().toUpperCase();
  if (currency !== null && !/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Webhook currency must be a three-letter code");
  }
  return {
    externalEventId: safeText(event.id, "Webhook event ID")!,
    eventType: eventType as VerifiedPaymentWebhook["eventType"],
    occurredAt,
    providerPaymentId: safeText(detail.providerPaymentId, "Provider payment ID", false),
    providerRefundId: safeText(detail.providerRefundId, "Provider refund ID", false),
    amountCents: optionalCents(detail.amountCents),
    currencyCode: currency,
    failureCode: safeText(detail.failureCode, "Failure code", false),
  };
}

function externalReference(input: Parameters<PaymentProviderAdapter["validateExternalConfirmation"]>[0]) {
  const providerPaymentId = safeText(input.providerPaymentId, "External payment reference")!;
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("External payment amount must be a positive integer number of cents");
  }
  const currencyCode = input.currencyCode.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error("External payment currency must be a three-letter code");
  const confirmation = { ...input, providerPaymentId, amountCents: input.amountCents, currencyCode };
  verifySignedPaymentAuthority(confirmation);
  return confirmation;
}

export const hmacJsonV1PaymentAdapter: PaymentProviderAdapter = {
  key: "hmac_json_v1",
  supportsWebhooks: true,
  validateExternalConfirmation: externalReference,
  validateExternalRefund: externalReference,
  verifyWebhook({ rawBody, headers, credentialReference, now = new Date() }) {
    const timestampText = headers.get("x-openfront-timestamp")?.trim() ?? "";
    const signatureText = headers.get("x-openfront-signature")?.trim() ?? "";
    if (!/^\d{10}$/.test(timestampText) || !/^v1=[a-f0-9]{64}$/.test(signatureText)) {
      throw new Error("Webhook signature headers are invalid");
    }
    const timestampMs = Number(timestampText) * 1000;
    if (Math.abs(now.getTime() - timestampMs) > 5 * 60 * 1000) {
      throw new Error("Webhook timestamp is outside the five-minute acceptance window");
    }
    const expected = createHmac("sha256", environmentValue(credentialReference))
      .update(`${timestampText}.${rawBody}`)
      .digest();
    const received = Buffer.from(signatureText.slice(3), "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new Error("Webhook signature is invalid");
    }
    return parseVerifiedEvent(rawBody);
  },
};

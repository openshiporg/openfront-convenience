import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  ExternalPaymentConfirmation,
  PaymentAuthorityContext,
} from "./types";
import {
  buildScopedIdempotencyKey,
  fingerprintInput,
  normalizeIdempotencyKey,
} from "../../keystone/lib/idempotency";
import { redactSensitiveValues } from "../../keystone/lib/secretPolicy";

export function retailPaymentContext(input: {
  businessId: string;
  storeId: string;
  scope: string;
  idempotencyKey: string;
  command: unknown;
  provider: {
    id: string;
    adapterKey: string;
    updatedAt: Date;
    configuration: unknown;
    credentialReference: string;
  };
  subjectId: string;
  subjectRevision: string;
  originalTenderId?: string;
  originalProviderPaymentId?: string;
  originalTenderEvidenceDigest?: string;
}): PaymentAuthorityContext {
  return {
    version: 2,
    businessId: input.businessId,
    storeId: input.storeId,
    providerId: input.provider.id,
    providerRevision: fingerprintInput({
      adapterKey: input.provider.adapterKey,
      updatedAt: input.provider.updatedAt.toISOString(),
      configuration: input.provider.configuration,
      credentialReference: input.provider.credentialReference,
    }),
    subjectId: input.subjectId,
    subjectRevision: input.subjectRevision,
    commandKeyDigest: buildScopedIdempotencyKey(
      `${input.businessId}:${input.scope}`,
      normalizeIdempotencyKey(input.idempotencyKey),
    ),
    requestDigest: fingerprintInput(redactSensitiveValues(input.command)),
    originalTenderId: input.originalTenderId ?? null,
    originalProviderPaymentId: input.originalProviderPaymentId ?? null,
    originalTenderEvidenceDigest: input.originalTenderEvidenceDigest ?? null,
  };
}

/** Public wire contract for external signers; does not sign or call a provider. */
export function paymentAuthorityMessage(
  input: ExternalPaymentConfirmation,
  timestamp: string,
): string {
  const base = [
    input.purpose,
    input.providerPaymentId,
    String(input.amountCents),
    input.currencyCode,
    timestamp,
  ];
  if (!input.context) return base.join("\n");
  const c = input.context;
  if (
    c.version !== 2 ||
    [
      c.businessId,
      c.storeId,
      c.providerId,
      c.providerRevision,
      c.subjectId,
      c.subjectRevision,
      c.commandKeyDigest,
      c.requestDigest,
    ].some(
      (value) =>
        typeof value !== "string" ||
        !value ||
        value.length > 256 ||
        /[\r\n]/.test(value),
    )
  ) {
    throw new Error("Payment authority context is invalid");
  }
  const originalEvidence = [
    c.originalTenderId,
    c.originalProviderPaymentId,
    c.originalTenderEvidenceDigest,
  ];
  if (
    input.purpose === "refund"
      ? originalEvidence.some(
          (value) =>
            typeof value !== "string" ||
            !value ||
            value.length > 256 ||
            /[\r\n]/.test(value),
        )
      : originalEvidence.some((value) => value !== null)
  ) {
    throw new Error("Payment authority original tender context is invalid");
  }
  return JSON.stringify([
    "openfront-convenience/payment-authority/v2",
    ...base,
    c.version,
    c.businessId,
    c.storeId,
    c.providerId,
    c.providerRevision,
    c.subjectId,
    c.subjectRevision,
    c.commandKeyDigest,
    c.requestDigest,
    c.originalTenderId,
    c.originalProviderPaymentId,
    c.originalTenderEvidenceDigest,
  ]);
}

function environmentValue(reference: string | null): string {
  const match = /^env:\/\/([A-Z][A-Z0-9_]{2,127})$/.exec(reference ?? "");
  if (!match)
    throw new Error(
      "Payment authority requires an env:// credential reference",
    );
  const value = process.env[match[1]];
  if (!value || value.length < 32)
    throw new Error("Payment authority verification material is unavailable");
  return value;
}

/**
 * Verifies a short-lived terminal/acquirer assertion. The proof format is
 * `v2=<unix-seconds>.<hex-hmac>` over paymentAuthorityMessage's contextual
 * contract. Contextless legacy callers retain v1; retail callers cannot downgrade.
 */
export function verifySignedPaymentAuthority(
  input: ExternalPaymentConfirmation,
  now = new Date(),
): void {
  const match = /^v([12])=(\d{10})\.([a-f0-9]{64})$/.exec(
    input.authorityProof.trim(),
  );
  if (match && match[1] !== (input.context ? "2" : "1"))
    throw new Error(
      "Payment authority proof version does not match required context",
    );
  if (!match) throw new Error("Payment authority proof is invalid");
  const timestampSeconds = Number(match[2]);
  if (Math.abs(now.getTime() - timestampSeconds * 1000) > 5 * 60 * 1000) {
    throw new Error(
      "Payment authority proof is outside the five-minute acceptance window",
    );
  }
  const message = paymentAuthorityMessage(input, match[2]);
  const expected = createHmac(
    "sha256",
    environmentValue(input.credentialReference),
  )
    .update(message)
    .digest();
  const received = Buffer.from(match[3], "hex");
  if (
    received.length !== expected.length ||
    !timingSafeEqual(received, expected)
  ) {
    throw new Error("Payment authority proof is invalid");
  }
}

export type PaymentAuthorityContext = {
  version: 2;
  businessId: string;
  storeId: string;
  providerId: string;
  providerRevision: string;
  subjectId: string;
  subjectRevision: string;
  commandKeyDigest: string;
  requestDigest: string;
  originalTenderId: string | null;
  originalProviderPaymentId: string | null;
  originalTenderEvidenceDigest: string | null;
};

export type ExternalPaymentConfirmation = {
  providerPaymentId: string;
  amountCents: number;
  currencyCode: string;
  authorityProof: string;
  credentialReference: string | null;
  purpose: "payment" | "refund";
  // Supplying context requires v2; legacy v1 cannot downgrade this boundary.
  context?: PaymentAuthorityContext;
};

export type VerifiedPaymentWebhook = {
  externalEventId: string;
  eventType:
    | "payment.captured"
    | "payment.failed"
    | "refund.completed"
    | "refund.failed";
  occurredAt: Date;
  providerPaymentId: string | null;
  providerRefundId: string | null;
  amountCents: number | null;
  currencyCode: string | null;
  failureCode: string | null;
};

export type VerifyPaymentWebhookInput = {
  rawBody: string;
  headers: Headers;
  credentialReference: string | null;
  now?: Date;
};

export type PaymentProviderAdapter = {
  key: string;
  supportsWebhooks: boolean;
  validateExternalConfirmation(
    input: ExternalPaymentConfirmation,
  ): ExternalPaymentConfirmation;
  validateExternalRefund(
    input: ExternalPaymentConfirmation,
  ): ExternalPaymentConfirmation;
  verifyWebhook(input: VerifyPaymentWebhookInput): VerifiedPaymentWebhook;
};

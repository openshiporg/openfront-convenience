import { verifySignedPaymentAuthority } from "./authority";
import type { PaymentProviderAdapter } from "./types";

function confirmation(input: Parameters<PaymentProviderAdapter["validateExternalConfirmation"]>[0]) {
  const providerPaymentId = input.providerPaymentId.trim();
  const currencyCode = input.currencyCode.trim().toUpperCase();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{2,127}$/.test(providerPaymentId)) {
    throw new Error("External payment reference must be 3-128 safe characters");
  }
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("External payment amount must be a positive integer number of cents");
  }
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    throw new Error("External payment currency must be a three-letter code");
  }
  const confirmation = { ...input, providerPaymentId, amountCents: input.amountCents, currencyCode };
  verifySignedPaymentAuthority(confirmation);
  return confirmation;
}

export const manualExternalPaymentAdapter: PaymentProviderAdapter = {
  key: "manual_external",
  supportsWebhooks: false,
  validateExternalConfirmation: confirmation,
  validateExternalRefund: confirmation,
  verifyWebhook() {
    throw new Error("The manual external adapter does not accept webhooks");
  },
};

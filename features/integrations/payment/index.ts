import { hmacJsonV1PaymentAdapter } from "./hmac-json-v1";
import { manualExternalPaymentAdapter } from "./manual-external";
import type { PaymentProviderAdapter } from "./types";

const adapters = new Map<string, PaymentProviderAdapter>([
  [manualExternalPaymentAdapter.key, manualExternalPaymentAdapter],
  [hmacJsonV1PaymentAdapter.key, hmacJsonV1PaymentAdapter],
]);

export const paymentAdapterKeys = Array.from(adapters.keys()).sort();

export function getPaymentProviderAdapter(key: string): PaymentProviderAdapter {
  const adapter = adapters.get(key.trim());
  if (!adapter) throw new Error("Payment provider adapter is not registered");
  return adapter;
}

export type {
  ExternalPaymentConfirmation,
  PaymentProviderAdapter,
  VerifiedPaymentWebhook,
  VerifyPaymentWebhookInput,
} from "./types";

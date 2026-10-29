import { hmacJsonV1PaymentAdapter } from "./hmac-json-v1";
import { manualExternalPaymentAdapter } from "./manual-external";
import { sharedRegistryPaymentAdapters } from "./shared-registry";
import type { PaymentProviderAdapter } from "./types";

// Shared six-function adapters (same registry as E-commerce and Restaurant). A
// provider whose createPaymentFunction names one of these keys, or an https URL,
// dispatches here; terminal-confirmation providers keep using the domain adapters
// below. Finite registry: no dynamic import paths.
export const paymentProviderAdapters = {
  stripe: () => import("./stripe"),
  paypal: () => import("./paypal"),
  manual: () => import("./manual"),
};

const adapters = new Map<string, PaymentProviderAdapter>([
  [manualExternalPaymentAdapter.key, manualExternalPaymentAdapter],
  [hmacJsonV1PaymentAdapter.key, hmacJsonV1PaymentAdapter],
  ...sharedRegistryPaymentAdapters.map((adapter) => [adapter.key, adapter] as [string, PaymentProviderAdapter]),
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

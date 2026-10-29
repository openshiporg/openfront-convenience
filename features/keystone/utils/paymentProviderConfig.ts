// Whether a shared-registry provider has the server env it needs, and the only
// values that may reach the browser (publishable keys, never secrets).
export interface PublicPaymentProviderConfig {
  provider: "stripe";
  publishableKey: string;
}

const stripePublishableKey = () => process.env.NEXT_PUBLIC_STRIPE_KEY || process.env.STRIPE_PUBLISHABLE_KEY || "";

/** `selector` is the provider's createPaymentFunction value. */
export function isPaymentProviderConfigured(selector: string): boolean {
  if (selector === "stripe") return Boolean(stripePublishableKey() && process.env.STRIPE_SECRET_KEY);
  if (selector === "paypal") return Boolean(process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  return selector === "manual";
}

export function getPublicPaymentProviderConfig(selector: string): PublicPaymentProviderConfig | null {
  if (selector === "stripe" && isPaymentProviderConfigured("stripe")) {
    return { provider: "stripe", publishableKey: stripePublishableKey() };
  }
  return null;
}

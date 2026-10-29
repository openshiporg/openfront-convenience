import Stripe from "stripe";

import { mapStripeEvent } from "./stripe-events";
import type { PaymentProviderAdapter } from "./types";

// Domain-side registration of the shared six-function providers. These providers
// settle through createPaymentFunction/getPaymentStatusFunction (online pickup),
// never through the signed terminal-confirmation path, so confirmation validation
// fails closed here. Stripe additionally accepts webhooks, mapped onto the same
// payment.captured / refund.completed events the HMAC adapter produces.

function noTerminalConfirmation(): never {
  throw new Error("This provider settles online and cannot confirm a terminal payment");
}

function sharedAdapter(key: string, supportsWebhooks: boolean): PaymentProviderAdapter {
  return {
    key,
    supportsWebhooks,
    validateExternalConfirmation: noTerminalConfirmation,
    validateExternalRefund: noTerminalConfirmation,
    verifyWebhook({ rawBody, headers }) {
      if (key !== "stripe") throw new Error("This provider does not accept webhooks");
      const secret = process.env.STRIPE_WEBHOOK_SECRET;
      const secretKey = process.env.STRIPE_SECRET_KEY;
      const signature = headers.get("stripe-signature");
      if (!secret || !secretKey) throw new Error("Stripe webhook signature verification is not configured");
      if (!signature) throw new Error("Webhook signature headers are invalid");
      let event: unknown;
      try {
        event = new Stripe(secretKey).webhooks.constructEvent(rawBody, signature, secret);
      } catch {
        throw new Error("Webhook signature is invalid");
      }
      const mapped = mapStripeEvent(event);
      if (!mapped) throw new Error("Unsupported webhook event type");
      return mapped;
    },
  };
}

export const sharedRegistryPaymentAdapters: PaymentProviderAdapter[] = [
  sharedAdapter("stripe", true),
  sharedAdapter("paypal", false),
  sharedAdapter("manual", false),
];

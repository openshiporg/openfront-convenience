"use client";

import { useEffect, useRef, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

import { saveReceiptEmail, settlePickup, startPickupPayment } from "../actions";

type Started = { clientSecret: string; publishableKey: string; paymentId: string };

function PayForm({ total, defaultEmail, onPaid }: { total: string; defaultEmail: string; onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(defaultEmail);

  async function confirmAndSettle() {
    if (!stripe || !elements) return;
    setBusy(true);
    setMessage("");
    // Optional. Saved before the charge so a bad address stops here, never after payment.
    const saved = await saveReceiptEmail(email);
    if (!saved.ok) {
      setMessage(saved.message);
      setBusy(false);
      return;
    }
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, redirect: "if_required", confirmParams: { return_url: `${window.location.origin}/checkout` } });
    if (error) {
      setMessage(error.message || "Payment failed");
      setBusy(false);
      return;
    }
    if (paymentIntent && !["succeeded", "processing", "requires_capture"].includes(paymentIntent.status)) {
      setMessage("Payment was not completed");
      setBusy(false);
      return;
    }
    // The server asks the provider itself before it posts the order; the browser result is never trusted.
    const settled = await settlePickup();
    if (settled.state === "paid") return onPaid();
    setMessage(settled.state === "processing" ? "Your payment is processing. Refresh in a moment." : settled.message || "We could not confirm your payment yet.");
    setBusy(false);
  }

  return (
    <form onSubmit={(event) => { event.preventDefault(); void confirmAndSettle(); }} className="sf-form">
      <label className="sf-field">
        <span>Email for receipt</span>
        <input name="receiptEmail" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
      </label>
      <PaymentElement />
      {message ? <p role="alert" className="sf-alert"><span className="sf-dot" data-tone="danger" aria-hidden="true" />{message}</p> : null}
      <button className="sf-btn sf-btn--wide sf-btn--big" disabled={busy || !stripe}>{busy ? "Processing…" : `Pay ${total}`}</button>
    </form>
  );
}

export function PickupPayment({ total, defaultEmail = "" }: { total: string; defaultEmail?: string }) {
  const [started, setStarted] = useState<Started | null>(null);
  const [error, setError] = useState("");
  const stripePromise = useRef<Promise<Stripe | null> | null>(null);
  const began = useRef(false);

  useEffect(() => {
    if (began.current) return;
    began.current = true;
    void startPickupPayment().then((result) => {
      if (!result.ok) return setError(result.message);
      stripePromise.current = loadStripe(result.payment.publishableKey);
      setStarted(result.payment);
    });
  }, []);

  // After a redirect-based payment method returns here, confirm the order too.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.get("payment_intent")) return;
    void settlePickup().then((settled) => {
      if (settled.state === "paid") window.location.assign("/checkout/complete");
    });
  }, []);

  if (error) return <p role="alert" className="sf-alert"><span className="sf-dot" data-tone="danger" aria-hidden="true" />{error}</p>;
  if (!started || !stripePromise.current) return <p role="status" className="sf-empty"><span className="sf-dot" data-tone="muted" aria-hidden="true" />Preparing secure payment…</p>;
  return (
    <Elements stripe={stripePromise.current} options={{ clientSecret: started.clientSecret }}>
      <PayForm total={total} defaultEmail={defaultEmail} onPaid={() => window.location.assign("/checkout/complete")} />
    </Elements>
  );
}

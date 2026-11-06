"use client";

import { useSyncExternalStore } from "react";

import { openStatus } from "../lib/open-now";
import type { StorefrontDay } from "../lib/storefront-settings";

type Hours = Partial<Record<StorefrontDay, string>>;

const subscribe = (notify: () => void) => {
  const timer = window.setInterval(notify, 60_000);
  return () => window.clearInterval(timer);
};
const minuteNow = () => Math.floor(Date.now() / 60_000);

/** "opens 6am" / "opens tomorrow 6am" while the store is closed; null when open or the hours can't be read. */
export function useOpensAt(hours: Hours | undefined, timeZone?: string | null): string | null {
  const minute = useSyncExternalStore(subscribe, minuteNow, () => null);
  if (minute === null || !hours) return null;
  const status = openStatus(hours, timeZone, new Date(minute * 60_000));
  if (!status || status.open) return null;
  return status.label.startsWith("Closed · ") ? status.label.slice("Closed · ".length) : null;
}

/**
 * Where and when an online order can be collected. When the store is closed the
 * customer is told it is ready once the store opens, the way Square and Shopify
 * pickup pages quote the next opening time instead of "ready now".
 */
export function PickupWhen({ place, hours, timeZone, prefix = "Pick up at" }: { place: string; hours?: Hours; timeZone?: string | null; prefix?: string }) {
  const opens = useOpensAt(hours, timeZone);
  return (
    <>
      {prefix} {place}
      {opens ? <> · store closed, ready when it {opens}</> : null}
    </>
  );
}

/** The order state on the confirmation page: "Ready for pickup", or "Ready when the store opens 6am". */
export function PickupState({ pickedUp, hours, timeZone }: { pickedUp: boolean; hours?: Hours; timeZone?: string | null }) {
  const opens = useOpensAt(hours, timeZone);
  const label = pickedUp ? "Picked up" : opens ? `Ready when the store ${opens}` : "Ready for pickup";
  return (
    <span className="sf-state">
      <span className="sf-dot" data-tone={pickedUp ? "muted" : opens ? "warn" : "ok"} aria-hidden="true" />
      {label}
    </span>
  );
}

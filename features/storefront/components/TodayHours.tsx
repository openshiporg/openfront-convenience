"use client";

import { useSyncExternalStore } from "react";

import { openStatus } from "../lib/open-now";
import { STOREFRONT_DAYS, type StorefrontDay } from "../lib/storefront-settings";

const closed = (value: string) => !value || /^closed$/i.test(value.trim());

// Re-reads the clock every minute; null while server rendering, so the page
// never hydrates with a server-time guess.
const subscribe = (notify: () => void) => {
  const timer = window.setInterval(notify, 60_000);
  return () => window.clearInterval(timer);
};
const minuteNow = () => Math.floor(Date.now() / 60_000);

function useMinute(): number | null {
  return useSyncExternalStore(subscribe, minuteNow, () => null);
}

type Hours = Partial<Record<StorefrontDay, string>>;

/** "Open now · until 11pm" (or today's hours as typed) with a dot, in the store's timezone. */
export function TodayLine({ hours, timeZone }: { hours: Hours; timeZone?: string | null }) {
  const minute = useMinute();
  if (minute === null) return <span className="sf-today">Hours</span>;
  const status = openStatus(hours, timeZone, new Date(minute * 60_000));
  if (status) {
    return (
      <span className="sf-today">
        <span className="sf-dot" data-tone={status.open ? "ok" : "muted"} aria-hidden="true" />
        <span className="sf-today__hours">{status.label}</span>
      </span>
    );
  }
  const today = STOREFRONT_DAYS[(new Date(minute * 60_000).getDay() + 6) % 7];
  const value = hours[today] ?? "";
  return (
    <span className="sf-today">
      <span className="sf-dot" data-tone={closed(value) ? "muted" : "ok"} aria-hidden="true" />
      Today
      <span className="sf-today__hours">{closed(value) ? "Closed" : value}</span>
    </span>
  );
}

export function HoursList({ hours, timeZone }: { hours: Hours; timeZone?: string | null }) {
  const minute = useMinute();
  const today = minute === null ? null : (openStatus(hours, timeZone, new Date(minute * 60_000))?.today ?? STOREFRONT_DAYS[(new Date(minute * 60_000).getDay() + 6) % 7]);
  return (
    <dl className="sf-hours">
      {STOREFRONT_DAYS.filter((day) => hours[day]).map((day) => (
        <div key={day} data-today={day === today || undefined}>
          <dt>{day.slice(0, 3)}</dt>
          <dd>{hours[day]}</dd>
        </div>
      ))}
    </dl>
  );
}

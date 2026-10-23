"use client";

import { useSyncExternalStore } from "react";

import { STOREFRONT_DAYS, type StorefrontDay } from "../lib/storefront-settings";

// getDay() is Sunday-first; STOREFRONT_DAYS is Monday-first.
const todayKey = (): StorefrontDay => STOREFRONT_DAYS[(new Date().getDay() + 6) % 7];
const closed = (value: string) => !value || /^closed$/i.test(value.trim());

const subscribe = () => () => {};

/** The visitor's local day; null while server rendering. */
function useToday(): StorefrontDay | null {
  return useSyncExternalStore(subscribe, todayKey, () => null);
}

/** "Today · 6am – 11pm" with a dot, for the header strip and store card title line. */
export function TodayLine({ hours }: { hours: Partial<Record<StorefrontDay, string>> }) {
  const today = useToday();
  if (!today) return <span className="sf-today">Hours</span>;
  const value = hours[today] ?? "";
  return (
    <span className="sf-today">
      <span className="sf-dot" data-tone={closed(value) ? "muted" : "ok"} aria-hidden="true" />
      Today
      <span className="sf-today__hours">{closed(value) ? "Closed" : value}</span>
    </span>
  );
}

export function HoursList({ hours }: { hours: Partial<Record<StorefrontDay, string>> }) {
  const today = useToday();
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

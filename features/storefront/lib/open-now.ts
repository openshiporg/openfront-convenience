// "Open now · until 11pm" from free-text hours ("6am – 11pm", "6:30 AM to midnight",
// "24 hours", "Closed"), read in the store's timezone. Text it can't read returns
// null, and the storefront shows the hours as typed.

import { STOREFRONT_DAYS, type StorefrontDay } from "./storefront-settings";

export type ParsedHours = { kind: "closed" } | { kind: "always" } | { kind: "range"; open: number; close: number };

function clockMinutes(hour: number, minute: number, meridiem: string | undefined): number | null {
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    const pm = meridiem.startsWith("p");
    return ((hour % 12) + (pm ? 12 : 0)) * 60 + minute;
  }
  if (hour > 24) return null;
  return (hour % 24) * 60 + minute;
}

export function parseHours(text: string): ParsedHours | null {
  const value = text
    .trim()
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+to\s+/g, "-")
    .replace(/\bmidnight\b/g, "12am")
    .replace(/\bnoon\b/g, "12pm")
    .replace(/\./g, "");
  if (!value) return null;
  if (/^closed$/.test(value)) return { kind: "closed" };
  if (/\b24\s*(hours|hrs|h|\/7)\b|^open 24/.test(value)) return { kind: "always" };
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?\s*-\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a|p)?$/.exec(value);
  if (!match) return null;
  const [, h1, m1 = "0", ap1, h2, m2 = "0", ap2] = match;
  const close = clockMinutes(Number(h2), Number(m2), ap2);
  // A bare opening hour before a pm close is a morning ("6-11pm" is 6am, "12-5pm"
  // opens at noon); before an am close it's the evening before ("10-2am").
  const inferred = ap1 ?? (ap2 ? (ap2.startsWith("p") ? (Number(h1) === 12 ? "pm" : "am") : "pm") : undefined);
  const open = clockMinutes(Number(h1), Number(m1), inferred);
  if (open === null || close === null) return null;
  return { kind: "range", open, close: close <= open ? close + 1440 : close };
}

function clockText(minutes: number): string {
  const total = ((minutes % 1440) + 1440) % 1440;
  if (total === 0) return "midnight";
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour < 12 ? "am" : "pm";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return minute ? `${twelve}:${String(minute).padStart(2, "0")}${suffix}` : `${twelve}${suffix}`;
}

/** The store's weekday and minute of the day. */
export function storeClock(timeZone: string | null | undefined, now: Date): { day: number; minutes: number } {
  let parts: Record<string, string>;
  try {
    parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { timeZone: timeZone || undefined, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(now)
        .map((part) => [part.type, part.value]),
    );
  } catch {
    parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((part) => [part.type, part.value]),
    );
  }
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return { day: Math.max(0, weekdays.indexOf(parts.weekday)), minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

export type OpenStatus = { open: boolean; label: string; today: StorefrontDay };

export function openStatus(
  hours: Partial<Record<StorefrontDay, string>>,
  timeZone: string | null | undefined,
  now: Date,
): OpenStatus | null {
  const { day, minutes } = storeClock(timeZone, now);
  const today = STOREFRONT_DAYS[day];
  const parsed = (offset: number) => parseHours(hours[STOREFRONT_DAYS[(day + offset + 7) % 7]] ?? "");
  const current = parsed(0);
  if (!current) return null;
  const yesterday = parsed(-1);
  if (yesterday?.kind === "range" && yesterday.close > 1440 && minutes < yesterday.close - 1440) {
    return { open: true, label: `Open now · until ${clockText(yesterday.close)}`, today };
  }
  if (current.kind === "always") return { open: true, label: "Open 24 hours", today };
  if (current.kind === "range" && minutes >= current.open && minutes < current.close) {
    return { open: true, label: `Open now · until ${clockText(current.close)}`, today };
  }
  if (current.kind === "range" && minutes < current.open) {
    return { open: false, label: `Closed · opens ${clockText(current.open)}`, today };
  }
  for (let offset = 1; offset <= 7; offset += 1) {
    const next = parsed(offset);
    if (next?.kind === "always") return { open: false, label: offset === 1 ? "Closed · opens tomorrow" : `Closed · opens ${capital(STOREFRONT_DAYS[(day + offset) % 7]).slice(0, 3)}`, today };
    if (next?.kind === "range") {
      const when = offset === 1 ? "tomorrow" : capital(STOREFRONT_DAYS[(day + offset) % 7]).slice(0, 3);
      return { open: false, label: `Closed · opens ${when} ${clockText(next.open)}`, today };
    }
  }
  return { open: false, label: "Closed", today };
}

const capital = (value: string) => value[0].toUpperCase() + value.slice(1);

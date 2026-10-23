// Merchants type dollars, $/gal and local date-times; the operations take
// integer cents, integer mills and ISO-8601 with an offset. These helpers
// convert at the form boundary, by field name, so every form shares one rule.

export const isMoneyField = (name: string) => /Cents\d?$/.test(name);
export const isMillsField = (name: string) => /Mills/.test(name);

const DATETIME_FIELDS = new Set([
  "startsAt",
  "endsAt",
  "expiresAt",
  "measuredAt",
  "occurredAt",
  "periodStartedAt",
  "periodEndedAt",
  "effectiveAt",
  "asOf",
  "expectedAt",
]);
export const isDateTimeField = (name: string) => DATETIME_FIELDS.has(name.replace(/\d$/, ""));

/** "17.07", "$17.07", "1,234.5" or "-3" → integer cents. */
export function centsFromInput(raw: string): number {
  const value = raw.replace(/[$,\s]/g, "");
  const match = /^(-?)(\d*)(?:\.(\d{0,2}))?$/.exec(value);
  if (!value || !match || (!match[2] && !match[3])) throw new Error("Enter an amount such as 12.50");
  const cents = Number(match[2] || "0") * 100 + Number((match[3] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Amount is too large");
  return match[1] ? -cents : cents;
}

/** "3.599" dollars per gallon → 3599 mills. */
export function millsFromInput(raw: string): number {
  const value = raw.replace(/[$,\s]/g, "");
  const match = /^(\d*)(?:\.(\d{0,3}))?$/.exec(value);
  if (!value || !match || (!match[1] && !match[2])) throw new Error("Enter a price such as 3.599");
  return Number(match[1] || "0") * 1000 + Number((match[2] ?? "").padEnd(3, "0"));
}

export const centsToInput = (cents: number) => (cents / 100).toFixed(2);
export const millsToInput = (mills: number) => (mills / 1000).toFixed(3);

function offsetMinutes(at: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/**
 * A `datetime-local` value ("2026-10-23T18:00") read in the store's timezone,
 * returned as ISO-8601 with that zone's offset. Values that already carry an
 * offset, and anything unrecognised, pass through for the server to validate.
 */
export function zonedIso(local: string, timeZone: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(local.trim());
  if (!match) return local;
  const zone = timeZone || "UTC";
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = match;
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  // Two passes settle the offset across a DST change.
  let offset = offsetMinutes(new Date(wall), zone);
  offset = offsetMinutes(new Date(wall - offset * 60_000), zone);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Now in the store's timezone, as a `datetime-local` value. */
export function zonedNowInput(timeZone: string | null | undefined, plusMinutes = 0): string {
  const at = new Date(Date.now() + plusMinutes * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Converts one submitted value by its field name. */
export function convertFormValue(name: string, raw: string, timeZone: string | null | undefined): string {
  if (!raw) return raw;
  if (isMoneyField(name)) return String(centsFromInput(raw));
  if (isMillsField(name)) return String(millsFromInput(raw));
  if (isDateTimeField(name)) return zonedIso(raw, timeZone);
  return raw;
}

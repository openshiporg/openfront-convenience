export const STOREFRONT_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type StorefrontDay = (typeof STOREFRONT_DAYS)[number];
export type StorefrontHours = Record<StorefrontDay, string>;
export type StorefrontMode = "demo" | "live";

export const EMPTY_STOREFRONT_HOURS: StorefrontHours = {
  monday: "",
  tuesday: "",
  wednesday: "",
  thursday: "",
  friday: "",
  saturday: "",
  sunday: "",
};

export function normalizeStorefrontHours(value: unknown): StorefrontHours {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    STOREFRONT_DAYS.map((day) => {
      const raw = source[day];
      const hours = typeof raw === "string" ? raw.trim() : "";
      return [day, hours.length <= 40 ? hours : ""];
    }),
  ) as StorefrontHours;
}

export function storefrontHoursFromMetadata(value: unknown): StorefrontHours {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_STOREFRONT_HOURS };
  }
  return normalizeStorefrontHours(
    (value as Record<string, unknown>).publicHours,
  );
}

export function mergeStorefrontHoursMetadata(
  metadata: unknown,
  hours: StorefrontHours,
): Record<string, unknown> {
  const current =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return { ...current, publicHours: hours };
}

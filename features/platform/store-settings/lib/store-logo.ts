import { LOGO_ICONS } from "./icon-registry";

// Untitled UI's Boltshift mark, rotated from its blue to a convenience-store red.
export const DEFAULT_STORE_LOGO_ICON = LOGO_ICONS.find((icon) => icon.id === "boltshift")!.lightSvg;
export const DEFAULT_STORE_LOGO_COLOR = '144';

// This module is intentionally browser-safe. Server-only SVG parsing and
// sanitization lives in features/lib/sanitize-store-logo.ts.
export function normalizeStoreLogoColor(value: unknown): string {
  const numeric = Number.parseFloat(String(value ?? DEFAULT_STORE_LOGO_COLOR));
  if (!Number.isFinite(numeric)) return DEFAULT_STORE_LOGO_COLOR;
  return String(((numeric % 360) + 360) % 360);
}

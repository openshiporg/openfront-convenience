import { sanitizeStoreLogoSvg } from "@/features/lib/sanitize-store-logo";
import { normalizeStoreLogoColor, DEFAULT_STORE_LOGO_ICON } from "@/features/platform/store-settings/lib/store-logo";

/** One renderer for public header, mobile navigation and footer. */
export function StoreLogo({ name, logoIcon, logoColor }: { name: string; logoIcon?: string; logoColor?: string }) {
  const svg = sanitizeStoreLogoSvg(logoIcon ?? "") || DEFAULT_STORE_LOGO_ICON;
  return <span className="sf-logo"><span className="sf-logo__icon" aria-hidden="true" style={{ filter: `hue-rotate(${normalizeStoreLogoColor(logoColor)}deg)` }} dangerouslySetInnerHTML={{ __html: svg }} /><span className="sf-logo__name">{name}</span></span>;
}

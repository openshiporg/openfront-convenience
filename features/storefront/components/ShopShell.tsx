import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Search } from "lucide-react";

import { normalizeStoreLogoColor } from "@/features/platform/store-settings/lib/store-logo";
import { getPublicStorefrontProjection } from "../lib/public-storefront";
import { addressParts } from "../lib/address";
import { StoreLogo } from "./StoreLogo";
import { MobileMenu, StoreNav } from "./StoreNav";
import { TodayLine } from "./TodayHours";
import { HeaderSearch } from "./HeaderSearch";
import { storefrontFonts } from "./fonts";
import "../shop.css";

function SearchForm({ id }: { id: string }) {
  return (
    <form action="/shop" method="get" role="search" className="sf-search">
      <label htmlFor={id} className="sf-sr">
        Search products
      </label>
      <Search aria-hidden="true" className="sf-icon sf-search__icon" />
      <input id={id} type="search" name="q" maxLength={100} placeholder="Search the store" autoComplete="off" />
    </form>
  );
}

/**
 * The store's shelf: a top channel strip (name, open state, nav) over the page.
 * Home passes `channel` (address, phone, fuel) into the strip, and then the
 * footer leaves them out so they appear once.
 */
export async function ShopShell({ children, channel }: { children: ReactNode; channel?: ReactNode }) {
  const projection = await getPublicStorefrontProjection();
  const identity = projection.identity;
  if (!identity || projection.state !== "published") {
    return (
      <main className={`sf sf-soon ${storefrontFonts}`}>
        <p className="sf-soon__state">
          <span className="sf-dot" data-tone="muted" aria-hidden="true" />
          Coming soon
        </p>
      </main>
    );
  }
  // Same hue the projection derives the brand colours from, so the whole storefront follows the logo.
  const theme = { "--sf-h": String((260 + Number(normalizeStoreLogoColor(identity.logoColor))) % 360) } as CSSProperties;
  const location = projection.location;
  const fullAddress = location ? addressParts(location).full : "";
  const hasHours = location ? Object.values(location.hours).some(Boolean) : false;

  return (
    <div className={`sf ${storefrontFonts}`} style={theme}>
      <header className="sf-top">
        <div className="sf-wrap sf-top__row">
          <Link href="/" className="sf-top__home" aria-label={`${identity.name} home`}>
            <StoreLogo {...identity} />
          </Link>
          {hasHours && location ? <TodayLine hours={location.hours} timeZone={location.timezone} withHours /> : null}
          <HeaderSearch>
            <SearchForm id="sf-search-desktop" />
          </HeaderSearch>
          <StoreNav />
          <MobileMenu>
            <SearchForm id="sf-search-mobile" />
          </MobileMenu>
        </div>
        {channel ? <div className="sf-top__channel">{channel}</div> : null}
      </header>
      <main className="sf-wrap sf-main">{children}</main>
      <footer className="sf-foot">
        <div className="sf-wrap sf-foot__inner">
          <div className="sf-foot__store">
            <StoreLogo {...identity} />
            {identity.tagline ? <p className="sf-foot__tagline">{identity.tagline}</p> : null}
          </div>
          {!channel && (fullAddress || location?.phone) ? (
            <div className="sf-foot__contact">
              {fullAddress ? <address>{fullAddress}</address> : null}
              {location?.phone ? (
                <a className="sf-foot__phone" href={`tel:${location.phone.replace(/[^\d+]/g, "")}`}>
                  {location.phone}
                </a>
              ) : null}
            </div>
          ) : null}
          <nav className="sf-foot__nav" aria-label="Footer">
            <Link href="/shop">Shop</Link>
            <Link href="/account">Account</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

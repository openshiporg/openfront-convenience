import Link from "next/link";
import { Doto, Sofia_Sans_Semi_Condensed } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";
import { Search } from "lucide-react";

import { normalizeStoreLogoColor } from "@/features/platform/store-settings/lib/store-logo";
import { getPublicStorefrontProjection } from "../lib/public-storefront";
import { addressParts } from "../lib/address";
import { StoreLogo } from "./StoreLogo";
import { MobileMenu, StoreNav } from "./StoreNav";
import { HoursList, TodayLine } from "./TodayHours";
import "../shop.css";

// Receipt-printer dot matrix for the store name, prices and totals; a condensed
// grotesk for everything else.
const text = Sofia_Sans_Semi_Condensed({ subsets: ["latin"], variable: "--sf-font", display: "swap" });
const dots = Doto({ subsets: ["latin"], weight: ["700", "900"], variable: "--sf-dots", display: "swap" });

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

export async function ShopShell({ children }: { children: ReactNode }) {
  const projection = await getPublicStorefrontProjection();
  const identity = projection.identity;
  const fonts = `${text.variable} ${dots.variable}`;
  if (!identity || projection.state !== "published") {
    return (
      <main className={`sf sf-soon ${fonts}`}>
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
  const address = fullAddress;
  const hasHours = location ? Object.values(location.hours).some(Boolean) : false;

  return (
    <div className={`sf ${fonts}`} style={theme}>
      <div className="sf-strip">
        <div className="sf-wrap sf-strip__inner">
          {hasHours && location ? <TodayLine hours={location.hours} timeZone={location.timezone} /> : <span />}
          <span className="sf-strip__meta">
            {address ? <span>{address}</span> : null}
            {location?.phone ? (
              <a href={`tel:${location.phone.replace(/[^\d+]/g, "")}`} className="sf-mono">
                {location.phone}
              </a>
            ) : null}
          </span>
        </div>
      </div>
      <header className="sf-bar">
        <div className="sf-wrap sf-bar__inner">
          <Link href="/" className="sf-bar__home" aria-label={`${identity.name} home`}>
            <StoreLogo {...identity} />
          </Link>
          <div className="sf-bar__search">
            <SearchForm id="sf-search-desktop" />
          </div>
          <StoreNav />
          <MobileMenu>
            <SearchForm id="sf-search-mobile" />
          </MobileMenu>
        </div>
      </header>
      <main className="sf-wrap sf-main">{children}</main>
      <footer className="sf-foot">
        <div className="sf-wrap sf-foot__inner">
          <p className="sf-foot__mark" aria-hidden="true">
            {identity.name}
          </p>
          <div className="sf-foot__brand">
            <StoreLogo {...identity} />
            {identity.tagline ? <p>{identity.tagline}</p> : null}
          </div>
          {location ? (
            <div className="sf-foot__col">
              <h2>{location.name}</h2>
              {fullAddress ? <address>{fullAddress}</address> : null}
              {location.phone ? <p className="sf-mono">{location.phone}</p> : null}
            </div>
          ) : null}
          {hasHours && location ? (
            <div className="sf-foot__col">
              <h2>Hours</h2>
              <HoursList hours={location.hours} timeZone={location.timezone} />
            </div>
          ) : null}
          <nav className="sf-foot__col" aria-label="Footer">
            <h2>Store</h2>
            <Link href="/shop">Shop</Link>
            <Link href="/account">Account</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

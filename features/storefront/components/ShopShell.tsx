import Link from "next/link";
import type { ReactNode } from "react";
import { MapPin, Search, ShoppingBag, UserRound } from "lucide-react";

import { getPublicStorefrontProjection } from "../lib/public-storefront";
import { addressParts } from "../lib/address";
import { basket, currentCustomer, customerHistory, customerRewards, firstPage } from "../lib/data";
import { ReorderButton, ReorderCard } from "./Reorder";
import { StoreLogo } from "./StoreLogo";
import { TodayLine } from "./TodayHours";
import { TabBar } from "./TabBar";
import { storefrontFonts } from "./fonts";
import { categoryHref } from "./ProductRow";
import "../shop.css";

function SearchForm({ id, query = "", category = "" }: { id: string; query?: string; category?: string }) {
  return (
    <form action="/shop" method="get" role="search" className="sf-search">
      <label htmlFor={id} className="sf-sr">
        Search products
      </label>
      <Search aria-hidden="true" className="sf-icon sf-search__icon" />
      {category ? <input type="hidden" name="category" value={category} /> : null}
      <input id={id} type="search" name="q" defaultValue={query} maxLength={100} placeholder="Search the store" autoComplete="off" />
    </form>
  );
}

const mapsHref = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/**
 * Sirius: a white, list-first shop. The header carries the store's own logo,
 * its categories, search, points and the bag; a second bar says whether the
 * store is open and where to pick up. On a phone the categories become tabs
 * and a tab bar sits at the bottom.
 */
export async function ShopShell({
  children,
  active = null,
  query = "",
  showCategories = true,
}: {
  children: ReactNode;
  /** The current category; "" for all products, null when no category applies. */
  active?: string | null;
  query?: string;
  showCategories?: boolean;
}) {
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
  const [data, user, accounts, current, orders] = await Promise.all([firstPage(), currentCustomer(), customerRewards(), basket(), customerHistory()]);
  const lastOrder = orders[0];
  const lastThumb = lastOrder ? data?.products.find((product) => product.title === lastOrder.lines[0]?.titleSnapshot)?.image ?? null : null;
  const categories = data?.categories ?? [];
  const onlinePickup = Boolean(data?.onlinePickup);
  const points = accounts.filter((account) => account.status === "active").reduce((sum, account) => sum + (account.pointsBalance ?? 0), 0);
  const hasPoints = accounts.some((account) => account.status === "active");
  const bagCount = current?.lines.reduce((sum, line) => sum + Number(line.quantity), 0) ?? 0;
  const location = projection.location;
  const address = location ? addressParts(location) : null;
  const street = location?.addressLine1 || address?.full || "";
  const mapsQuery = location ? [location.addressLine1, location.city, location.stateProvince, location.postalCode].filter(Boolean).join(", ") : "";
  const hasHours = location ? Object.values(location.hours).some(Boolean) : false;

  const categoryLinks = (className: string) =>
    categories.map((name) => (
      <Link key={name} href={categoryHref(name)} className={className} aria-current={active === name ? "page" : undefined}>
        {name}
      </Link>
    ));

  return (
    <div className={`sf ${storefrontFonts}`}>
      <header className="sf-top">
        <div className="sf-top__row">
          <Link href="/" className="sf-top__home" aria-label={`${identity.name} home`}>
            <StoreLogo {...identity} />
          </Link>
          <nav className="sf-cats" aria-label="Categories">
            {categoryLinks("sf-cats__link")}
          </nav>
          <div className="sf-top__tools">
            <SearchForm id="sf-search-top" query={query} category={active || ""} />
            {user && hasPoints ? (
              <Link href="/account" className="sf-points" aria-label={`${points} reward points`}>
                <UserRound aria-hidden="true" className="sf-icon sf-points__avatar" />
                <span>
                  <span className="sf-num">{points}</span> pts
                </span>
              </Link>
            ) : (
              <Link href="/account" className="sf-iconbtn" aria-label={user ? "Account" : "Sign in"}>
                <UserRound aria-hidden="true" className="sf-icon" />
              </Link>
            )}
            {onlinePickup ? (
              <Link href="/basket" className="sf-iconbtn sf-bag" aria-label={`Basket, ${bagCount} ${bagCount === 1 ? "item" : "items"}`}>
                <ShoppingBag aria-hidden="true" className="sf-icon" />
                {bagCount ? <span className="sf-bag__count sf-num">{bagCount}</span> : null}
              </Link>
            ) : null}
          </div>
          <div className="sf-top__phone">
            {hasHours && location ? (
              <span className="sf-pill">
                <TodayLine hours={location.hours} timeZone={location.timezone} />
              </span>
            ) : null}
            {user && hasPoints ? (
              <Link href="/account" className="sf-phonepts">
                ★ <span className="sf-num">{points}</span> pts
              </Link>
            ) : null}
          </div>
        </div>
        <div className="sf-sub">
          <div className="sf-sub__open">{hasHours && location ? <TodayLine hours={location.hours} timeZone={location.timezone} /> : null}</div>
          {lastOrder ? (
            <ReorderButton order={lastOrder} data={data} />
          ) : street ? (
            <a className="sf-sub__visit" href={mapsQuery ? mapsHref(mapsQuery) : undefined} target="_blank" rel="noreferrer">
              <MapPin aria-hidden="true" className="sf-icon" />
              {street}
            </a>
          ) : (
            <span />
          )}
          <div className="sf-mode" role="group" aria-label="How to shop">
            <span className="sf-mode__on">{onlinePickup ? "Pickup" : "In store"}</span>
            {location?.phone ? (
              <a className="sf-mode__off" href={`tel:${location.phone.replace(/[^\d+]/g, "")}`}>
                Call
              </a>
            ) : null}
          </div>
        </div>
        <div className="sf-strip">
          <span className="sf-strip__on">
            <MapPin aria-hidden="true" className="sf-icon" />
            {onlinePickup ? "Pickup" : "In store"}
            {street ? ` · ${street}` : ""}
          </span>
          {mapsQuery ? (
            <a className="sf-strip__off" href={mapsHref(mapsQuery)} target="_blank" rel="noreferrer">
              Directions
            </a>
          ) : null}
        </div>
        {lastOrder ? (
          <div className="sf-lead">
            <ReorderCard order={lastOrder} data={data} thumb={lastThumb} />
          </div>
        ) : null}
        {showCategories && categories.length ? (
          <nav className="sf-tabs" aria-label="Categories">
            <Link href="/" className="sf-tabs__link" aria-current={active === "" ? "page" : undefined}>
              All
            </Link>
            {categoryLinks("sf-tabs__link")}
          </nav>
        ) : null}
      </header>
      <main className="sf-main">{children}</main>
      <footer className="sf-foot">
        <div className="sf-foot__inner">
          <StoreLogo {...identity} />
          {address?.full ? <address>{address.full}</address> : null}
          {location?.phone ? (
            <a className="sf-foot__phone sf-num" href={`tel:${location.phone.replace(/[^\d+]/g, "")}`}>
              {location.phone}
            </a>
          ) : null}
          <nav className="sf-foot__nav" aria-label="Footer">
            <Link href="/shop">Shop</Link>
            <Link href="/account">Account</Link>
          </nav>
        </div>
      </footer>
      <TabBar />
    </div>
  );
}

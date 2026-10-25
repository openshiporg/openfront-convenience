import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Search } from "lucide-react";

import { ShopShell } from "../components/ShopShell";
import { HoursList, TodayLine } from "../components/TodayHours";
import { addressParts } from "../lib/address";
import { getPublicStorefrontProjection } from "../lib/public-storefront";

export async function generateMetadata(): Promise<Metadata> {
  const projection = await getPublicStorefrontProjection();
  if (projection.state === "published" && projection.identity) {
    return {
      title: projection.identity.name,
      description: projection.identity.tagline || undefined,
    };
  }
  return { title: "Coming soon" };
}

const shopCategory = (name: string) => `/shop?${new URLSearchParams({ category: name })}`;
const itemCount = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;
// Feed order for the printer-style entrance; CSS turns it into a stagger.
const feed = (index: number) => ({ "--i": index }) as CSSProperties;

export async function StorefrontPage() {
  const projection = await getPublicStorefrontProjection();
  const identity = projection.identity;
  const location = projection.location;
  const categories = projection.categories;
  const hasHours = location ? Object.values(location.hours).some(Boolean) : false;
  const mapsQuery = location
    ? [location.addressLine1, location.city, location.stateProvince, location.postalCode].filter(Boolean).join(", ")
    : "";
  const address = location ? addressParts(location) : null;
  let line = 0;

  return (
    <ShopShell>
      <section className="sf-hero" aria-labelledby="sf-hero-title">
        <h1 id="sf-hero-title" className="sf-display sf-hero__name">
          {identity?.name}
        </h1>
        {identity?.tagline ? <p className="sf-hero__tagline">{identity.tagline}</p> : null}
        <div className="sf-facts">
          {location && hasHours ? (
            <div className="sf-fact sf-fact--today">
              <h2>Today</h2>
              <TodayLine hours={location.hours} timeZone={location.timezone} />
            </div>
          ) : null}
          {address?.full ? (
            <div className="sf-fact">
              <h2>{location?.name ?? "Store"}</h2>
              <address>
                {address.street}
                <br />
                {address.locality}
              </address>
              {mapsQuery ? (
                <a
                  className="sf-link"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Directions
                  <ArrowUpRight aria-hidden="true" className="sf-icon" />
                </a>
              ) : null}
            </div>
          ) : null}
          {location?.phone ? (
            <div className="sf-fact">
              <h2>Phone</h2>
              <a className="sf-fact__phone sf-mono" href={`tel:${location.phone.replace(/[^\d+]/g, "")}`}>
                {location.phone}
              </a>
            </div>
          ) : null}
          {categories.length ? (
            <div className="sf-fact">
              <h2>Aisles</h2>
              <a href="#aisles" className="sf-fact__count">
                <span className="sf-dotnum">{categories.length}</span>
                <span>{itemCount(categories.reduce((sum, category) => sum + category.products.length, 0))}</span>
              </a>
            </div>
          ) : null}
        </div>
        <form action="/shop" method="get" role="search" className="sf-scan">
          <label htmlFor="sf-hero-search" className="sf-sr">
            Search products
          </label>
          <Search aria-hidden="true" className="sf-icon sf-scan__icon" />
          <input id="sf-hero-search" type="search" name="q" maxLength={100} placeholder="Search the store" autoComplete="off" />
          <button className="sf-btn">Search</button>
          <Link href="/shop" className="sf-btn sf-btn--quiet">
            Shop the store
            <ArrowRight aria-hidden="true" className="sf-icon" />
          </Link>
        </form>
      </section>

      <div className="sf-counter">
        {categories.length ? (
          <section id="aisles" className="sf-slip sf-feed" aria-labelledby="sf-aisles-title">
            <div className="sf-slip__head" style={feed(line++)}>
              <h2 id="sf-aisles-title">Aisles</h2>
              <span className="sf-count">{categories.length}</span>
            </div>
            <ol className="sf-aisles">
              {categories.map((category) => (
                <li key={category.id} className="sf-aisle">
                  <Link href={shopCategory(category.name)} className="sf-row sf-aisle__sign" style={feed(line++)}>
                    <span className="sf-aisle__name">{category.name}</span>
                    <span className="sf-leader" aria-hidden="true" />
                    <span className="sf-row__value">{itemCount(category.products.length)}</span>
                    <ArrowRight aria-hidden="true" className="sf-icon sf-aisle__arrow" />
                  </Link>
                  {category.products.length ? (
                    <ul className="sf-aisle__items">
                      {category.products.slice(0, 6).map((product) => (
                        <li key={product.id} style={feed(line++)}>
                          <Link href={`/shop/${product.id}`}>{product.title}</Link>
                          {product.preparedFood ? <span className="sf-chip">Made in store</span> : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {projection.fuelPrices.length || (location && hasHours) ? (
          <aside className="sf-side" aria-label="Store details">
            {projection.fuelPrices.length ? (
              <section className="sf-slip sf-slip--board" aria-labelledby="sf-fuel-title">
                <div className="sf-slip__head">
                  <h2 id="sf-fuel-title">Fuel</h2>
                  <span className="sf-count">per gallon</span>
                </div>
                <ul className="sf-fuel">
                  {projection.fuelPrices.map((price) => (
                    <li key={`${price.grade}-${price.tier}`} className="sf-fuel__item">
                      <span>
                        <span className="sf-fuel__grade">{price.grade}</span>
                        <span className="sf-fuel__tier">{price.tier}</span>
                      </span>
                      <span className="sf-fuel__price">
                        ${(price.priceMillsPerGallon / 1000).toFixed(3)}
                        <small>/gal</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {location && hasHours ? (
              <section className="sf-slip" aria-labelledby="sf-hours-title">
                <div className="sf-slip__head">
                  <h2 id="sf-hours-title">Hours</h2>
                </div>
                <HoursList hours={location.hours} timeZone={location.timezone} />
              </section>
            ) : null}
          </aside>
        ) : null}
      </div>
    </ShopShell>
  );
}

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
        <h1 id="sf-hero-title" className="sf-display sf-hero__name" style={{ "--len": Math.max(8, identity?.name.length ?? 12) } as CSSProperties}>
          {identity?.name}
        </h1>
        {identity?.tagline ? <p className="sf-hero__tagline">{identity.tagline}</p> : null}
        <ul className="sf-slip sf-facts" aria-label="Store">
          {location && hasHours ? (
            <li className="sf-row sf-fact">
              <span className="sf-fact__label">Today</span>
              <span className="sf-leader" aria-hidden="true" />
              <span className="sf-row__value sf-fact--today"><TodayLine hours={location.hours} timeZone={location.timezone} /></span>
            </li>
          ) : null}
          {address?.full ? (
            <li className="sf-row sf-fact">
              <span className="sf-fact__label">{location?.name ?? "Store"}</span>
              <span className="sf-leader" aria-hidden="true" />
              <span className="sf-row__value">
                <address>{address.full}</address>
                {mapsQuery ? (
                  <a className="sf-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`} target="_blank" rel="noreferrer">
                    Directions
                    <ArrowUpRight aria-hidden="true" className="sf-icon" />
                  </a>
                ) : null}
              </span>
            </li>
          ) : null}
          {location?.phone ? (
            <li className="sf-row sf-fact">
              <span className="sf-fact__label">Phone</span>
              <span className="sf-leader" aria-hidden="true" />
              <a className="sf-row__value sf-mono" href={`tel:${location.phone.replace(/[^\d+]/g, "")}`}>{location.phone}</a>
            </li>
          ) : null}
        </ul>
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

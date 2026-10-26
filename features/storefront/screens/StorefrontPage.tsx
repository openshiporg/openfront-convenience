import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, MapPin, Phone, Search } from "lucide-react";

import { ShopShell } from "../components/ShopShell";
import { HoursList } from "../components/TodayHours";
import { AisleHead, AisleSigns, aisleHref, numberAisles } from "../components/AisleSigns";
import { ShelfTag } from "../components/ShelfTag";
import { addressParts } from "../lib/address";
import { catalog } from "../lib/data";
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

// Home stocks the first few aisles; the rest are one sign away.
const HOME_SHELVES = 3;
const SHELF_TAGS = 8;

const fuelPrice = (mills: number) => `$${(mills / 1000).toFixed(3)}`;

export async function StorefrontPage() {
  const projection = await getPublicStorefrontProjection();
  const location = projection.location;
  const published = projection.state === "published" && Boolean(projection.identity);
  const hasHours = location ? Object.values(location.hours).some(Boolean) : false;
  const mapsQuery = location
    ? [location.addressLine1, location.city, location.stateProvince, location.postalCode].filter(Boolean).join(", ")
    : "";
  const address = location ? addressParts(location) : null;
  const phone = location?.phone ?? "";

  // One catalog read per stocked aisle, in parallel; the catalog's own category
  // list numbers the aisles, so the numbers match /shop.
  const shelfNames = published ? projection.categories.slice(0, HOME_SHELVES).map((category) => category.name) : [];
  const shelves = await Promise.all(shelfNames.map((name) => catalog({ category: name })));
  const listed = shelves.find(Boolean)?.categories ?? projection.categories.map((category) => category.name);
  const aisles = numberAisles(listed);
  const aisleOf = (name: string) => aisles.find((aisle) => aisle.name === name) ?? null;
  const madeInStore = new Set(projection.categories.flatMap((category) => category.products.filter((product) => product.preparedFood).map((product) => product.id)));

  const channel = (
    <div className="sf-wrap sf-channel">
      {address?.full ? (
        <span className="sf-channel__item">
          <MapPin aria-hidden="true" className="sf-icon" />
          <address>{address.full}</address>
          {mapsQuery ? (
            <a className="sf-channel__link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`} target="_blank" rel="noreferrer">
              Directions
              <ArrowUpRight aria-hidden="true" className="sf-icon" />
            </a>
          ) : null}
        </span>
      ) : null}
      {phone ? (
        <a className="sf-channel__item sf-channel__link" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
          <Phone aria-hidden="true" className="sf-icon" />
          <span className="sf-num">{phone}</span>
        </a>
      ) : null}
      {projection.fuelPrices.length ? (
        <ul className="sf-fuel" aria-label="Fuel prices per gallon">
          {projection.fuelPrices.map((price) => (
            <li key={`${price.grade}-${price.tier}`} className="sf-fuel__tag">
              <span className="sf-fuel__grade">
                {price.grade}
                {price.tier ? <span className="sf-fuel__tier">{price.tier}</span> : null}
              </span>
              <span className="sf-fuel__price">
                {fuelPrice(price.priceMillsPerGallon)}
                <span className="sf-fuel__unit">/gal</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  return (
    <ShopShell channel={channel}>
      <div className="sf-home">
        <form action="/shop" method="get" role="search" className="sf-searchline">
          <label htmlFor="sf-home-search" className="sf-sr">
            Search products
          </label>
          <Search aria-hidden="true" className="sf-icon sf-searchline__icon" />
          <input id="sf-home-search" type="search" name="q" maxLength={100} placeholder="Search the store" autoComplete="off" />
          <button className="sf-btn">Search</button>
        </form>

        {aisles.length ? <AisleSigns aisles={aisles} allHref="/shop" hrefFor={(name) => aisleHref(name)} /> : null}

        {shelfNames.map((name, index) => {
          const data = shelves[index];
          const products = data?.products.slice(0, SHELF_TAGS) ?? [];
          if (!data || !products.length) return null;
          const aisle = aisleOf(name);
          const id = `sf-shelf-${index}`;
          return (
            <section key={name} className="sf-shelf" aria-labelledby={id}>
              <AisleHead aisle={aisle} name={name} id={id}>
                <Link href={aisleHref(name)} className="sf-more">
                  {data.total > products.length ? `All ${data.total} items` : "View aisle"}
                  <ArrowRight aria-hidden="true" className="sf-icon" />
                </Link>
              </AisleHead>
              <ul className="sf-tags">
                {products.map((product) => (
                  <li key={product.id}>
                    <ShelfTag product={product} currency={data.currency} madeInStore={madeInStore.has(product.id)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {location && hasHours ? (
          <section className="sf-board" aria-labelledby="sf-hours-title">
            <h2 id="sf-hours-title" className="sf-board__title">
              Hours
            </h2>
            <HoursList hours={location.hours} timeZone={location.timezone} />
          </section>
        ) : null}
      </div>
    </ShopShell>
  );
}

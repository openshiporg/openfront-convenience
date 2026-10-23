import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

import { ShopShell } from "../components/ShopShell";
import { HoursList, TodayLine } from "../components/TodayHours";
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

const aisleNumber = (index: number) => String(index + 1).padStart(2, "0");
const shopCategory = (name: string) => `/shop?${new URLSearchParams({ category: name })}`;

export async function StorefrontPage() {
  const projection = await getPublicStorefrontProjection();
  const identity = projection.identity;
  const location = projection.location;
  const categories = projection.categories;
  const hasHours = location ? Object.values(location.hours).some(Boolean) : false;
  const mapsQuery = location
    ? [location.addressLine1, location.city, location.stateProvince, location.postalCode].filter(Boolean).join(", ")
    : "";

  return (
    <ShopShell>
      <section className="sf-hero" aria-labelledby="sf-hero-title">
        <div className="sf-hero__copy">
          <h1 id="sf-hero-title" className="sf-display">
            {identity?.name}
          </h1>
          {identity?.tagline ? <p className="sf-hero__tagline">{identity.tagline}</p> : null}
          <div className="sf-actions">
            <Link href="/shop" className="sf-btn">
              Shop the store
              <ArrowRight aria-hidden="true" className="sf-icon" />
            </Link>
            {categories.length ? (
              <a href="#aisles" className="sf-btn sf-btn--quiet">
                Aisles
              </a>
            ) : null}
          </div>
        </div>
        {location ? (
          <aside className="sf-storecard" aria-label="Store details">
            <div className="sf-storecard__tag">
              <div className="sf-titleline">
                <h2>{location.name}</h2>
                {hasHours ? <TodayLine hours={location.hours} /> : null}
              </div>
              {mapsQuery ? (
                <address>
                  {[location.addressLine1, location.addressLine2].filter(Boolean).join(", ")}
                  <br />
                  {[location.city, location.stateProvince, location.postalCode].filter(Boolean).join(" ")}
                </address>
              ) : null}
              {location.phone ? (
                <a className="sf-storecard__phone sf-mono" href={`tel:${location.phone.replace(/[^\d+]/g, "")}`}>
                  {location.phone}
                </a>
              ) : null}
              {hasHours ? <HoursList hours={location.hours} /> : null}
            </div>
            {mapsQuery ? (
              <a
                className="sf-storecard__link"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`}
                target="_blank"
                rel="noreferrer"
              >
                Directions
                <ArrowUpRight aria-hidden="true" className="sf-icon" />
              </a>
            ) : null}
          </aside>
        ) : null}
      </section>

      {categories.length ? (
        <section id="aisles" className="sf-section" aria-labelledby="sf-aisles-title">
          <div className="sf-section__head">
            <h2 id="sf-aisles-title">Aisles</h2>
            <span className="sf-count">{categories.length}</span>
          </div>
          <ol className="sf-aisles">
            {categories.map((category, index) => (
              <li key={category.id} className="sf-aisle">
                <Link href={shopCategory(category.name)} className="sf-aisle__sign">
                  <span className="sf-aisle__number">Aisle {aisleNumber(index)}</span>
                  <span className="sf-aisle__name">{category.name}</span>
                  <ArrowRight aria-hidden="true" className="sf-icon sf-aisle__arrow" />
                </Link>
                {category.products.length ? (
                  <ul className="sf-aisle__items">
                    {category.products.slice(0, 6).map((product) => (
                      <li key={product.id}>
                        <span>{product.title}</span>
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
    </ShopShell>
  );
}

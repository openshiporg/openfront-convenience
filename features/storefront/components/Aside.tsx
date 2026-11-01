import Link from "next/link";
import { ArrowUpRight, Clock, MapPin, Phone, X } from "lucide-react";

import type { Basket } from "../lib/data";
import { money } from "../lib/data";
import { addressParts } from "../lib/address";
import type { PublicStorefrontProjection } from "@/features/keystone/mutations/publicStorefrontProjection";
import { HoursList, TodayLine } from "./TodayHours";

/** The side list of categories; the current one carries the orange rule. */
export function CategoryRail({ categories, active, title }: { categories: string[]; active: string | null; title?: string }) {
  return (
    <nav className="sf-rail" aria-label="Categories">
      {title ? <p className="sf-rail__title">{title}</p> : null}
      <ul>
        <li>
          <Link href="/shop" className="sf-rail__link" aria-current={active === "" ? "page" : undefined}>
            All products
          </Link>
        </li>
        {categories.map((name) => (
          <li key={name}>
            <Link href={`/shop?${new URLSearchParams({ category: name })}`} className="sf-rail__link" aria-current={active === name ? "page" : undefined}>
              {name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const itemTotal = (basket: Basket) => basket.lines.reduce((sum, line) => sum + Number(line.quantity), 0);

/** The floating checkout card under the list (online pickup only). */
export function CheckoutDock({ basket }: { basket: Basket | null }) {
  if (!basket?.lines.length) return null;
  const count = itemTotal(basket);
  return (
    <aside className="sf-dock" aria-label="Basket">
      <span className="sf-dock__count">
        <span className="sf-num">{count}</span> {count === 1 ? "Item" : "Items"}
      </span>
      <Link href="/checkout" className="sf-btn sf-dock__go">
        Checkout — <span className="sf-num">{money(basket.totalCents, basket.currencyCode)}</span>
      </Link>
      <span className="sf-dock__note">Pick up in store</span>
    </aside>
  );
}

/** The right-hand panel: the basket when the store takes pickup orders, otherwise the visit card. */
export function SidePanel({ basket, onlinePickup, location }: { basket: Basket | null; onlinePickup: boolean; location: PublicStorefrontProjection["location"] }) {
  if (onlinePickup) {
    return (
      <aside className="sf-panelr" aria-labelledby="sf-cart-title">
        <div className="sf-panelr__head">
          <h2 id="sf-cart-title" className="sf-panelr__title">
            Your Cart
          </h2>
          <Link href="/shop" className="sf-iconbtn" aria-label="Keep shopping">
            <X aria-hidden="true" className="sf-icon" />
          </Link>
        </div>
        {basket?.lines.length ? (
          <>
            <ul className="sf-cartlines">
              {basket.lines.map((line) => (
                <li key={line.id}>
                  <span className="sf-cartlines__name">{line.titleSnapshot}</span>
                  <span className="sf-cartlines__each sf-num">
                    {Number(line.quantity)} × {money(line.unitPriceCents, basket.currencyCode)}
                  </span>
                  <span className="sf-cartlines__total sf-num">{money(line.totalCents, basket.currencyCode)}</span>
                </li>
              ))}
            </ul>
            <div className="sf-panelr__foot">
              <p className="sf-panelr__label">Subtotal</p>
              <p className="sf-panelr__sum sf-num">{money(basket.subtotalCents, basket.currencyCode)}</p>
              {location ? (
                <p className="sf-panelr__note">
                  <Clock aria-hidden="true" className="sf-icon" />
                  Pick up at {location.addressLine1 || location.name}
                </p>
              ) : null}
              <Link href="/checkout" className="sf-btn sf-btn--wide sf-btn--big">
                Checkout
              </Link>
            </div>
          </>
        ) : (
          <p className="sf-panelr__empty">Your basket is empty. Add items with +.</p>
        )}
      </aside>
    );
  }
  if (!location) return null;
  const address = addressParts(location);
  const mapsQuery = [location.addressLine1, location.city, location.stateProvince, location.postalCode].filter(Boolean).join(", ");
  const hasHours = Object.values(location.hours).some(Boolean);
  if (!address.full && !location.phone && !hasHours) return null;
  return (
    <aside className="sf-panelr" aria-labelledby="sf-visit-title">
      <div className="sf-panelr__head">
        <h2 id="sf-visit-title" className="sf-panelr__title">
          Visit us
        </h2>
      </div>
      <div className="sf-visit">
        {hasHours ? (
          <p className="sf-visit__now">
            <TodayLine hours={location.hours} timeZone={location.timezone} withHours />
          </p>
        ) : null}
        {address.full ? (
          <div className="sf-visit__line">
            <MapPin aria-hidden="true" className="sf-icon" />
            <address>{address.full}</address>
          </div>
        ) : null}
        {location.phone ? (
          <p className="sf-visit__line">
            <Phone aria-hidden="true" className="sf-icon" />
            <a href={`tel:${location.phone.replace(/[^\d+]/g, "")}`} className="sf-num">
              {location.phone}
            </a>
          </p>
        ) : null}
        {hasHours ? <HoursList hours={location.hours} timeZone={location.timezone} /> : null}
      </div>
      <div className="sf-panelr__foot">
        <p className="sf-panelr__note">Shelf prices. Pay at the counter.</p>
        {mapsQuery ? (
          <a className="sf-btn sf-btn--wide sf-btn--big" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`} target="_blank" rel="noreferrer">
            Directions
            <ArrowUpRight aria-hidden="true" className="sf-icon" />
          </a>
        ) : null}
      </div>
    </aside>
  );
}

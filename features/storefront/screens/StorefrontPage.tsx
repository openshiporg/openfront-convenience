import type { Metadata } from "next";
import Link from "next/link";
import { ShopShell } from "../components/ShopShell";
import { getPublicStorefrontProjection } from "../lib/public-storefront";
import { STOREFRONT_DAYS } from "../lib/storefront-settings";

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

export async function StorefrontPage() {
  const projection = await getPublicStorefrontProjection();
  const location = projection.location;
  const hours = location ? STOREFRONT_DAYS.filter(day => location.hours[day]) : [];
  return <ShopShell>
    <section className="shop-home">{projection.identity?.tagline && <p className="shop-label">{projection.identity.tagline}</p>}<h1>{projection.identity?.name}</h1><Link className="shop-primary" href="/shop">Shop now</Link></section>
    {location && <section className="shop-location"><div><h2>{location.name}</h2><address>{[location.addressLine1, location.addressLine2, location.city, location.stateProvince, location.postalCode].filter(Boolean).join(", ")}</address>{location.phone && <p>{location.phone}</p>}</div>{hours.length > 0 && <div><h2>Hours</h2><dl className="shop-hours">{hours.map(day => <div key={day}><dt>{day}</dt><dd>{location!.hours[day]}</dd></div>)}</dl></div>}</section>}
  </ShopShell>;
}

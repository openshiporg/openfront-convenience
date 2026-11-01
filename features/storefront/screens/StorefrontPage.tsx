import type { Metadata } from "next";
import Link from "next/link";

import { ShopShell } from "../components/ShopShell";
import { CategoryRail, CheckoutDock } from "../components/Aside";
import { ProductRow } from "../components/ProductRow";
import { basket, firstPage } from "../lib/data";
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

/** Home is the list: every item, one row each, ready to add. */
export async function StorefrontPage() {
  const projection = await getPublicStorefrontProjection();
  const published = projection.state === "published" && Boolean(projection.identity);
  const [data, current] = published ? await Promise.all([firstPage(), basket()]) : [null, null];
  const madeInStore = new Set(projection.categories.flatMap((category) => category.products.filter((product) => product.preparedFood).map((product) => product.id)));
  const onlinePickup = Boolean(data?.onlinePickup);
  const products = data?.products ?? [];

  return (
    <ShopShell active="">
      <div className="sf-layout">
        <CategoryRail categories={data?.categories ?? []} active="" />
        <section className="sf-list" aria-label="All products">
          <h1 className="sf-sr">{projection.identity?.name ?? "Shop"}</h1>
          {products.length && data ? (
            <ul className="sf-rows">
              {products.map((product, index) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  currency={data.currency}
                  lines={current?.lines ?? []}
                  onlinePickup={onlinePickup}
                  madeInStore={madeInStore.has(product.id)}
                  eager={index < 4}
                />
              ))}
            </ul>
          ) : (
            <p role="status" className="sf-empty">
              <span className="sf-dot" data-tone="muted" aria-hidden="true" />
              {data ? "No products yet" : "Products could not be loaded"}
            </p>
          )}
          {data && data.total > products.length ? (
            <Link href="/shop?page=2" className="sf-more">
              More products
            </Link>
          ) : null}
        </section>
      </div>
      {onlinePickup ? <CheckoutDock basket={current} /> : null}
    </ShopShell>
  );
}

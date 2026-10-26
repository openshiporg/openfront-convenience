import Link from "next/link";

import type { Catalog } from "../lib/data";
import { Price } from "./Price";

type Product = Catalog["products"][number];
type Variant = Product["variants"][number];

const placeholderTitle = /^(default|default variant|default title|regular|standard|each)$/i;

/** The small line under the price: the one size and unit, or how many sizes. */
export function sizeLabel(product: Pick<Product, "title" | "variants">) {
  if (product.variants.length > 1) return `${product.variants.length} sizes`;
  const variant = product.variants[0];
  if (!variant) return "";
  return variantSize(variant, product.title);
}

export function variantSize(variant: Variant, productTitle = "") {
  const title = variant.title.trim();
  const named = title && !placeholderTitle.test(title) && title !== productTitle ? title : "";
  const unit = variant.unitOfMeasure && variant.unitOfMeasure !== "each" && variant.unitOfMeasure !== named ? variant.unitOfMeasure : "";
  return [named, unit].filter(Boolean).join(" · ");
}

/** Lowest real price, and whether sizes differ; null when no size carries a price. */
export function priceOf(variants: Variant[]) {
  const priced = variants.map((variant) => variant.priceCents).filter((cents) => cents > 0);
  if (!priced.length) return null;
  const from = Math.min(...priced);
  return { from, varies: priced.some((cents) => cents !== from) };
}

/** The unlit tag: no price on file, so the counter has the answer. */
export function AskTag() {
  return <span className="sf-tag__ask">Ask at counter</span>;
}

/** One product on the shelf: optional photo standing on the shelf, the tag on its edge. */
export function ShelfTag({ product, currency, madeInStore = false }: { product: Product; currency: string; madeInStore?: boolean }) {
  const price = priceOf(product.variants);
  const size = sizeLabel(product);
  return (
    <Link href={`/shop/${product.id}`} className="sf-item">
      {product.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed bucket URL, shown as uploaded
        <img className="sf-item__photo" src={product.image.url} alt={product.image.alt || ""} loading="lazy" />
      ) : null}
      <span className="sf-tag" data-variant={price ? undefined : "ask"}>
        <span className="sf-tag__name">{product.title}</span>
        <span className="sf-tag__row">
          {price ? <Price cents={price.from} currency={currency} from={price.varies} /> : <AskTag />}
          {size ? <span className="sf-tag__size">{size}</span> : null}
        </span>
        {madeInStore ? <span className="sf-tag__mark">Made in store</span> : null}
      </span>
    </Link>
  );
}

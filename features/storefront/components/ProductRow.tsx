import Link from "next/link";
import { Coffee, CupSoda, Cookie, Package, Sandwich, ShoppingBasket } from "lucide-react";

import type { Basket, Catalog } from "../lib/data";
import { Price } from "./Price";
import { Stepper } from "./Stepper";

export type Product = Catalog["products"][number];
type Variant = Product["variants"][number];
type Line = Basket["lines"][number];

const placeholderTitle = /^(default|default variant|default title|regular|standard|each)$/i;

export const categoryHref = (name: string) => `/shop?${new URLSearchParams({ category: name })}`;

/** The size line under a name: the one size and unit, or how many sizes. */
export function sizeLabel(product: Pick<Product, "title" | "variants">) {
  if (product.variants.length > 1) return `${product.variants.length} sizes`;
  const variant = product.variants[0];
  return variant ? variantSize(variant, product.title) : "";
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

/** The basket line for a variant, matched the way the basket snapshots it. */
export function lineFor(lines: Line[], product: Pick<Product, "title">, variant: Pick<Variant, "title">) {
  return lines.find((line) => line.titleSnapshot === product.title && line.variantTitleSnapshot === variant.title) ?? null;
}

function CategoryIcon({ category }: { category: string }) {
  const name = category.toLowerCase();
  const props = { className: "sf-photo__icon", strokeWidth: 1.25 };
  if (/coffee|tea|bar/.test(name)) return <Coffee {...props} />;
  if (/drink|water|soda|juice|beverage/.test(name)) return <CupSoda {...props} />;
  if (/snack|pantry|candy|sweet/.test(name)) return <Cookie {...props} />;
  if (/food|deli|prepared|sandwich|kitchen/.test(name)) return <Sandwich {...props} />;
  if (/essential|household|home/.test(name)) return <Package {...props} />;
  return <ShoppingBasket {...props} />;
}

/** The product photo, or the category's icon on a soft tile when no photo is uploaded. */
export function ProductPhoto({ product, className = "sf-photo", eager = false }: { product: Product; className?: string; eager?: boolean }) {
  if (product.image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed bucket URL, shown as uploaded
      <img className={className} src={product.image.url} alt={product.image.alt || product.title} loading={eager ? "eager" : "lazy"} />
    );
  }
  return (
    <span className={`${className} ${className}--none`} aria-hidden="true">
      <CategoryIcon category={product.category} />
    </span>
  );
}

/**
 * One line of the list: photo, name, what it is, the price, and the quantity
 * stepper when the store takes online pickup orders.
 */
export function ProductRow({
  product,
  currency,
  lines,
  onlinePickup,
  madeInStore = false,
  eager = false,
}: {
  product: Product;
  currency: string;
  lines: Line[];
  onlinePickup: boolean;
  madeInStore?: boolean;
  eager?: boolean;
}) {
  const price = priceOf(product.variants);
  const size = sizeLabel(product);
  const href = `/shop/${product.id}`;
  const priced = product.variants.filter((variant) => variant.priceCents > 0);
  const single = priced.length === 1 ? priced[0] : null;
  const line = single ? lineFor(lines, product, single) : null;
  const stock = product.variants.every((variant) => variant.availability === "sold_out") ? "Sold out" : product.variants.every((variant) => variant.availability === "ask" || variant.availability === "sold_out") ? "Ask in store" : null;
  return (
    <li className="sf-row">
      <Link href={href} className="sf-row__photo" tabIndex={-1} aria-hidden="true">
        <ProductPhoto product={product} eager={eager} />
      </Link>
      <div className="sf-row__body">
        <h3 className="sf-row__name">
          <Link href={href}>{product.title}</Link>
        </h3>
        {size || product.description ? (
          <p className="sf-row__desc">
            {[size, product.description].filter(Boolean).join(" · ")}
          </p>
        ) : null}
        <p className="sf-row__cat">
          {product.category}
          {madeInStore ? <span className="sf-row__mark"> · Made in store</span> : null}
        </p>
      </div>
      <p className="sf-row__price">
        {price ? <Price cents={price.from} currency={currency} from={price.varies} /> : <span className="sf-row__ask">Price in store</span>}
      </p>
      <div className="sf-row__act">
        {onlinePickup && single && (single.availability !== "sold_out" || line) ? (
          <Stepper variantId={single.id} lineId={line?.id ?? null} quantity={line ? Number(line.quantity) : 0} name={product.title} />
        ) : onlinePickup && priced.length > 1 ? (
          <Link href={href} className="sf-choose">
            Choose size
          </Link>
        ) : (
          <span className="sf-row__state">{stock ?? "In store"}</span>
        )}
      </div>
    </li>
  );
}

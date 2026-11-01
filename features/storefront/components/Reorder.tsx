import Link from "next/link";
import { RotateCw, Zap } from "lucide-react";

import { money, type Catalog, type History } from "../lib/data";
import { reorderable } from "../lib/reorder";
import { reorderLast } from "../actions";

const count = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

/**
 * The signed-in shopper's last receipt. With online pickup it puts those items
 * back in the basket; without it, it opens the receipt as a shopping list.
 */
export function ReorderButton({ order, data }: { order: History[number] | undefined; data: Catalog | null }) {
  if (!order) return null;
  if (data?.onlinePickup && reorderable(order, data).length) {
    return (
      <form action={reorderLast}>
        <button className="sf-reorder">
          <RotateCw aria-hidden="true" className="sf-icon" />
          Reorder Last Order
        </button>
      </form>
    );
  }
  return (
    <Link href={`/account/receipts/${order.id}`} className="sf-reorder">
      <RotateCw aria-hidden="true" className="sf-icon" />
      Last Order
    </Link>
  );
}

/** The banner above a list: "Quick reorder: your last order", the items, and the action. */
export function ReorderBanner({ order, data }: { order: History[number] | undefined; data: Catalog | null }) {
  if (!order) return null;
  const items = data ? reorderable(order, data) : [];
  const names = order.lines.slice(0, 4).map((line) => line.titleSnapshot).join(", ");
  const canAdd = Boolean(data?.onlinePickup && items.length);
  return (
    <section className="sf-banner" aria-label="Your last order">
      <Zap aria-hidden="true" className="sf-banner__mark" />
      <div className="sf-banner__text">
        <p className="sf-banner__title">
          Quick reorder: <span className="sf-num">{count(order.lines.length)}</span> · <span className="sf-num">{money(order.totalCents, order.currencyCode)}</span>
        </p>
        <p className="sf-banner__names">{names}</p>
      </div>
      {canAdd ? (
        <form action={reorderLast}>
          <button className="sf-btn">Add All to Cart</button>
        </form>
      ) : (
        <Link href={`/account/receipts/${order.id}`} className="sf-btn">
          View receipt
        </Link>
      )}
    </section>
  );
}

/** Phone: "Reorder last time" with the count, total, and Add all. */
export function ReorderCard({ order, data, thumb }: { order: History[number] | undefined; data: Catalog | null; thumb?: { url: string; alt: string } | null }) {
  if (!order) return null;
  const canAdd = Boolean(data?.onlinePickup && reorderable(order, data).length);
  return (
    <section className="sf-again" aria-labelledby="sf-again-title">
      <h2 id="sf-again-title" className="sf-again__title">
        Reorder last time
      </h2>
      <div className="sf-again__row">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed bucket URL
          <img className="sf-again__thumb" src={thumb.url} alt="" />
        ) : null}
        <span className="sf-again__sum">
          <span className="sf-num">{count(order.lines.length)}</span>
          <span aria-hidden="true"> • </span>
          <span className="sf-num">{money(order.totalCents, order.currencyCode)}</span>
        </span>
        {canAdd ? (
          <form action={reorderLast}>
            <button className="sf-again__go">Add all</button>
          </form>
        ) : (
          <Link href={`/account/receipts/${order.id}`} className="sf-again__go">
            View
          </Link>
        )}
      </div>
    </section>
  );
}

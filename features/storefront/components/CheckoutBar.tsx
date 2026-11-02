"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Basket } from "../lib/data";

const format = (cents: number, currency: string) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);

/** Phone: the open basket's count and total, floating above the tab bar and linking to checkout. */
export function CheckoutBar({ basket }: { basket: Basket | null }) {
  const pathname = usePathname() ?? "/";
  if (basket?.status !== "open" || !basket.lines.length) return null;
  if (pathname.startsWith("/basket") || pathname.startsWith("/checkout") || pathname.startsWith("/account")) return null;
  const count = basket.lines.reduce((sum, line) => sum + Number(line.quantity), 0);
  return (
    <Link href="/checkout" className="sf-bar" aria-label={`Checkout, ${count} ${count === 1 ? "item" : "items"}, ${format(basket.totalCents, basket.currencyCode)}`}>
      <span className="sf-bar__count">
        <span className="sf-num">{count}</span> {count === 1 ? "item" : "items"}
      </span>
      <span className="sf-bar__go">
        Checkout · <span className="sf-num">{format(basket.totalCents, basket.currencyCode)}</span>
      </span>
    </Link>
  );
}

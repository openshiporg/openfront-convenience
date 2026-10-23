"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu, ShoppingBasket, UserRound, X } from "lucide-react";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/account", label: "Account" },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

/** Desktop nav pills and the basket pill. */
export function StoreNav({ basketCount }: { basketCount: number }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="sf-nav" aria-label="Store">
      <div className="sf-track sf-nav__links">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="sf-pill"
            aria-current={isActive(pathname, link.href) ? "page" : undefined}
          >
            {link.label === "Account" ? <UserRound aria-hidden="true" className="sf-icon" /> : null}
            {link.label}
          </Link>
        ))}
      </div>
      <BasketLink count={basketCount} active={isActive(pathname, "/basket")} />
    </nav>
  );
}

export function BasketLink({ count, active }: { count: number; active?: boolean }) {
  return (
    <Link
      href="/basket"
      className="sf-basket"
      aria-current={active ? "page" : undefined}
      aria-label={`Basket, ${count} ${count === 1 ? "item" : "items"}`}
    >
      <ShoppingBasket aria-hidden="true" className="sf-icon" />
      <span className="sf-basket__label">Basket</span>
      <span className="sf-basket__count" data-empty={count === 0}>
        {count}
      </span>
    </Link>
  );
}

/** Phone menu sheet; closes itself on navigation. */
export function MobileMenu({ basketCount, children }: { basketCount: number; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);
  return (
    <div className="sf-mobile">
      <BasketLink count={basketCount} active={isActive(pathname, "/basket")} />
      <details ref={ref} className="sf-menu">
        <summary className="sf-menu__toggle" aria-label="Menu">
          <Menu aria-hidden="true" className="sf-icon sf-menu__open" />
          <X aria-hidden="true" className="sf-icon sf-menu__close" />
        </summary>
        <div className="sf-menu__sheet">
          {children}
          <nav aria-label="Store menu" className="sf-menu__links">
            {[...links, { href: "/basket", label: "Basket" }].map((link) => (
              <Link key={link.href} href={link.href} aria-current={isActive(pathname, link.href) ? "page" : undefined}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </details>
    </div>
  );
}

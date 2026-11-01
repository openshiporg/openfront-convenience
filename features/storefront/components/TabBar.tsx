"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Receipt, Search, UserRound } from "lucide-react";

const tabs = [
  { href: "/", label: "Home", Icon: House, match: (path: string) => path === "/" },
  { href: "/shop", label: "Search", Icon: Search, match: (path: string) => path === "/shop" || path.startsWith("/shop/") },
  { href: "/account#receipts", label: "Orders", Icon: Receipt, match: (path: string) => path.startsWith("/account/receipts") || path.startsWith("/basket") || path.startsWith("/checkout") },
  { href: "/account", label: "Account", Icon: UserRound, match: (path: string) => path === "/account" || path.startsWith("/account/sign") },
];

/** The phone's bottom tab bar. */
export function TabBar() {
  const pathname = usePathname() ?? "/";
  return (
    <nav className="sf-tabbar" aria-label="Main">
      {tabs.map(({ href, label, Icon, match }) => (
        <Link key={label} href={href} className="sf-tabbar__link" aria-current={match(pathname) ? "page" : undefined}>
          <Icon aria-hidden="true" className="sf-tabbar__icon" strokeWidth={1.6} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

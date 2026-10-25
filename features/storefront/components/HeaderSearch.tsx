"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The header search, left out where the page already has its own (home and shop). */
export function HeaderSearch({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  if (pathname === "/" || pathname === "/shop" || pathname.startsWith("/shop?")) return null;
  return <div className="sf-bar__search">{children}</div>;
}

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { getPublicStorefrontProjection } from "../lib/public-storefront";
import { StoreLogo } from "./StoreLogo";
import "@/app/storefront.css";
import "../shop.css";

export async function ShopShell({ children }: { children: ReactNode }) {
  const projection = await getPublicStorefrontProjection();
  const identity = projection.identity;
  if (!identity || projection.state !== "published") return <main className="storefront-state"><h1>Coming soon</h1></main>;
  const theme = { "--storefront-primary": identity.primaryColor, "--storefront-accent": identity.accentColor } as CSSProperties;
  return <div className="storefront shop" style={theme}>
    <header className="storefront__header"><div className="storefront__shell shop-header">
      <Link href="/" aria-label={`${identity.name} home`}><StoreLogo {...identity} /></Link>
      <nav className="shop-desktop" aria-label="Store"><Link href="/shop">Shop</Link><Link href="/basket">Basket</Link><Link href="/account">Account</Link></nav>
      <details className="shop-mobile"><summary>Menu</summary><nav aria-label="Mobile store"><StoreLogo {...identity} /><Link href="/shop">Shop</Link><Link href="/basket">Basket</Link><Link href="/account">Account</Link></nav></details>
    </div></header>
    <main className="storefront__shell shop-main">{children}</main>
    <footer className="storefront__footer"><div className="storefront__shell shop-footer"><StoreLogo {...identity} /><Link href="/shop">Shop</Link><Link href="/account">Account</Link></div></footer>
  </div>;
}

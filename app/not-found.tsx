import Link from "next/link";

import { storefrontFonts } from "@/features/storefront/components/fonts";
import "@/features/storefront/shop.css";

export const metadata = { title: "Not found" };

// Static: Next prerenders this page at build time, when the database isn't
// reachable, so it reads nothing. Unknown products get the store-shell 404 in
// app/(shop)/not-found.tsx.
export default function NotFound() {
  return (
    <main className={`sf sf-soon ${storefrontFonts}`}>
      <div className="sf-emptycard">
        <p className="sf-empty">
          <span className="sf-dot" data-tone="muted" aria-hidden="true" />
          Page not found
        </p>
        <Link className="sf-btn" href="/shop">
          Back to shop
        </Link>
      </div>
    </main>
  );
}

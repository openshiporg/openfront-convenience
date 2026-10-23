import Link from "next/link";

import { ShopShell } from "@/features/storefront/components/ShopShell";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <ShopShell>
      <div className="sf-emptycard">
        <p className="sf-empty">
          <span className="sf-dot" data-tone="muted" aria-hidden="true" />
          Page not found
        </p>
        <Link className="sf-btn" href="/shop">
          Back to shop
        </Link>
      </div>
    </ShopShell>
  );
}

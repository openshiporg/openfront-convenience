import "server-only";
import type { cookies } from "next/headers";

type Jar = Awaited<ReturnType<typeof cookies>>;

// Production is HTTPS: the basket cookies are SameSite=None; Secure; Partitioned
// (CHIPS), so the shop keeps its basket when it is framed (the Oathkeeper
// Browser, an embed). Safari keeps a cookie in a cross-site frame only when it
// is partitioned; a partitioned cookie is scoped to the top-level site, so a
// direct visit behaves as before. Development over HTTP stays Lax.
//
// They use new names because a browser keeps a partitioned and an
// unpartitioned cookie of the same name side by side. The earlier Lax cookies
// are still read, and are cleared whenever the basket is written or cleared.
const BASKET = "convenience-basket-p";
const PROOF = "convenience-basket-proof-p";
const LEGACY_BASKET = "convenience-basket";
const LEGACY_PROOF = "convenience-basket-proof";

const production = process.env.NODE_ENV === "production";
const scope = production
  ? ({ sameSite: "none", secure: true, partitioned: true } as const)
  : ({ sameSite: "lax", secure: false } as const);

export function readBasket(jar: Jar): { cartId?: string; token?: string } {
  const cartId = jar.get(BASKET)?.value;
  if (cartId) return { cartId, token: jar.get(PROOF)?.value };
  return { cartId: jar.get(LEGACY_BASKET)?.value, token: jar.get(LEGACY_PROOF)?.value };
}

function clearLegacy(jar: Jar) {
  if (jar.get(LEGACY_BASKET)) jar.delete(LEGACY_BASKET);
  if (jar.get(LEGACY_PROOF)) jar.delete(LEGACY_PROOF);
}

export function writeBasket(jar: Jar, cartId: string, token: string) {
  const options = { httpOnly: true, path: "/", maxAge: 86400, ...scope };
  jar.set(BASKET, cartId, options);
  jar.set(PROOF, token, options);
  clearLegacy(jar);
}

export function clearBasket(jar: Jar) {
  const options = { httpOnly: true, path: "/", maxAge: 0, ...scope };
  jar.set(BASKET, "", options);
  jar.set(PROOF, "", options);
  clearLegacy(jar);
}

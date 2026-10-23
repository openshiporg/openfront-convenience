import type { Metadata } from "next";

import { getPublicStorefrontProjection } from "./public-storefront";

/** "Shop · QA Corner Market"; drafts and unset stores stay "Coming soon". */
export async function storefrontTitle(page: string): Promise<Metadata> {
  const projection = await getPublicStorefrontProjection();
  const name = projection.state === "published" ? projection.identity?.name : null;
  return { title: name ? `${page} · ${name}` : "Coming soon" };
}

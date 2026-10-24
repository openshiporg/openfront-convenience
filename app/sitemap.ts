import type { MetadataRoute } from "next";

import { getBaseUrl } from "@/features/dashboard/lib/getBaseUrl";
import { catalog } from "@/features/storefront/lib/data";
import { getPublicStorefrontProjection } from "@/features/storefront/lib/public-storefront";

// Reads the published catalog, so it renders per request (never at build time).
export const dynamic = "force-dynamic";

const MAX_PAGES = 40;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getBaseUrl();
  const projection = await getPublicStorefrontProjection();
  if (projection.state !== "published") return [];
  const entries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/shop`, changeFrequency: "daily", priority: 0.8 },
  ];
  const first = await catalog({ page: 1 });
  if (!first) return entries;
  for (const name of first.categories) {
    entries.push({ url: `${baseUrl}/shop?${new URLSearchParams({ category: name })}`, changeFrequency: "weekly", priority: 0.6 });
  }
  const pages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(first.total / first.pageSize)));
  for (let page = 1; page <= pages; page += 1) {
    const data = page === 1 ? first : await catalog({ page });
    for (const product of data?.products ?? []) {
      entries.push({ url: `${baseUrl}/shop/${product.id}`, changeFrequency: "weekly", priority: 0.5 });
    }
  }
  return entries;
}

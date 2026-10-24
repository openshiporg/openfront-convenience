import type { MetadataRoute } from "next";

import { getBaseUrl } from "@/features/dashboard/lib/getBaseUrl";

export const dynamic = "force-dynamic";

// The storefront is indexable; the dashboard, account and API are not.
export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await getBaseUrl();
  return {
    rules: [{ userAgent: "*", allow: ["/", "/shop"], disallow: ["/dashboard", "/account", "/api", "/basket", "/checkout"] }],
    ...(baseUrl ? { sitemap: `${baseUrl}/sitemap.xml` } : {}),
  };
}

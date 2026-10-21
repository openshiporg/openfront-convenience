import type { Context } from ".keystone/types";
import { sanitizeStoreLogoSvg } from "../../lib/sanitize-store-logo";
import { normalizeStoreLogoColor } from "../../platform/store-settings/lib/store-logo";

import {
  storefrontHoursFromMetadata,
  type StorefrontHours,
  type StorefrontMode,
} from "../../storefront/lib/storefront-settings";

export type PublicStorefrontProduct = {
  id: string;
  title: string;
  summary: string;
  preparedFood: boolean;
};

export type PublicStorefrontCategory = {
  id: string;
  name: string;
  description: string;
  products: PublicStorefrontProduct[];
};

export type PublicStorefrontProjection = {
  state: "unset" | "unpublished" | "published" | "unavailable";
  mode: StorefrontMode | null;
  identity: {
    name: string;
    tagline: string;
    mark: string;
    logoIcon: string;
    logoColor: string;
    primaryColor: string;
    accentColor: string;
  } | null;
  location: {
    name: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    countryCode: string;
    phone: string;
    hours: StorefrontHours;
  } | null;
  categories: PublicStorefrontCategory[];
};

type StorefrontSettings = {
  brandName: string;
  brandTagline: string;
  brandMark: string;
  logoIcon?: string;
  logoColor?: string;
  brandPrimaryColor: string;
  brandAccentColor: string;
};

function projectIdentity(settings: StorefrontSettings) {
  const name = settings.brandName.trim();
  const tagline = settings.brandTagline.trim();
  const mark = settings.brandMark.trim().toUpperCase();
  if (!name) return null;
  // The logo colour themes the storefront, as in Restaurant's storefront layout.
  const logoColor = normalizeStoreLogoColor(settings.logoColor);
  const brandHue = (260 + Number.parseInt(logoColor, 10)) % 360;
  return {
    name,
    tagline,
    mark,
    logoIcon: sanitizeStoreLogoSvg(settings.logoIcon ?? ""),
    logoColor,
    primaryColor: `oklch(32% 0.08 ${brandHue})`,
    accentColor: `oklch(82% 0.13 ${brandHue})`,
  };
}

function plainDocumentText(value: unknown): string {
  const parts: string[] = [];
  const visit = (node: unknown, depth: number) => {
    if (depth > 8 || parts.join(" ").length >= 240) return;
    if (Array.isArray(node)) {
      for (const child of node.slice(0, 30)) visit(child, depth + 1);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (typeof record.text === "string") parts.push(record.text.trim());
    for (const key of ["children", "content", "document"]) {
      if (key in record) visit(record[key], depth + 1);
    }
  };
  visit(value, 0);
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, 240);
}

const emptyProjection = (
  state: PublicStorefrontProjection["state"],
): PublicStorefrontProjection => ({
  state,
  mode: null,
  identity: null,
  location: null,
  categories: [],
});

/**
 * Deliberately public and deliberately narrow. It exposes one explicitly
 * published storefront, its location, and active catalog
 * labels. It never projects stock, prices, carts, fulfillment, payments, fuel,
 * loyalty, providers, or provider configuration.
 */
export async function conveniencePublicStorefrontProjection(
  _root: unknown,
  _args: Record<string, never>,
  context: Context,
): Promise<PublicStorefrontProjection> {
  const published = await context.prisma.business.findMany({
    where: { status: "active", storefrontStatus: "published" },
    select: {
      id: true,
      brandName: true,
      brandTagline: true,
      brandMark: true,
      logoIcon: true,
      logoColor: true,
      brandPrimaryColor: true,
      brandAccentColor: true,
      storefrontMode: true,
      storefrontStore: {
        select: {
          id: true,
          businessId: true,
          name: true,
          status: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          stateProvince: true,
          postalCode: true,
          countryCode: true,
          phone: true,
          metadata: true,
        },
      },
    },
    orderBy: { id: "asc" },
    take: 2,
  });

  if (published.length > 1) return emptyProjection("unavailable");
  if (published.length === 1) {
    const settings = published[0];
    const identity = projectIdentity(settings);
    const store = settings.storefrontStore;
    if (
      !identity ||
      !store ||
      store.businessId !== settings.id ||
      store.status !== "active"
    ) {
      return emptyProjection("unavailable");
    }

    const productFilter = {
      businessId: settings.id,
      status: "active" as const,
      variants: {
        some: {
          businessId: settings.id,
          status: "active" as const,
        },
      },
    };
    const categories = await context.prisma.productCategory.findMany({
      where: {
        businessId: settings.id,
        status: "active",
        products: { some: productFilter },
      },
      select: {
        id: true,
        name: true,
        description: true,
        products: {
          where: productFilter,
          select: {
            id: true,
            title: true,
            description: true,
            preparedFood: true,
          },
          orderBy: { title: "asc" },
          take: 12,
        },
      },
      orderBy: { name: "asc" },
      take: 8,
    });

    return {
      state: "published",
      mode: settings.storefrontMode,
      identity,
      location: {
        name: store.name,
        addressLine1: store.addressLine1,
        addressLine2: store.addressLine2,
        city: store.city,
        stateProvince: store.stateProvince,
        postalCode: store.postalCode,
        countryCode: store.countryCode,
        phone: store.phone,
        hours: storefrontHoursFromMetadata(store.metadata),
      },
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        products: category.products.map((product) => ({
          id: product.id,
          title: product.title,
          summary: plainDocumentText(product.description),
          preparedFood: product.preparedFood,
        })),
      })),
    };
  }

  const configuredDraft = await context.prisma.business.findFirst({
    where: {
      status: "active",
      storefrontStatus: "draft",
      brandName: { not: "" },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  return configuredDraft
    ? emptyProjection("unpublished")
    : emptyProjection("unset");
}

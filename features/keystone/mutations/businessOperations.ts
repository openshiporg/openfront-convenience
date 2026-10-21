import { Prisma } from "@prisma/client";
import { sanitizeStoreLogoSvg } from "../../lib/sanitize-store-logo";
import { normalizeStoreLogoColor } from "../../platform/store-settings/lib/store-logo";
import type { Context } from ".keystone/types";

import {
  getStorefrontThemePreset,
  STOREFRONT_THEME_PRESETS,
} from "../../storefront/lib/storefront-theme";
import {
  mergeStorefrontHoursMetadata,
  normalizeStorefrontHours,
  STOREFRONT_DAYS,
  type StorefrontMode,
} from "../../storefront/lib/storefront-settings";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

function boundedText(value: string, label: string, maximum: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > maximum) {
    throw new Error(`${label} must contain 1-${maximum} characters`);
  }
  return normalized;
}

function optionalText(value: string, label: string, maximum: number): string {
  const normalized = value.trim();
  if (normalized.length > maximum) {
    throw new Error(`${label} cannot exceed ${maximum} characters`);
  }
  return normalized;
}

export async function configureBusinessBrand(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      brandName: string;
      brandTagline: string;
      brandMark: string;
      logoIcon?: string;
      logoColor?: string;
      themePreset: string;
      storefrontMode: StorefrontMode;
      storefrontStatus: "draft" | "published";
      addressLine1: string;
      addressLine2: string;
      city: string;
      stateProvince: string;
      postalCode: string;
      countryCode: string;
      phone: string;
      publicHours: unknown;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const logoIcon = args.input.logoIcon === undefined ? undefined : sanitizeStoreLogoSvg(args.input.logoIcon);
  if (args.input.logoIcon && !logoIcon) throw new Error("Invalid SVG format");
  const logoColor = args.input.logoColor === undefined ? undefined : normalizeStoreLogoColor(args.input.logoColor);
  const brandName = boundedText(args.input.brandName, "Brand name", 80);
  const brandTagline = optionalText(
    args.input.brandTagline,
    "Brand tagline",
    160,
  );
  const brandMark =
    (args.input.brandMark ?? "").trim().toUpperCase() ||
    brandName
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z0-9]/g, "").charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 4) ||
    "S";
  if (!/^[A-Z0-9]{1,4}$/.test(brandMark)) {
    throw new Error("Brand mark must contain 1-4 uppercase letters or digits");
  }
  // The storefront is themed from the logo colour; the stored palette is legacy.
  const theme =
    getStorefrontThemePreset(args.input.themePreset ?? "") ??
    STOREFRONT_THEME_PRESETS[0];
  if (!(["demo", "live"] as const).includes(args.input.storefrontMode)) {
    throw new Error("Storefront mode must be demo or live");
  }
  if (!(["draft", "published"] as const).includes(args.input.storefrontStatus)) {
    throw new Error("Storefront status must be draft or published");
  }

  const addressLine1 = optionalText(args.input.addressLine1, "Address", 120);
  const addressLine2 = optionalText(args.input.addressLine2, "Address line 2", 120);
  const city = optionalText(args.input.city, "City", 80);
  const stateProvince = optionalText(
    args.input.stateProvince,
    "State or province",
    80,
  );
  const postalCode = optionalText(args.input.postalCode, "Postal code", 24);
  const countryCode = args.input.countryCode.trim().toUpperCase();
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) {
    throw new Error("Country code must be a two-letter ISO code");
  }
  const phone = optionalText(args.input.phone, "Phone", 40);
  const publicHours = normalizeStorefrontHours(args.input.publicHours);
  const submittedHours =
    args.input.publicHours &&
    typeof args.input.publicHours === "object" &&
    !Array.isArray(args.input.publicHours)
      ? (args.input.publicHours as Record<string, unknown>)
      : {};
  for (const day of STOREFRONT_DAYS) {
    const submitted = submittedHours[day];
    if (typeof submitted !== "string" || submitted.trim().length > 40) {
      throw new Error(`${day} hours must be text up to 40 characters`);
    }
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageBusiness",
    scope: "configureBusinessBrand",
    idempotencyKey: args.input.idempotencyKey,
    input: {
      businessId: args.input.businessId,
      storeId: args.input.storeId,
      brandName,
      brandTagline,
      brandMark,
      ...(logoIcon !== undefined ? { logoIcon } : {}),
      ...(logoColor !== undefined ? { logoColor } : {}),
      themePreset: theme.id,
      storefrontMode: args.input.storefrontMode,
      storefrontStatus: args.input.storefrontStatus,
      addressLine1,
      addressLine2,
      city,
      stateProvince,
      postalCode,
      countryCode,
      phone,
      publicHours,
    },
    resourceType: "Business",
    action: "business.storefront.configure",
    execute: async (transaction) => {
      const business = await transaction.business.findFirst({
        where: { id: args.input.businessId, status: "active" },
        select: { id: true, code: true },
      });
      if (!business) throw new Error("Active business not found");
      const store = await transaction.store.findFirst({
        where: {
          id: args.input.storeId,
          businessId: business.id,
          status: "active",
        },
        select: { id: true, metadata: true },
      });
      if (!store) throw new Error("Active storefront location not found");

      if (args.input.storefrontStatus === "published") {
        const otherPublished = await transaction.business.findFirst({
          where: {
            id: { not: business.id },
            storefrontStatus: "published",
          },
          select: { id: true },
        });
        if (otherPublished) {
          throw new Error(
            "Unpublish the current storefront before publishing another business",
          );
        }
      }

      await transaction.store.update({
        where: { id: store.id },
        data: {
          addressLine1,
          addressLine2,
          city,
          stateProvince,
          postalCode,
          countryCode: countryCode || "US",
          phone,
          metadata: mergeStorefrontHoursMetadata(
            store.metadata,
            publicHours,
          ) as Prisma.InputJsonValue,
        },
      });
      await transaction.business.update({
        where: { id: business.id },
        data: {
          brandName,
          brandTagline,
          brandMark,
          ...(logoIcon !== undefined ? { logoIcon } : {}),
          ...(logoColor !== undefined ? { logoColor } : {}),
          brandPrimaryColor: theme.primaryColor,
          brandAccentColor: theme.accentColor,
          storefrontMode: args.input.storefrontMode,
          storefrontStatus: args.input.storefrontStatus,
          storefrontStoreId: store.id,
        },
      });
      return {
        id: business.id,
        status: args.input.storefrontStatus,
        reference: business.code,
      };
    },
  });
}

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import seed from "../../platform/onboarding/lib/seed.json";
import {
  findStorefrontThemePreset,
  getStorefrontThemePreset,
} from "../../storefront/lib/storefront-theme";
import type { StorefrontMode } from "../../storefront/lib/storefront-settings";
import { DEFAULT_STORE_LOGO_COLOR, DEFAULT_STORE_LOGO_ICON } from "../../platform/store-settings/lib/store-logo";
import {
  canAccessBusiness,
  isHumanPlatformAdmin,
  permissionKeys,
  type Session,
} from "../access";
import {
  buildScopedIdempotencyKey,
  fingerprintInput,
  normalizeIdempotencyKey,
} from "../lib/idempotency";
import { enqueueOperationOutbox } from "../lib/outbox";
import { requireSession } from "./operationRunner";
import { lockOperationAuthority } from "../lib/authorityFence";
import { currentRetailSession } from "../lib/retailCashBoundary";

export type OnboardConvenienceBusinessArgs = {
  input: {
    businessName: string;
    businessCode: string;
    storeName: string;
    storeCode: string;
    timezone?: string | null;
    currencyCode?: string | null;
    standardTaxBasisPoints?: number | null;
    fuelEnabled?: boolean | null;
    brandName?: string | null;
    brandTagline?: string | null;
    brandMark?: string | null;
    brandPrimaryColor?: string | null;
    brandAccentColor?: string | null;
    storefrontMode?: StorefrontMode | null;
    storefrontStatus?: "draft" | "published" | null;
    idempotencyKey: string;
  };
};

export type OnboardingResult = {
  id: string;
  status: string;
  replayed: boolean;
  reference: string;
};

function validateInput(input: OnboardConvenienceBusinessArgs["input"]) {
  const businessName = input.businessName.trim();
  const businessCode = input.businessCode.trim().toLowerCase();
  const storeName = input.storeName.trim();
  const storeCode = input.storeCode.trim().toLowerCase();
  const timezone = input.timezone?.trim() || "America/New_York";
  const currencyCode = (input.currencyCode?.trim() || "USD").toUpperCase();
  const standardTaxBasisPoints = input.standardTaxBasisPoints ?? 0;
  if (!businessName || !storeName) throw new Error("Business and store names are required");
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    throw new Error("Timezone must be a valid IANA timezone, such as America/New_York");
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(businessCode)) throw new Error("Business code must be a lowercase slug between 2 and 63 characters");
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(storeCode)) throw new Error("Store code must be a lowercase slug");
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error("Currency code must be a three-letter ISO 4217 code");
  if (!Number.isSafeInteger(standardTaxBasisPoints) || standardTaxBasisPoints < 0 || standardTaxBasisPoints > 100_000) {
    throw new Error("Standard tax must be integer basis points between 0 and 100000");
  }
  const seedTheme = getStorefrontThemePreset(seed.storefront.themePreset);
  if (!seedTheme) throw new Error("Onboarding storefront theme is invalid");
  // The storefront shows the operator's own business unless they name a brand.
  const brandName = input.brandName?.trim() || businessName;
  const brandTagline = input.brandTagline?.trim() || "";
  const derivedMark = brandName.split(/\s+/).map((word) => word.replace(/[^A-Za-z0-9]/g, "")[0] ?? "").join("").slice(0, 2);
  const brandMark = (
    input.brandMark?.trim() || derivedMark || seed.storefront.mark
  ).toUpperCase();
  const brandPrimaryColor = (
    input.brandPrimaryColor?.trim() || seedTheme.primaryColor
  ).toUpperCase();
  const brandAccentColor = (
    input.brandAccentColor?.trim() || seedTheme.accentColor
  ).toUpperCase();
  const storefrontModeValue = input.storefrontMode ?? seed.storefront.mode;
  const storefrontStatusValue =
    input.storefrontStatus ?? seed.storefront.status;
  if (brandName.length > 80 || brandTagline.length > 160) {
    throw new Error("Brand name or tagline exceeds its supported length");
  }
  if (!brandName || !/^[A-Z0-9]{1,4}$/.test(brandMark)) {
    throw new Error(
      "Storefront settings require a name and a 1-4 character mark",
    );
  }
  if (!findStorefrontThemePreset(brandPrimaryColor, brandAccentColor)) {
    throw new Error("Storefront settings require a supported theme");
  }
  if (storefrontModeValue !== "demo" && storefrontModeValue !== "live") {
    throw new Error("Storefront mode must be demo or live");
  }
  if (
    storefrontStatusValue !== "draft" &&
    storefrontStatusValue !== "published"
  ) {
    throw new Error("Storefront status must be draft or published");
  }
  const storefrontMode: StorefrontMode = storefrontModeValue;
  const storefrontStatus: "draft" | "published" = storefrontStatusValue;
  return {
    businessName,
    businessCode,
    storeName,
    storeCode,
    timezone,
    currencyCode,
    standardTaxBasisPoints,
    fuelEnabled: input.fuelEnabled ?? false,
    brandName,
    brandTagline,
    brandMark,
    brandPrimaryColor,
    brandAccentColor,
    storefrontMode,
    storefrontStatus,
  };
}

function metadataObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Prisma.JsonValue>
    : {};
}

export default async function onboardConvenienceBusiness(
  _root: unknown,
  args: OnboardConvenienceBusinessArgs,
  context: Context,
): Promise<OnboardingResult> {
  const session = requireSession(context) as Session;
  if (session.apiKeyId) throw new Error("Machine sessions cannot run onboarding");
  const input = validateInput(args.input);
  const normalizedKey = normalizeIdempotencyKey(args.input.idempotencyKey);
  const legacyRequestDigest = fingerprintInput({
    businessName: input.businessName,
    businessCode: input.businessCode,
    storeName: input.storeName,
    storeCode: input.storeCode,
    timezone: input.timezone,
    currencyCode: input.currencyCode,
    standardTaxBasisPoints: input.standardTaxBasisPoints,
    fuelEnabled: input.fuelEnabled,
  });
  const requestDigest = fingerprintInput(input);

  const rolePermissions = Object.fromEntries(permissionKeys.map((permission) => [permission, true]));

  return context.prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${session.itemId} FOR SHARE`);
    const user = await transaction.user.findUnique({ where: { id: session.itemId }, select: { id: true, sessionVersion: true, isPlatformAdmin: true, platformAdminApprovedAt: true } });
    if (!user || user.sessionVersion !== session.data.sessionVersion) throw new Error("The signed-in session is no longer current");
    let currentSession: Session = { ...session, data: { ...session.data, isPlatformAdmin: user.isPlatformAdmin, platformAdminApprovedAt: user.platformAdminApprovedAt } };
    const humanPlatformAdmin = isHumanPlatformAdmin(currentSession);
    await transaction.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`onboarding:${input.businessCode}`}))::text AS "locked"`,
    );
    const existingBusiness = await transaction.business.findUnique({ where: { code: input.businessCode } });
    if (existingBusiness) {
      await lockOperationAuthority(transaction, currentSession, existingBusiness.id);
      currentSession = await currentRetailSession(transaction, currentSession, existingBusiness.id, null, "canManageOnboarding", "read");
      if (!humanPlatformAdmin && !canAccessBusiness(currentSession, existingBusiness.id, "canManageOnboarding")) {
        throw new Error("Access denied for this business");
      }
      const businessMetadata = metadataObject(existingBusiness.metadata);
      const priorDigest = businessMetadata.onboardingInputDigest;
      if (typeof priorDigest !== "string") {
        throw new Error("Existing business was not created by deterministic onboarding and cannot be reseeded");
      }
      const digestVersion =
        typeof businessMetadata.onboardingInputDigestVersion === "number"
          ? businessMetadata.onboardingInputDigestVersion
          : 1;
      const expectedDigest =
        digestVersion >= 2 ? requestDigest : legacyRequestDigest;
      if (priorDigest !== expectedDigest) {
        throw new Error("Onboarding business code was already completed with different configuration");
      }
      const store = await transaction.store.findUnique({
        where: { lookupKey: `${existingBusiness.id}:${input.storeCode}` },
        select: { id: true },
      });
      if (!store) throw new Error("Completed onboarding is missing its retained store reference");
      const keyDigest = buildScopedIdempotencyKey(`${existingBusiness.id}:onboardConvenienceBusiness`, normalizedKey);
      const lookupKey = `${existingBusiness.id}:onboardConvenienceBusiness:${keyDigest}`;
      const priorIdempotency = await transaction.idempotencyKey.findUnique({ where: { lookupKey } });
      if (priorIdempotency && priorIdempotency.actorUserId !== user.id) throw new Error("Onboarding command belongs to a different actor");
      if (priorIdempotency && priorIdempotency.requestDigest !== expectedDigest) {
        throw new Error("Onboarding idempotency key was reused with different input");
      }
      const snapshot = { id: existingBusiness.id, status: "completed", reference: store.id };
      if (!priorIdempotency) {
        await transaction.idempotencyKey.create({
          data: {
            businessId: existingBusiness.id,
            scope: "onboardConvenienceBusiness",
            keyDigest,
            lookupKey,
            requestDigest: expectedDigest,
            state: "succeeded",
            responseCode: "ok",
            responseDigest: fingerprintInput(snapshot),
            responseSnapshot: snapshot as Prisma.InputJsonValue,
            startedAt: new Date(),
            completedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            actorUserId: user.id,
          },
        });
      }
      return { ...snapshot, replayed: true };
    }
    if (!humanPlatformAdmin) {
      throw new Error("Only a platform administrator can create a new business");
    }
    await transaction.user.update({ where: { id: user.id }, data: { onboardingStatus: "in_progress" } });
    if (input.storefrontStatus === "published") {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"onboarding:storefront-publication"}))::text AS "locked"`,
      );
      const publishedBusiness = await transaction.business.findFirst({
        where: { storefrontStatus: "published" },
        select: { code: true },
      });
      if (publishedBusiness) {
        throw new Error(
          "A storefront is already published. Choose Draft for this business or unpublish the current storefront before onboarding.",
        );
      }
    }
    const business = await transaction.business.create({
      data: {
        name: input.businessName,
        code: input.businessCode,
        brandName: input.brandName,
        brandTagline: input.brandTagline,
        brandMark: input.brandMark,
        brandPrimaryColor: input.brandPrimaryColor,
        brandAccentColor: input.brandAccentColor,
        // As E-commerce onboarding: a fresh store starts with the default logo and hue.
        logoIcon: DEFAULT_STORE_LOGO_ICON,
        logoColor: DEFAULT_STORE_LOGO_COLOR,
        storefrontMode: input.storefrontMode,
        storefrontStatus: input.storefrontStatus,
        status: "active",
        defaultCurrencyCode: input.currencyCode,
        timezone: input.timezone,
        metadata: {
          onboardingVersion: seed.version,
          onboardingInputDigestVersion: 3,
          onboardingInputDigest: requestDigest,
          onboardingLegacyInputDigest: legacyRequestDigest,
        },
      },
    });

    const storeLookupKey = `${business.id}:${input.storeCode}`;
    const store = await transaction.store.create({
      data: {
        businessId: business.id,
        name: input.storeName,
        code: input.storeCode,
        lookupKey: storeLookupKey,
        status: "active",
        currencyCode: input.currencyCode,
        timezone: input.timezone,
        fuelEnabled: input.fuelEnabled,
        // Address and phone come from the operator in Store Settings, never from sample data.
        countryCode: seed.storefront.contact.countryCode,
        metadata: {
          // Hours stay blank until the operator enters their real hours.
          publicHours: {},
          demoSeedVersion: seed.version,
        },
      },
    });
    await transaction.business.update({
      where: { id: business.id },
      data: { storefrontStoreId: store.id },
    });

    const role = await transaction.role.create({
      data: { businessId: business.id, name: "Owner", description: "Full business owner permissions", ...rolePermissions },
    });
    const employee = await transaction.employee.create({
      data: {
        businessId: business.id,
        userId: user.id,
        roleId: role.id,
        employeeNumber: `OWNER-${user.id.slice(-8).toUpperCase()}`,
        jobTitle: "Owner",
        status: "active",
        stores: { connect: { id: store.id } },
      },
    });

    const locations = [];
    for (const locationSeed of seed.inventoryLocations) {
      locations.push(await transaction.inventoryLocation.upsert({
        where: { lookupKey: `${store.id}:${locationSeed.code}` },
        update: { name: locationSeed.name, status: "active" },
        create: {
          businessId: business.id,
          storeId: store.id,
          name: locationSeed.name,
          code: locationSeed.code,
          lookupKey: `${store.id}:${locationSeed.code}`,
          type: locationSeed.type as "sales_floor" | "back_room",
          status: "active",
        },
      }));
    }
    const salesFloor = locations.find((location) => location.code === "sales-floor")!;
    const priceBook = await transaction.priceBook.upsert({
      where: { lookupKey: `${business.id}:${seed.priceBook.code}` },
      update: { name: seed.priceBook.name, status: "active", stores: { connect: { id: store.id } } },
      create: {
        businessId: business.id,
        name: seed.priceBook.name,
        code: seed.priceBook.code,
        lookupKey: `${business.id}:${seed.priceBook.code}`,
        status: "active",
        currencyCode: input.currencyCode,
        priority: seed.priceBook.priority,
        stores: { connect: { id: store.id } },
      },
    });
    const taxCategories = [];
    for (const categorySeed of seed.taxCategories) {
      taxCategories.push(await transaction.taxCategory.upsert({
        where: { lookupKey: `${business.id}:tax:${categorySeed.code}` },
        update: { name: categorySeed.name, code: categorySeed.code },
        create: { businessId: business.id, name: categorySeed.name, code: categorySeed.code, lookupKey: `${business.id}:tax:${categorySeed.code}` },
      }));
    }
    const standardTaxCategory = taxCategories.find((category) => category.code === "standard")!;
    const taxRate = await transaction.taxRate.findFirst({
      where: { businessId: business.id, storeId: store.id, taxCategoryId: standardTaxCategory.id, jurisdiction: "default" },
    });
    if (taxRate) {
      await transaction.taxRate.update({ where: { id: taxRate.id }, data: { name: "Standard Rate", rateBasisPoints: input.standardTaxBasisPoints, inclusive: false, status: "active" } });
    } else {
      await transaction.taxRate.create({
        data: {
          businessId: business.id,
          storeId: store.id,
          taxCategoryId: standardTaxCategory.id,
          name: "Standard Rate",
          jurisdiction: "default",
          rateBasisPoints: input.standardTaxBasisPoints,
          inclusive: false,
          status: "active",
        },
      });
    }
    const register = await transaction.register.upsert({
      where: { lookupKey: `${store.id}:${seed.register.code}` },
      update: { name: seed.register.name, status: "active" },
      create: { businessId: business.id, storeId: store.id, name: seed.register.name, code: seed.register.code, lookupKey: `${store.id}:${seed.register.code}`, status: "active" },
    });

    const demoCategories = new Map<string, { id: string }>();
    for (const categorySeed of seed.demoCategories) {
      const category = await transaction.productCategory.upsert({
        where: {
          lookupKey: `${business.id}:category:${categorySeed.code}`,
        },
        update: {
          name: categorySeed.name,
          description: categorySeed.description,
          status: "active",
        },
        create: {
          businessId: business.id,
          name: categorySeed.name,
          code: categorySeed.code,
          lookupKey: `${business.id}:category:${categorySeed.code}`,
          description: categorySeed.description,
          status: "active",
          metadata: { demo: true },
        },
        select: { id: true },
      });
      demoCategories.set(categorySeed.code, category);
    }

    for (const productSeed of seed.demoProducts) {
      const category = demoCategories.get(productSeed.categoryCode);
      if (!category) {
        throw new Error(
          `Demo product category is missing: ${productSeed.categoryCode}`,
        );
      }
      const description = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: productSeed.summary }],
          },
        ],
      } as Prisma.InputJsonValue;
      const product = await transaction.product.upsert({
        where: {
          lookupKey: `${business.id}:product:${productSeed.handle}`,
        },
        update: {
          title: productSeed.title,
          description,
          status: "active",
          preparedFood: productSeed.preparedFood,
          taxCategoryId: standardTaxCategory.id,
          categories: { set: [{ id: category.id }] },
          metadata: { demo: true },
        },
        create: {
          businessId: business.id,
          title: productSeed.title,
          handle: productSeed.handle,
          lookupKey: `${business.id}:product:${productSeed.handle}`,
          description,
          status: "active",
          regulatedSaleType: "none",
          preparedFood: productSeed.preparedFood,
          discountable: true,
          returnable: true,
          taxCategoryId: standardTaxCategory.id,
          categories: { connect: [{ id: category.id }] },
          metadata: { demo: true },
        },
      });
      const variant = await transaction.productVariant.upsert({
        where: {
          lookupKey: `${business.id}:variant:${productSeed.sku}`,
        },
        update: {
          productId: product.id,
          title: productSeed.variantTitle,
          status: "active",
          defaultPriceCents: productSeed.defaultPriceCents,
          trackInventory: false,
          metadata: { demo: true },
        },
        create: {
          businessId: business.id,
          productId: product.id,
          title: productSeed.variantTitle,
          sku: productSeed.sku,
          lookupKey: `${business.id}:variant:${productSeed.sku}`,
          status: "active",
          sellBy: "unit",
          unitOfMeasure: "each",
          defaultPriceCents: productSeed.defaultPriceCents,
          trackInventory: false,
          allowNegativeInventory: false,
          metadata: { demo: true },
        },
      });
      await transaction.productBarcode.upsert({
        where: {
          lookupKey: `${business.id}:barcode:${productSeed.barcode}`,
        },
        update: {
          variantId: variant.id,
          status: "active",
          isPrimary: true,
        },
        create: {
          businessId: business.id,
          variantId: variant.id,
          value: productSeed.barcode,
          lookupKey: `${business.id}:barcode:${productSeed.barcode}`,
          format: "internal",
          embeddedDataType: "none",
          isPrimary: true,
          status: "active",
          metadata: { demo: true },
        },
      });
      await transaction.priceBookEntry.upsert({
        where: { lookupKey: `${priceBook.id}:${variant.id}` },
        update: {
          amountCents: productSeed.defaultPriceCents,
          status: "active",
          metadata: { demo: true },
        },
        create: {
          businessId: business.id,
          priceBookId: priceBook.id,
          variantId: variant.id,
          lookupKey: `${priceBook.id}:${variant.id}`,
          amountCents: productSeed.defaultPriceCents,
          minQuantity: "1.0000",
          status: "active",
          metadata: { demo: true },
        },
      });
    }
    await transaction.loyaltyProgram.upsert({
      where: { lookupKey: `${business.id}:loyalty:${seed.loyaltyProgram.code}` },
      update: {
        name: seed.loyaltyProgram.name,
        status: "active",
        pointsPerDollar: seed.loyaltyProgram.pointsPerDollar,
        redemptionPoints: seed.loyaltyProgram.minimumRedemptionPoints,
        redemptionValueCents: seed.loyaltyProgram.redemptionValueCentsPerPoint * seed.loyaltyProgram.minimumRedemptionPoints,
      },
      create: {
        businessId: business.id,
        name: seed.loyaltyProgram.name,
        code: seed.loyaltyProgram.code,
        lookupKey: `${business.id}:loyalty:${seed.loyaltyProgram.code}`,
        status: "active",
        pointsPerDollar: seed.loyaltyProgram.pointsPerDollar,
        redemptionPoints: seed.loyaltyProgram.minimumRedemptionPoints,
        redemptionValueCents: seed.loyaltyProgram.redemptionValueCentsPerPoint * seed.loyaltyProgram.minimumRedemptionPoints,
      },
    });
    await transaction.paymentProvider.upsert({
      where: { lookupKey: `${business.id}:payment:${seed.paymentProvider.code}` },
      update: { name: seed.paymentProvider.name, status: "active", adapterKey: seed.paymentProvider.adapterKey },
      create: {
        businessId: business.id,
        name: seed.paymentProvider.name,
        code: seed.paymentProvider.code,
        lookupKey: `${business.id}:payment:${seed.paymentProvider.code}`,
        status: "active",
        adapterKey: seed.paymentProvider.adapterKey,
        createPaymentFunction: "external_confirmation",
        capturePaymentFunction: "external_confirmation",
        refundPaymentFunction: "external_confirmation",
        getPaymentStatusFunction: "external_confirmation",
        handleWebhookFunction: "manual",
        configuration: { boundary: "externally confirmed references only" },
      },
    });
    if (input.fuelEnabled) {
      const site = await transaction.fuelSite.upsert({
        where: { lookupKey: `${store.id}:${seed.fuelSite.siteCode}` },
        update: { enabled: true, status: "offline", controllerAdapterKey: seed.fuelSite.controllerAdapterKey },
        create: {
          businessId: business.id,
          storeId: store.id,
          name: seed.fuelSite.name,
          siteCode: seed.fuelSite.siteCode,
          lookupKey: `${store.id}:${seed.fuelSite.siteCode}`,
          enabled: true,
          status: "offline",
          controllerAdapterKey: seed.fuelSite.controllerAdapterKey,
          configuration: { boundary: "operator recorded until a controller adapter is configured" },
        },
      });
      const grade = await transaction.fuelGrade.upsert({
        where: { lookupKey: `${site.id}:grade:${seed.fuelSite.gradeCode}` },
        update: { name: seed.fuelSite.gradeName, octaneRating: seed.fuelSite.octaneRating, status: "active" },
        create: {
          businessId: business.id,
          storeId: store.id,
          siteId: site.id,
          name: seed.fuelSite.gradeName,
          code: seed.fuelSite.gradeCode,
          lookupKey: `${site.id}:grade:${seed.fuelSite.gradeCode}`,
          octaneRating: seed.fuelSite.octaneRating,
          productCode: seed.fuelSite.gradeCode,
          status: "active",
        },
      });
      const tank = await transaction.fuelTank.upsert({
        where: { lookupKey: `${site.id}:tank:${seed.fuelSite.tankNumber}` },
        update: { gradeId: grade.id, capacityGallons: seed.fuelSite.tankCapacityGallons },
        create: {
          businessId: business.id,
          storeId: store.id,
          siteId: site.id,
          gradeId: grade.id,
          tankNumber: seed.fuelSite.tankNumber,
          lookupKey: `${site.id}:tank:${seed.fuelSite.tankNumber}`,
          status: "active",
          capacityGallons: seed.fuelSite.tankCapacityGallons,
          currentVolumeGallons: "0.0000",
          waterVolumeGallons: "0.0000",
          ullageGallons: seed.fuelSite.tankCapacityGallons,
        },
      });
      const pump = await transaction.fuelPump.upsert({
        where: { lookupKey: `${site.id}:pump:${seed.fuelSite.pumpNumber}` },
        update: { status: "offline" },
        create: {
          businessId: business.id,
          storeId: store.id,
          siteId: site.id,
          pumpNumber: seed.fuelSite.pumpNumber,
          lookupKey: `${site.id}:pump:${seed.fuelSite.pumpNumber}`,
          status: "offline",
        },
      });
      await transaction.fuelNozzle.upsert({
        where: { lookupKey: `${pump.id}:nozzle:${seed.fuelSite.nozzleNumber}` },
        update: { tankId: tank.id, gradeId: grade.id, status: "offline" },
        create: {
          businessId: business.id,
          storeId: store.id,
          pumpId: pump.id,
          tankId: tank.id,
          gradeId: grade.id,
          nozzleNumber: seed.fuelSite.nozzleNumber,
          lookupKey: `${pump.id}:nozzle:${seed.fuelSite.nozzleNumber}`,
          status: "offline",
        },
      });
    }
    await transaction.store.update({ where: { id: store.id }, data: { defaultPriceBookId: priceBook.id, primaryInventoryLocationId: salesFloor.id } });
    await transaction.user.update({ where: { id: user.id }, data: { onboardingStatus: "completed" } });

    const keyDigest = buildScopedIdempotencyKey(`${business.id}:onboardConvenienceBusiness`, normalizedKey);
    const lookupKey = `${business.id}:onboardConvenienceBusiness:${keyDigest}`;
    const priorIdempotency = await transaction.idempotencyKey.findUnique({ where: { lookupKey } });
    if (priorIdempotency && priorIdempotency.requestDigest !== requestDigest) throw new Error("Onboarding idempotency key was reused with different input");
    const snapshot = { id: business.id, status: "completed", reference: store.id };
    const idempotency = priorIdempotency ?? await transaction.idempotencyKey.create({
      data: {
        businessId: business.id,
        scope: "onboardConvenienceBusiness",
        keyDigest,
        lookupKey,
        requestDigest,
        state: "succeeded",
        responseCode: "ok",
        responseDigest: fingerprintInput(snapshot),
        responseSnapshot: snapshot as Prisma.InputJsonValue,
        startedAt: new Date(),
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        actorUserId: user.id,
      },
    });
    if (!priorIdempotency) {
      await transaction.auditEvent.create({
        data: {
          businessId: business.id,
          storeId: store.id,
          eventNumber: randomUUID(),
          action: "business.onboard",
          resourceType: "Business",
          resourceId: business.id,
          result: "succeeded",
          actorType: "user",
          actorUserId: user.id,
          actorEmployeeId: employee.id,
          idempotencyId: idempotency.id,
          changes: { businessCode: business.code, storeCode: store.code, registerId: register.id, onboardingVersion: seed.version },
          occurredAt: new Date(),
        },
      });
      await enqueueOperationOutbox(transaction, {
        businessId: business.id,
        storeId: store.id,
        idempotencyId: idempotency.id,
        action: "business.onboard",
        resourceType: "Business",
        resourceId: business.id,
        result: snapshot,
      });
    }
    return { ...snapshot, replayed: Boolean(priorIdempotency) };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).catch((error) => {
    const code = (error as { code?: string } | null)?.code;
    if (
      input.storefrontStatus === "published" &&
      (code === "P2002" || code === "P2034")
    ) {
      throw new Error(
        "Storefront publication could not be claimed atomically. Retry with Draft or unpublish the current storefront first.",
      );
    }
    throw error;
  });
}

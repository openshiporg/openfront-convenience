import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";
import { Prisma } from "@prisma/client";

import { assertStorePermission, type Session } from "../access";
import { assertBasisPoints, assertCents } from "../lib/money";
import { assertCatalogLifecycleStatus } from "../lib/catalogLifecycle";
import type { OperationResult } from "./cashOperations";
import { requireSession, runIdempotentOperation } from "./operationRunner";

function slug(value: string, label: string): string {
  const result = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(result))
    throw new Error(`${label} must be a lowercase slug`);
  return result;
}

function sku(value: string): string {
  const result = value.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9._/-]{1,63}$/.test(result))
    throw new Error("SKU must be 2-64 safe characters");
  return result;
}

export async function configureCatalogItem(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      title: string;
      handle: string;
      status: "draft" | "active" | "discontinued";
      regulatedSaleType:
        "none" | "alcohol" | "tobacco" | "lottery" | "otc_medicine" | "other";
      minimumAge?: number | null;
      preparedFood?: boolean | null;
      discountable?: boolean | null;
      returnable?: boolean | null;
      description?: string | null;
      taxCategoryId?: string | null;
      categoryName?: string | null;
      categoryCode?: string | null;
      variantTitle: string;
      sku: string;
      sellBy: "unit" | "weight" | "volume";
      unitOfMeasure: "each" | "lb" | "oz" | "kg" | "g" | "gal" | "l" | "ml";
      defaultPriceCents: number;
      costCents?: number | null;
      trackInventory?: boolean | null;
      allowNegativeInventory?: boolean | null;
      barcode?: string | null;
      barcodeFormat?:
        | "upc_a"
        | "upc_e"
        | "ean_13"
        | "ean_8"
        | "plu"
        | "gs1_databar"
        | "internal"
        | null;
      priceBookId?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (!["draft", "active", "discontinued"].includes(args.input.status)) {
    throw new Error(
      "Catalog item status is not configurable through this operation",
    );
  }
  const title = args.input.title.trim();
  const variantTitle = args.input.variantTitle.trim();
  const handle = slug(args.input.handle, "Product handle");
  const normalizedSku = sku(args.input.sku);
  if (!title || !variantTitle)
    throw new Error("Product and variant titles are required");
  assertCents(args.input.defaultPriceCents, "Default price");
  if (args.input.costCents != null)
    assertCents(args.input.costCents, "Reference cost");
  if (args.input.regulatedSaleType !== "none") {
    if (
      !Number.isSafeInteger(args.input.minimumAge) ||
      Number(args.input.minimumAge) < 1 ||
      Number(args.input.minimumAge) > 120
    ) {
      throw new Error(
        "Operator-configured minimum age is required for a restricted product",
      );
    }
  } else if (args.input.minimumAge != null) {
    throw new Error("Minimum age must be empty for an unrestricted product");
  }
  const barcode = args.input.barcode?.trim() || "";
  if (
    barcode &&
    (!args.input.barcodeFormat ||
      barcode.length > 64 ||
      /[\s\x00-\x1f]/.test(barcode))
  ) {
    throw new Error(
      "Barcode requires a format and at most 64 non-whitespace characters",
    );
  }
  const categoryCode = args.input.categoryCode
    ? slug(args.input.categoryCode, "Category code")
    : "";
  if (Boolean(args.input.categoryName?.trim()) !== Boolean(categoryCode)) {
    throw new Error("Category name and code must be provided together");
  }
  const session = requireSession(context) as Session;
  assertStorePermission(
    session,
    args.input.businessId,
    args.input.storeId,
    "canManageCatalog",
  );
  if (args.input.priceBookId) {
    assertStorePermission(
      session,
      args.input.businessId,
      args.input.storeId,
      "canManagePricing",
    );
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageCatalog",
    scope: "configureCatalogItem",
    idempotencyKey: args.input.idempotencyKey,
    input: {
      ...args.input,
      title,
      variantTitle,
      handle,
      sku: normalizedSku,
      barcode,
      categoryCode,
    },
    resourceType: "ProductVariant",
    action: "catalog_item.configure",
    execute: async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`checkout-policy:${args.input.businessId}`}))::text AS "locked"`,
      );
      const [store, taxCategory, priceBook] = await Promise.all([
        transaction.store.findFirst({
          where: {
            id: args.input.storeId,
            businessId: args.input.businessId,
            status: "active",
          },
        }),
        args.input.taxCategoryId
          ? transaction.taxCategory.findFirst({
              where: {
                id: args.input.taxCategoryId,
                businessId: args.input.businessId,
              },
            })
          : null,
        args.input.priceBookId
          ? transaction.priceBook.findFirst({
              where: {
                id: args.input.priceBookId,
                businessId: args.input.businessId,
                status: "active",
                stores: { some: { id: args.input.storeId } },
              },
            })
          : null,
      ]);
      if (!store)
        throw new Error(
          "Active catalog store does not belong to this business",
        );
      if (args.input.taxCategoryId && !taxCategory)
        throw new Error("Tax category does not belong to this business");
      if (
        args.input.priceBookId &&
        (!priceBook || priceBook.currencyCode !== store.currencyCode)
      ) {
        throw new Error(
          "Active price book must belong to this store and use its currency",
        );
      }
      const productLookupKey = `${args.input.businessId}:product:${handle}`;
      const existingProduct = await transaction.product.findUnique({
        where: { lookupKey: productLookupKey },
      });
      const variantLookupKey = `${args.input.businessId}:variant:${normalizedSku}`;
      const existingVariant = await transaction.productVariant.findUnique({
        where: { lookupKey: variantLookupKey },
      });
      if (
        existingVariant &&
        existingVariant.productId !== existingProduct?.id
      ) {
        throw new Error("SKU is already assigned to another product");
      }
      assertCatalogLifecycleStatus(
        {
          productStatus: existingProduct?.status,
          variantStatus: existingVariant?.status,
        },
        args.input.status,
      );
      const category = categoryCode
        ? await transaction.productCategory.upsert({
            where: {
              lookupKey: `${args.input.businessId}:category:${categoryCode}`,
            },
            update: { name: args.input.categoryName!.trim(), status: "active" },
            create: {
              businessId: args.input.businessId,
              name: args.input.categoryName!.trim(),
              code: categoryCode,
              lookupKey: `${args.input.businessId}:category:${categoryCode}`,
              status: "active",
            },
          })
        : null;
      const productData = {
        title,
        handle,
        status: args.input.status,
        regulatedSaleType: args.input.regulatedSaleType,
        minimumAge:
          args.input.regulatedSaleType === "none"
            ? null
            : args.input.minimumAge,
        preparedFood: args.input.preparedFood ?? false,
        discountable: args.input.discountable ?? true,
        returnable: args.input.returnable ?? true,
        taxCategoryId: taxCategory?.id ?? null,
        ...(category ? { categories: { connect: { id: category.id } } } : {}),
        // Plain text from the platform form, stored as one Keystone document
        // paragraph per line; omitted means "leave the description as it is".
        ...(args.input.description == null
          ? {}
          : {
              description: args.input.description
                .slice(0, 4000)
                .split(/\r?\n/)
                .map((line) => ({ type: "paragraph", children: [{ text: line }] })),
            }),
      };
      const product = existingProduct
        ? await transaction.product.update({
            where: { id: existingProduct.id },
            data: productData,
          })
        : await transaction.product.create({
            data: {
              businessId: args.input.businessId,
              lookupKey: productLookupKey,
              ...productData,
            },
          });
      const variantData = {
        productId: product.id,
        title: variantTitle,
        sku: normalizedSku,
        status:
          args.input.status === "active"
            ? ("active" as const)
            : args.input.status === "discontinued"
              ? ("discontinued" as const)
              : ("unavailable" as const),
        sellBy: args.input.sellBy,
        unitOfMeasure: args.input.unitOfMeasure,
        defaultPriceCents: args.input.defaultPriceCents,
        costCents: args.input.costCents ?? null,
        trackInventory: args.input.trackInventory ?? true,
        allowNegativeInventory: args.input.allowNegativeInventory ?? false,
      };
      const variant = existingVariant
        ? await transaction.productVariant.update({
            where: { id: existingVariant.id },
            data: variantData,
          })
        : await transaction.productVariant.create({
            data: {
              businessId: args.input.businessId,
              lookupKey: variantLookupKey,
              ...variantData,
            },
          });
      if (barcode) {
        const barcodeLookupKey = `${args.input.businessId}:barcode:${barcode}`;
        const existingBarcode = await transaction.productBarcode.findUnique({
          where: { lookupKey: barcodeLookupKey },
        });
        if (existingBarcode && existingBarcode.variantId !== variant.id) {
          throw new Error("Barcode is already assigned to another variant");
        }
        await transaction.productBarcode.updateMany({
          where: {
            businessId: args.input.businessId,
            variantId: variant.id,
            isPrimary: true,
          },
          data: { isPrimary: false },
        });
        await transaction.productBarcode.upsert({
          where: { lookupKey: barcodeLookupKey },
          update: {
            variantId: variant.id,
            format: args.input.barcodeFormat!,
            status: "active",
            isPrimary: true,
          },
          create: {
            businessId: args.input.businessId,
            variantId: variant.id,
            value: barcode,
            lookupKey: barcodeLookupKey,
            format: args.input.barcodeFormat!,
            embeddedDataType: "none",
            isPrimary: true,
            status: "active",
          },
        });
      }
      if (priceBook) {
        await transaction.priceBookEntry.upsert({
          where: { lookupKey: `${priceBook.id}:${variant.id}` },
          update: {
            amountCents: args.input.defaultPriceCents,
            status: "active",
          },
          create: {
            businessId: args.input.businessId,
            priceBookId: priceBook.id,
            variantId: variant.id,
            lookupKey: `${priceBook.id}:${variant.id}`,
            amountCents: args.input.defaultPriceCents,
            status: "active",
            minQuantity: "1.0000",
          },
        });
      }
      return {
        id: variant.id,
        status: variant.status,
        reference: normalizedSku,
      };
    },
  });
}

export async function configureStoreTaxRate(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      categoryName: string;
      categoryCode: string;
      rateName: string;
      jurisdiction: string;
      rateBasisPoints: number;
      inclusive?: boolean | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const categoryCode = slug(args.input.categoryCode, "Tax category code");
  const categoryName = args.input.categoryName.trim();
  const rateName = args.input.rateName.trim();
  const jurisdiction = args.input.jurisdiction.trim();
  if (!categoryName || !rateName || !jurisdiction)
    throw new Error("Tax category, rate name, and jurisdiction are required");
  assertBasisPoints(args.input.rateBasisPoints, "Tax rate");
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePricing",
    scope: "configureStoreTaxRate",
    idempotencyKey: args.input.idempotencyKey,
    input: {
      ...args.input,
      categoryCode,
      categoryName,
      rateName,
      jurisdiction,
    },
    resourceType: "TaxRate",
    action: "tax_rate.configure",
    execute: async (transaction) => {
      const store = await transaction.store.findFirst({
        where: { id: args.input.storeId, businessId: args.input.businessId },
      });
      if (!store) throw new Error("Store does not belong to this business");
      const category = await transaction.taxCategory.upsert({
        where: { lookupKey: `${args.input.businessId}:tax:${categoryCode}` },
        update: { name: categoryName, code: categoryCode },
        create: {
          businessId: args.input.businessId,
          name: categoryName,
          code: categoryCode,
          lookupKey: `${args.input.businessId}:tax:${categoryCode}`,
        },
      });
      const existing = await transaction.taxRate.findFirst({
        where: {
          businessId: args.input.businessId,
          storeId: store.id,
          taxCategoryId: category.id,
          jurisdiction,
        },
      });
      const incompatibleJurisdiction = await transaction.taxRate.findFirst({
        where: {
          businessId: args.input.businessId,
          storeId: store.id,
          taxCategoryId: category.id,
          status: "active",
          jurisdiction: { not: jurisdiction },
        },
        select: { id: true, jurisdiction: true },
      });
      if (incompatibleJurisdiction) {
        throw new Error(
          "Configure one verified composite tax rate per store and category; separate jurisdiction components are not evaluated by checkout",
        );
      }
      const inclusive = args.input.inclusive ?? false;
      const incompatibleRate = await transaction.taxRate.findFirst({
        where: {
          businessId: args.input.businessId,
          storeId: store.id,
          status: "active",
          inclusive: { not: inclusive },
          ...(existing ? { id: { not: existing.id } } : {}),
        },
        select: { id: true },
      });
      if (incompatibleRate)
        throw new Error(
          "All active tax rates for a store must use its single tax-inclusion mode",
        );
      const data = {
        name: rateName,
        jurisdiction,
        rateBasisPoints: args.input.rateBasisPoints,
        inclusive,
        status: "active" as const,
      };
      const rate = existing
        ? await transaction.taxRate.update({ where: { id: existing.id }, data })
        : await transaction.taxRate.create({
            data: {
              businessId: args.input.businessId,
              storeId: store.id,
              taxCategoryId: category.id,
              ...data,
            },
          });
      await transaction.store.update({
        where: { id: store.id },
        data: { pricesIncludeTax: inclusive },
      });
      return {
        id: rate.id,
        status: rate.status,
        reference: `${categoryCode}:${jurisdiction}`,
      };
    },
  });
}

export async function configurePromotion(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeIds: string[];
      name: string;
      code?: string | null;
      status: "draft" | "scheduled" | "active" | "paused";
      startsAt?: string | null;
      endsAt?: string | null;
      stackable?: boolean | null;
      ruleType:
        | "item_discount"
        | "basket_discount"
        | "quantity_break"
        | "buy_x_get_y"
        | "mix_and_match";
      benefitMethod:
        "percentage" | "fixed_amount" | "fixed_price" | "free_item";
      valueBasisPoints?: number | null;
      valueCents?: number | null;
      minQuantity?: string | null;
      productIds?: string[] | null;
      categoryIds?: string[] | null;
      usageLimit?: number | null;
      perCustomerLimit?: number | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (!["draft", "scheduled", "active", "paused"].includes(args.input.status)) {
    throw new Error(
      "Promotion status is not configurable through this operation",
    );
  }
  if (
    !["item_discount", "basket_discount", "quantity_break"].includes(
      args.input.ruleType,
    )
  ) {
    throw new Error(
      "Promotion rule type is not supported by the controlled POS evaluator",
    );
  }
  const name = args.input.name.trim();
  const code = args.input.code?.trim().toUpperCase() || "";
  if (!name) throw new Error("Promotion name is required");
  if (code && !/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(code))
    throw new Error("Promotion code must be 2-32 safe characters");
  if (args.input.valueBasisPoints != null)
    assertBasisPoints(args.input.valueBasisPoints, "Promotion percentage");
  if (args.input.valueCents != null)
    assertCents(args.input.valueCents, "Promotion amount");
  if (
    args.input.benefitMethod === "percentage" &&
    args.input.valueBasisPoints == null
  )
    throw new Error("Percentage promotions require basis points");
  if (
    ["fixed_amount", "fixed_price"].includes(args.input.benefitMethod) &&
    args.input.valueCents == null
  )
    throw new Error("Fixed promotions require an amount in cents");
  const startsAt = args.input.startsAt ? new Date(args.input.startsAt) : null;
  const endsAt = args.input.endsAt ? new Date(args.input.endsAt) : null;
  if (
    (startsAt && !Number.isFinite(startsAt.getTime())) ||
    (endsAt && !Number.isFinite(endsAt.getTime()))
  )
    throw new Error("Promotion dates must be ISO timestamps");
  if (startsAt && endsAt && endsAt <= startsAt)
    throw new Error("Promotion end must follow its start");
  for (const [label, value] of [
    ["Promotion usage limit", args.input.usageLimit],
    ["Per-customer promotion limit", args.input.perCustomerLimit],
  ] as const) {
    if (
      value != null &&
      (!Number.isSafeInteger(value) || value < 1 || value > 1_000_000)
    ) {
      throw new Error(`${label} must be an integer from 1 to 1000000`);
    }
  }
  if (
    args.input.usageLimit != null &&
    args.input.perCustomerLimit != null &&
    args.input.perCustomerLimit > args.input.usageLimit
  ) {
    throw new Error(
      "Per-customer promotion limit cannot exceed the global usage limit",
    );
  }
  if (!args.input.storeIds.length)
    throw new Error("Promotion requires at least one assigned store");
  const session = requireSession(context) as Session;
  for (const storeId of new Set(args.input.storeIds)) {
    assertStorePermission(
      session,
      args.input.businessId,
      storeId,
      "canManagePromotions",
    );
  }
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManagePromotions",
    scope: "configurePromotion",
    idempotencyKey: args.input.idempotencyKey,
    input: {
      ...args.input,
      name,
      code,
      startsAt: startsAt?.toISOString() ?? null,
      endsAt: endsAt?.toISOString() ?? null,
    },
    resourceType: "Promotion",
    action: "promotion.configure",
    execute: async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`checkout-policy:${args.input.businessId}`}))::text AS "locked"`,
      );
      const stores = await transaction.store.findMany({
        where: {
          businessId: args.input.businessId,
          id: { in: args.input.storeIds },
        },
        select: { id: true },
      });
      if (stores.length !== new Set(args.input.storeIds).size)
        throw new Error(
          "One or more promotion stores do not belong to this business",
        );
      const products = await transaction.product.findMany({
        where: {
          businessId: args.input.businessId,
          id: { in: args.input.productIds ?? [] },
        },
        select: { id: true },
      });
      if (products.length !== new Set(args.input.productIds ?? []).size)
        throw new Error(
          "One or more promotion products do not belong to this business",
        );
      const categories = await transaction.productCategory.findMany({
        where: {
          businessId: args.input.businessId,
          id: { in: args.input.categoryIds ?? [] },
        },
        select: { id: true },
      });
      if (categories.length !== new Set(args.input.categoryIds ?? []).size)
        throw new Error(
          "One or more promotion categories do not belong to this business",
        );
      const lookupKey = `${args.input.businessId}:promotion:${code || slug(name, "Promotion name")}`;
      const existing = await transaction.promotion.findUnique({
        where: { lookupKey },
      });
      if (existing) {
        await transaction.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`promotion:${existing.id}`}))::text AS "locked"`,
        );
      }
      const revision = randomUUID();
      const existingMetadata =
        existing?.metadata &&
        typeof existing.metadata === "object" &&
        !Array.isArray(existing.metadata)
          ? (existing.metadata as Record<string, unknown>)
          : {};
      const promotionData = {
        name,
        code,
        status: args.input.status,
        stackable: args.input.stackable ?? false,
        requiresCode: Boolean(code),
        startsAt,
        endsAt,
        usageLimit: args.input.usageLimit ?? null,
        perCustomerLimit: args.input.perCustomerLimit ?? null,
        metadata: { ...existingMetadata, revision },
      };
      const promotion = existing
        ? await transaction.promotion.update({
            where: { id: existing.id },
            data: {
              ...promotionData,
              stores: { set: stores.map(({ id }) => ({ id })) },
            },
          })
        : await transaction.promotion.create({
            data: {
              businessId: args.input.businessId,
              lookupKey,
              ...promotionData,
              stores: { connect: stores.map(({ id }) => ({ id })) },
            },
          });
      await transaction.promotionRule.deleteMany({
        where: { promotionId: promotion.id },
      });
      await transaction.promotionRule.create({
        data: {
          businessId: args.input.businessId,
          promotionId: promotion.id,
          name: `${name} rule`,
          priority: 0,
          ruleType: args.input.ruleType,
          benefitMethod: args.input.benefitMethod,
          valueBasisPoints: args.input.valueBasisPoints ?? null,
          valueCents: args.input.valueCents ?? null,
          minQuantity: args.input.minQuantity || null,
          products: { connect: products.map(({ id }) => ({ id })) },
          categories: { connect: categories.map(({ id }) => ({ id })) },
        },
      });
      return {
        id: promotion.id,
        status: promotion.status,
        reference: code || promotion.id,
      };
    },
  });
}

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import type { Session } from "../access";
import { retailPaymentContext } from "../../integrations/payment/authority";
import { assertCashLedger, assertRetailRegister, retailRegisterInclude, retailRegisterLockKey } from "../lib/retailCashBoundary";
import { getPaymentProviderAdapter } from "../utils/paymentProviderAdapter";
import {
  admitManagerPinAttempt,
  requireManagerPinAuthority,
} from "../lib/managerAuthority";
import { calculateLineAmounts, rateToPpm, sumAppliedTenders } from "../lib/money";
import {
  addQuantities,
  compareQuantities,
  normalizeQuantity,
} from "../lib/quantity";
import {
  assertSellQuantity,
  findEffectivePriceEntry,
  findEffectiveTaxRate,
} from "../lib/retailPricing";
import { consumeInventoryLots } from "./inventoryPosting";
import {
  allocateLoyaltyRedemption,
  availableLoyaltyPoints,
} from "./loyaltyOperations";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

const MAX_POS_CART_LINES = 250;
const MAX_POS_TENDERS = 20;

type BaseInput = {
  businessId: string;
  storeId: string;
  idempotencyKey: string;
};

type TenderInput = {
  method:
    | "cash"
    | "credit_card"
    | "debit_card"
    | "mobile_wallet"
    | "gift_card"
    | "ebt_snap"
    | "fleet_card"
    | "house_account"
    | "other";
  amountCents: number;
  tenderedCents?: number | null;
  paymentProviderId?: string | null;
  providerPaymentId?: string | null;
  providerAuthority?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
};

function assertCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of cents`);
  }
}

async function requirePosCorrectionAuthority(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    storeId: string;
    employeeId: string;
    managerPin: string;
    reason: string;
  },
) {
  const reason = input.reason.trim();
  if (reason.length < 4 || reason.length > 500)
    throw new Error("POS correction reason must contain 4-500 characters");
  const employee = await requireManagerPinAuthority(
    transaction,
    input,
    "POS line corrections",
  );
  return { employee, reason };
}

async function recalculateCart(
  transaction: Prisma.TransactionClient,
  cartId: string,
) {
  const aggregate = await transaction.cartLine.aggregate({
    where: { cartId },
    _sum: {
      subtotalCents: true,
      discountCents: true,
      taxCents: true,
      totalCents: true,
    },
  });

  return transaction.cart.update({
    where: { id: cartId },
    data: {
      subtotalCents: aggregate._sum.subtotalCents ?? 0,
      discountCents: aggregate._sum.discountCents ?? 0,
      taxCents: aggregate._sum.taxCents ?? 0,
      totalCents: aggregate._sum.totalCents ?? 0,
    },
  });
}

export async function createPosCart(
  _root: unknown,
  args: {
    input: BaseInput & {
      registerSessionId: string;
      cashierId: string;
      customerId?: string | null;
      loyaltyAccountId?: string | null;
    };
  },
  context: Context,
): Promise<OperationResult> {
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageSales",
    scope: "createPosCart",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "Cart",
    action: "cart.create",
    execute: async (transaction, idempotencyId) => {
      const store = await transaction.store.findFirst({
        where: {
          id: args.input.storeId,
          businessId: args.input.businessId,
          status: "active",
        },
      });
      if (!store) throw new Error("Active store not found for this business");

      const priceBook = store.defaultPriceBookId
        ? await transaction.priceBook.findFirst({
            where: {
              id: store.defaultPriceBookId,
              businessId: args.input.businessId,
              status: "active",
              currencyCode: store.currencyCode,
              stores: { some: { id: store.id } },
            },
          })
        : null;
      if (store.defaultPriceBookId && !priceBook) {
        throw new Error(
          "Store default price book must be active, assigned, and use the store currency",
        );
      }

      const registerSession = await transaction.registerSession.findFirst({
        where: {
          id: args.input.registerSessionId,
          businessId: args.input.businessId,
          storeId: store.id,
          status: "open",
        },
      });
      if (!registerSession) throw new Error("Open register session not found");

      const cashier = await transaction.employee.findFirst({
        where: {
          id: args.input.cashierId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: store.id } },
        },
      });
      if (!cashier)
        throw new Error("Active cashier is not assigned to this store");

      if (args.input.customerId) {
        const customer = await transaction.user.findUnique({
          where: { id: args.input.customerId },
          select: { id: true },
        });
        if (!customer) throw new Error("Customer not found");
      }

      let customerId = args.input.customerId ?? null;
      if (args.input.loyaltyAccountId) {
        const account = await transaction.loyaltyAccount.findFirst({
          where: {
            id: args.input.loyaltyAccountId,
            businessId: args.input.businessId,
            status: "active",
          },
          select: { id: true, userId: true },
        });
        if (!account)
          throw new Error("Active loyalty account not found for this business");
        if (customerId && account.userId && customerId !== account.userId) {
          throw new Error(
            "Cart customer does not match the selected loyalty account",
          );
        }
        customerId ??= account.userId;
      }

      const cart = await transaction.cart.create({
        data: {
          businessId: args.input.businessId,
          storeId: store.id,
          cartNumber: `CART-${randomUUID()}`,
          source: "pos",
          status: "open",
          currencyCode: store.currencyCode,
          registerSessionId: registerSession.id,
          cashierId: cashier.id,
          customerId,
          loyaltyAccountId: args.input.loyaltyAccountId ?? null,
          priceBookId: priceBook?.id ?? null,
          metadata: { idempotencyId },
        },
      });

      return { id: cart.id, status: cart.status, reference: cart.cartNumber };
    },
  });
}

export async function addPosCartLine(
  _root: unknown,
  args: {
    input: BaseInput & {
      cartId: string;
      barcode?: string | null;
      variantId?: string | null;
      quantity: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const quantity = normalizeQuantity(args.input.quantity);
  if (compareQuantities(quantity, "0") <= 0) {
    throw new Error("Cart line quantity must be greater than zero");
  }
  if (!args.input.barcode?.trim() && !args.input.variantId) {
    throw new Error("A barcode or variant ID is required");
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageSales",
    scope: "addPosCartLine",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, quantity },
    resourceType: "CartLine",
    action: "cart.line.add",
    execute: async (transaction, idempotencyId) => {
      const cart = await transaction.cart.findFirst({
        where: {
          id: args.input.cartId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "open",
        },
        include: { store: true },
      });
      if (!cart || !cart.store)
        throw new Error(
          "Open cart and store not found for this business and store",
        );
      const lineCount = await transaction.cartLine.count({
        where: { cartId: cart.id },
      });
      if (lineCount >= MAX_POS_CART_LINES)
        throw new Error(`POS cart cannot exceed ${MAX_POS_CART_LINES} lines`);

      const barcodeValue = args.input.barcode?.trim();
      const barcode = barcodeValue
        ? await transaction.productBarcode.findFirst({
            where: {
              businessId: args.input.businessId,
              value: barcodeValue,
              status: "active",
            },
            include: {
              variant: { include: { product: true } },
            },
          })
        : null;

      const variant =
        barcode?.variant ??
        (args.input.variantId
          ? await transaction.productVariant.findFirst({
              where: {
                id: args.input.variantId,
                businessId: args.input.businessId,
                status: "active",
              },
              include: { product: true },
            })
          : null);

      const product = variant?.product;
      if (
        !variant ||
        variant.status !== "active" ||
        !product ||
        product.status !== "active" ||
        (barcode && barcode.status !== "active")
      ) {
        throw new Error("Active saleable product variant not found");
      }
      const sellQuantity = assertSellQuantity(variant.sellBy, quantity);
      if (
        barcode &&
        args.input.variantId &&
        barcode.variantId !== args.input.variantId
      ) {
        throw new Error("Barcode does not identify the requested variant");
      }

      const now = new Date();
      const priceEntry = cart.priceBookId
        ? await findEffectivePriceEntry(transaction, {
            businessId: args.input.businessId,
            priceBookId: cart.priceBookId,
            variantId: variant.id,
            quantity: sellQuantity,
            at: now,
          })
        : null;

      const unitPriceCents =
        priceEntry?.amountCents ?? variant.defaultPriceCents;
      assertCents(unitPriceCents, "Unit price");

      const taxRate = await findEffectiveTaxRate(transaction, {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        taxCategoryId: product.taxCategoryId,
        at: now,
      });

      if (taxRate && taxRate.inclusive !== cart.store.pricesIncludeTax) {
        throw new Error(
          "Product tax mode does not match the store price-inclusion setting",
        );
      }
      const amounts = calculateLineAmounts({
        unitPriceCents,
        quantity,
        taxRate: taxRate?.rate ?? 0,
        taxInclusive: taxRate?.inclusive ?? false,
      });

      const line = await transaction.cartLine.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          cartId: cart.id,
          variantId: variant.id,
          barcodeId: barcode?.id ?? null,
          priceBookEntryId: priceEntry?.id ?? null,
          titleSnapshot: product.title,
          variantTitleSnapshot: variant.title,
          skuSnapshot: variant.sku,
          barcodeSnapshot: barcode?.value ?? barcodeValue ?? "",
          quantity: sellQuantity,
          unitOfMeasure: variant.unitOfMeasure,
          unitPriceCents,
          subtotalCents: amounts.subtotalCents,
          discountCents: amounts.discountCents,
          taxRate: taxRate?.rate ?? 0,
          taxInclusive: taxRate?.inclusive ?? false,
          taxCents: amounts.taxCents,
          totalCents: amounts.totalCents,
          priceSource: priceEntry ? "price_book" : "variant_default",
          ageRestricted: product.regulatedSaleType !== "none",
          minimumAge: product.minimumAge,
          metadata: { idempotencyId },
        },
      });

      const updatedCart = await recalculateCart(transaction, cart.id);
      return {
        id: line.id,
        status: updatedCart.status,
        reference: updatedCart.cartNumber,
      };
    },
  });
}

type DraftCartLineOverride = {
  quantity: string;
  unitPriceCents: number;
  priceBookEntryId: string | null;
  priceSource: "price_book" | "variant_default";
  taxRate: number;
  taxInclusive: boolean;
};

async function resetDraftCartPromotions(
  transaction: Prisma.TransactionClient,
  cartId: string,
  overrides: Map<string, DraftCartLineOverride> = new Map(),
) {
  const lines = await transaction.cartLine.findMany({ where: { cartId } });
  for (const line of lines) {
    const override = overrides.get(line.id);
    const quantity = override?.quantity ?? line.quantity.toString();
    const unitPriceCents = override?.unitPriceCents ?? line.unitPriceCents;
    const lineTaxRate = override?.taxRate ?? line.taxRate ?? 0;
    const taxInclusive = override?.taxInclusive ?? line.taxInclusive;
    const amounts = calculateLineAmounts({
      unitPriceCents,
      quantity,
      taxRate: lineTaxRate,
      taxInclusive,
    });
    const existingMetadata =
      line.metadata &&
      typeof line.metadata === "object" &&
      !Array.isArray(line.metadata)
        ? (line.metadata as Record<string, unknown>)
        : {};
    const metadata = Object.fromEntries(
      Object.entries(existingMetadata).filter(
        ([key]) => key !== "promotionAllocations",
      ),
    );
    await transaction.cartLine.update({
      where: { id: line.id },
      data: {
        quantity,
        unitPriceCents,
        ...(override
          ? {
              priceBookEntryId: override.priceBookEntryId,
              priceSource: override.priceSource,
              taxRate: lineTaxRate,
              taxInclusive,
            }
          : {}),
        subtotalCents: amounts.subtotalCents,
        discountCents: 0,
        taxCents: amounts.taxCents,
        totalCents: amounts.totalCents,
        promotions: { set: [] },
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }
  await transaction.cart.update({
    where: { id: cartId },
    data: { promotions: { set: [] } },
  });
  return recalculateCart(transaction, cartId);
}

export async function updatePosCartLine(
  _root: unknown,
  args: {
    input: BaseInput & {
      cartId: string;
      cartLineId: string;
      quantity: string;
      employeeId: string;
      managerPin: string;
      reason: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const quantity = normalizeQuantity(args.input.quantity);
  if (compareQuantities(quantity, "0") <= 0)
    throw new Error("Cart line quantity must be greater than zero");
  await admitManagerPinAttempt(
    context.prisma,
    context.session as Session | undefined,
    args.input,
    "POS line corrections",
    "canManageSales",
  );
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageSales",
    scope: "updatePosCartLine",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, quantity },
    resourceType: "CartLine",
    action: "cart.line.update",
    execute: async (transaction) => {
      await requirePosCorrectionAuthority(transaction, args.input);
      const line = await transaction.cartLine.findFirst({
        where: {
          id: args.input.cartLineId,
          cartId: args.input.cartId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          cart: { status: "open" },
        },
        include: {
          cart: { include: { store: true } },
          variant: { include: { product: true } },
        },
      });
      if (!line?.cart?.store || !line.variant?.product)
        throw new Error("Open cart line and product were not found");
      if (
        line.variant.status !== "active" ||
        line.variant.product.status !== "active"
      ) {
        throw new Error("Unavailable products cannot be corrected for sale");
      }
      const sellQuantity = assertSellQuantity(line.variant.sellBy, quantity);
      const now = new Date();
      const priceEntry = line.cart.priceBookId
        ? await findEffectivePriceEntry(transaction, {
            businessId: args.input.businessId,
            priceBookId: line.cart.priceBookId,
            variantId: line.variant.id,
            quantity: sellQuantity,
            at: now,
          })
        : null;
      const taxRate = await findEffectiveTaxRate(transaction, {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        taxCategoryId: line.variant.product.taxCategoryId,
        at: now,
      });
      if (
        taxRate &&
        taxRate.inclusive !== line.cart.store.pricesIncludeTax
      ) {
        throw new Error(
          "Product tax mode does not match the store price-inclusion setting",
        );
      }
      const unitPriceCents =
        priceEntry?.amountCents ?? line.variant.defaultPriceCents;
      assertCents(unitPriceCents, "Unit price");
      const priceOverride: DraftCartLineOverride = {
        quantity: sellQuantity,
        unitPriceCents,
        priceBookEntryId: priceEntry?.id ?? null,
        priceSource: priceEntry ? "price_book" : "variant_default",
        taxRate: taxRate?.rate ?? 0,
        taxInclusive: taxRate?.inclusive ?? false,
      };
      const cart = await resetDraftCartPromotions(
        transaction,
        line.cart.id,
        new Map<string, DraftCartLineOverride>([[line.id, priceOverride]]),
      );
      return { id: line.id, status: cart.status, reference: cart.cartNumber };
    },
  });
}

export async function removePosCartLine(
  _root: unknown,
  args: {
    input: BaseInput & {
      cartId: string;
      cartLineId: string;
      employeeId: string;
      managerPin: string;
      reason: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  await admitManagerPinAttempt(
    context.prisma,
    context.session as Session | undefined,
    args.input,
    "POS line corrections",
    "canManageSales",
  );
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageSales",
    scope: "removePosCartLine",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "CartLine",
    action: "cart.line.remove",
    execute: async (transaction) => {
      await requirePosCorrectionAuthority(transaction, args.input);
      const line = await transaction.cartLine.findFirst({
        where: {
          id: args.input.cartLineId,
          cartId: args.input.cartId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          cart: { status: "open" },
        },
        include: { cart: true },
      });
      if (!line?.cart) throw new Error("Open cart line not found");
      await transaction.cartLine.delete({ where: { id: line.id } });
      const cart = await resetDraftCartPromotions(transaction, line.cart.id);
      return { id: line.id, status: cart.status, reference: cart.cartNumber };
    },
  });
}

export async function transitionPosCart(
  _root: unknown,
  args: {
    input: BaseInput & {
      cartId: string;
      nextStatus: "open" | "held" | "voided" | "abandoned";
      reason?: string | null;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (
    ["voided", "abandoned"].includes(args.input.nextStatus) &&
    !args.input.reason?.trim()
  ) {
    throw new Error("A reason is required to void or abandon a cart");
  }
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageSales",
    scope: "transitionPosCart",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "Cart",
    action: "cart.transition",
    execute: async (transaction) => {
      const cart = await transaction.cart.findFirst({
        where: {
          id: args.input.cartId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
      });
      if (!cart) throw new Error("Cart not found");
      if (cart.status === args.input.nextStatus) {
        return { id: cart.id, status: cart.status, reference: cart.cartNumber };
      }
      const allowed: Record<string, string[]> = {
        open: ["held", "voided", "abandoned"],
        held: ["open", "voided", "abandoned"],
        converted: [],
        voided: [],
        abandoned: [],
      };
      if (!allowed[cart.status]?.includes(args.input.nextStatus)) {
        throw new Error(
          `Cannot transition cart from ${cart.status} to ${args.input.nextStatus}`,
        );
      }
      const updated = await transaction.cart.update({
        where: { id: cart.id },
        data: {
          status: args.input.nextStatus,
          metadata: {
            ...(cart.metadata &&
            typeof cart.metadata === "object" &&
            !Array.isArray(cart.metadata)
              ? cart.metadata
              : {}),
            transitionReason: args.input.reason?.trim() || null,
          },
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.cartNumber,
      };
    },
  });
}

export async function completePosSale(
  _root: unknown,
  args: {
    input: BaseInput & {
      cartId: string;
      tenders: TenderInput[];
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (
    !args.input.tenders.length ||
    args.input.tenders.length > MAX_POS_TENDERS
  ) {
    throw new Error(`POS checkout requires 1-${MAX_POS_TENDERS} tenders`);
  }
  for (const [index, tender] of args.input.tenders.entries()) {
    assertCents(tender.amountCents, `Tender ${index + 1} amount`);
    if (tender.tenderedCents != null) {
      assertCents(tender.tenderedCents, `Tender ${index + 1} tendered amount`);
    }
    if (tender.cardLast4 && !/^\d{4}$/.test(tender.cardLast4)) {
      throw new Error("Card last four must be exactly four digits");
    }
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageSales",
    scope: "completePosSale",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "Sale",
    action: "sale.complete",
    execute: async (transaction, idempotencyId) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock_shared(hashtext(${`checkout-policy:${args.input.businessId}`}))::text AS "locked"`,
      );
      await transaction.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`retail-cart:${args.input.businessId}:${args.input.storeId}:${args.input.cartId}`}))::text AS "locked"`);
      const cartRegister = await transaction.cart.findFirst({
        where: { id: args.input.cartId, businessId: args.input.businessId, storeId: args.input.storeId, status: "open" },
        select: { registerSessionId: true },
      });
      if (!cartRegister?.registerSessionId) throw new Error("Open cart register not found");
      const registerKey = retailRegisterLockKey(args.input.businessId, args.input.storeId, cartRegister.registerSessionId);
      await transaction.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${registerKey}))::text AS "locked"`);
      const cart = await transaction.cart.findFirst({
        where: {
          id: args.input.cartId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "open",
        },
        include: {
          store: true,
          registerSession: { include: retailRegisterInclude },
          lines: {
            orderBy: { createdAt: "asc" },
            take: MAX_POS_CART_LINES + 1,
            include: {
              variant: {
                include: {
                  product: { include: { taxCategory: true, categories: true } },
                },
              },
              barcode: true,
              promotions: true,
            },
          },
          promotions: true,
          loyaltyAccount: { include: { program: true } },
        },
      });
      if (!cart || !cart.store)
        throw new Error(
          "Open cart and store not found for this business and store",
        );
      if (cart.lines.length > MAX_POS_CART_LINES)
        throw new Error(`POS cart cannot exceed ${MAX_POS_CART_LINES} lines`);
      if (!cart.lines.length) throw new Error("Cannot complete an empty cart");
      if (!cart.registerSession || cart.registerSession.status !== "open") {
        throw new Error("POS checkout requires an open register session");
      }
      assertRetailRegister(cart.registerSession, args.input.businessId, args.input.storeId, cart.currencyCode);
      await assertCashLedger(transaction, cart.registerSession);
      if (!cart.cashierId) throw new Error("POS checkout requires a cashier");
      if (cart.loyaltyAccountId) {
        await transaction.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`loyalty:${cart.loyaltyAccountId}`}))::text AS "locked"`,
        );
      }

      if (
        cart.promotions.length &&
        cart.lines.some(
          (line) =>
            line.discountCents > 0 && !line.variant?.product?.discountable,
        )
      ) {
        throw new Error(
          "An applied promotion targets a product that is no longer discountable",
        );
      }
      const cartMetadata =
        cart.metadata &&
        typeof cart.metadata === "object" &&
        !Array.isArray(cart.metadata)
          ? (cart.metadata as Record<string, unknown>)
          : {};
      const promotionRevisions =
        cartMetadata.promotionRevisions &&
        typeof cartMetadata.promotionRevisions === "object" &&
        !Array.isArray(cartMetadata.promotionRevisions)
          ? (cartMetadata.promotionRevisions as Record<string, unknown>)
          : {};
      for (const promotionSnapshot of [...cart.promotions].sort((left, right) =>
        left.id.localeCompare(right.id),
      )) {
        await transaction.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`promotion:${promotionSnapshot.id}`}))::text AS "locked"`,
        );
        const promotion = await transaction.promotion.findFirst({
          where: {
            id: promotionSnapshot.id,
            businessId: args.input.businessId,
            status: "active",
            AND: [
              { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
              { OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] },
              {
                OR: [
                  { stores: { none: {} } },
                  { stores: { some: { id: args.input.storeId } } },
                ],
              },
            ],
          },
        });
        if (!promotion)
          throw new Error(
            "An applied promotion is no longer active for this store",
          );
        const livePromotionMetadata =
          promotion.metadata &&
          typeof promotion.metadata === "object" &&
          !Array.isArray(promotion.metadata)
            ? (promotion.metadata as Record<string, unknown>)
            : {};
        if (
          typeof livePromotionMetadata.revision !== "string" ||
          promotionRevisions[promotion.id] !== livePromotionMetadata.revision
        ) {
          throw new Error(
            "An applied promotion changed after pricing; rebuild the cart before checkout",
          );
        }
        if (promotion.usageLimit != null) {
          const used = await transaction.promotionRedemption.count({
            where: {
              promotionId: promotion.id,
              sale: { status: { not: "voided" } },
            },
          });
          if (used >= promotion.usageLimit)
            throw new Error(
              "Promotion usage limit was reached before checkout",
            );
        }
        if (promotion.perCustomerLimit != null) {
          if (!cart.customerId)
            throw new Error(
              "Promotion requires an identified customer at checkout",
            );
          const used = await transaction.promotionRedemption.count({
            where: {
              promotionId: promotion.id,
              sale: { customerId: cart.customerId, status: { not: "voided" } },
            },
          });
          if (used >= promotion.perCustomerLimit)
            throw new Error(
              "Customer promotion limit was reached before checkout",
            );
        }
      }

      const subtotalCents = cart.lines.reduce(
        (total, line) => total + line.subtotalCents,
        0,
      );
      const discountCents = cart.lines.reduce(
        (total, line) => total + line.discountCents,
        0,
      );
      const taxCents = cart.lines.reduce(
        (total, line) => total + line.taxCents,
        0,
      );
      const totalCents = cart.lines.reduce(
        (total, line) => total + line.totalCents,
        0,
      );
      for (const [label, value] of Object.entries({
        subtotalCents,
        discountCents,
        taxCents,
        totalCents,
      })) {
        assertCents(value, label);
      }

      const knownPromotionIds = new Set(cart.promotions.map((promotion) => promotion.id));
      const promotionDiscountById = new Map<string, number>();
      const promotionDiscountByLine = new Map<string, Record<string, number>>();
      for (const line of cart.lines) {
        const metadata =
          line.metadata &&
          typeof line.metadata === "object" &&
          !Array.isArray(line.metadata)
            ? (line.metadata as Record<string, unknown>)
            : {};
        const rawAllocations =
          metadata.promotionAllocations &&
          typeof metadata.promotionAllocations === "object" &&
          !Array.isArray(metadata.promotionAllocations)
            ? (metadata.promotionAllocations as Record<string, unknown>)
            : {};
        const lineAllocations: Record<string, number> = {};
        let attributedLineDiscount = 0;
        for (const [promotionId, amount] of Object.entries(rawAllocations)) {
          if (
            !knownPromotionIds.has(promotionId) ||
            !Number.isSafeInteger(amount) ||
            Number(amount) <= 0
          ) {
            throw new Error(
              "Cart promotion evidence is invalid; rebuild the cart before checkout",
            );
          }
          const cents = Number(amount);
          lineAllocations[promotionId] = cents;
          attributedLineDiscount += cents;
          promotionDiscountById.set(
            promotionId,
            (promotionDiscountById.get(promotionId) ?? 0) + cents,
          );
        }
        if (attributedLineDiscount !== line.discountCents) {
          throw new Error(
            "Cart discounts lack exact promotion attribution; reapply promotions before checkout",
          );
        }
        promotionDiscountByLine.set(line.id, lineAllocations);
      }
      const attributedDiscount = [...promotionDiscountById.values()].reduce(
        (sum, amount) => sum + amount,
        0,
      );
      if (attributedDiscount !== discountCents) {
        throw new Error(
          "Promotion allocations do not conserve the cart discount total",
        );
      }

      const loyaltyAccount = cart.loyaltyAccountId
        ? await transaction.loyaltyAccount.findFirst({
            where: {
              id: cart.loyaltyAccountId,
              businessId: args.input.businessId,
            },
            include: { program: true },
          })
        : null;
      const loyaltyProgram = loyaltyAccount?.program;
      const loyaltyPoints = cart.loyaltyPointsToRedeem ?? 0;
      const loyaltyRedemptionCents = cart.loyaltyRedemptionCents ?? 0;
      const loyaltyNow = new Date();
      let loyaltyExpiryAllocations: Array<{
        points: number;
        expiresAt: string | null;
      }> = [];
      if (loyaltyPoints > 0 || loyaltyRedemptionCents > 0) {
        if (
          !loyaltyAccount ||
          loyaltyAccount.status !== "active" ||
          !loyaltyProgram ||
          loyaltyProgram.status !== "active"
        ) {
          throw new Error(
            "Applied loyalty redemption no longer has an active account and program",
          );
        }
        const ledger = await transaction.loyaltyLedgerEntry.findMany({
          where: { accountId: loyaltyAccount.id },
          select: {
            type: true,
            pointsDelta: true,
            expiresAt: true,
            occurredAt: true,
          },
          orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
          take: 10_001,
        });
        if (ledger.length > 10_000)
          throw new Error(
            "Loyalty account ledger exceeds the bounded checkout limit",
          );
        const spendablePoints = availableLoyaltyPoints(
          ledger,
          loyaltyNow,
          loyaltyAccount.pointsBalance ?? 0,
        );
        const redemptionPoints = loyaltyProgram.redemptionPoints ?? 0;
        const expectedValue =
          redemptionPoints > 0 && loyaltyPoints % redemptionPoints === 0
            ? (loyaltyPoints / redemptionPoints) *
              (loyaltyProgram.redemptionValueCents ?? 0)
            : -1;
        if (
          loyaltyPoints <= 0 ||
          loyaltyPoints > spendablePoints ||
          expectedValue !== loyaltyRedemptionCents ||
          loyaltyRedemptionCents > totalCents
        ) {
          throw new Error(
            "Applied loyalty redemption is no longer valid or includes expired points",
          );
        }
        loyaltyExpiryAllocations = allocateLoyaltyRedemption(
          ledger,
          loyaltyNow,
          loyaltyPoints,
        );
      }
      const tenderTotal = sumAppliedTenders(args.input.tenders);
      const externallyTenderedCents = totalCents - loyaltyRedemptionCents;
      if (tenderTotal !== externallyTenderedCents) {
        throw new Error(
          `Applied tenders (${tenderTotal}) plus loyalty (${loyaltyRedemptionCents}) must equal sale total (${totalCents})`,
        );
      }

      // A scan-time quote is only a pending quote. Revalidate current
      // saleability, price-tier selection, tax selection, and line arithmetic
      // before committing the sale; stale carts must be rebuilt, not charged.
      const checkoutAt = new Date();
      for (const line of cart.lines) {
        const variant = line.variant;
        const product = variant?.product;
        if (
          !variant ||
          variant.status !== "active" ||
          !product ||
          product.status !== "active"
        ) {
          throw new Error(
            "A cart item is no longer saleable; remove it and rescan before checkout",
          );
        }
        if (
          line.barcodeId &&
          (!line.barcode ||
            line.barcode.status !== "active" ||
            line.barcode.variantId !== variant.id)
        ) {
          throw new Error(
            "A cart barcode is no longer an active identifier for this variant",
          );
        }
        const quantity = assertSellQuantity(variant.sellBy, line.quantity.toString());
        const currentPriceEntry = cart.priceBookId
          ? await findEffectivePriceEntry(transaction, {
              businessId: args.input.businessId,
              priceBookId: cart.priceBookId,
              variantId: variant.id,
              quantity,
              at: checkoutAt,
            })
          : null;
        const currentUnitPriceCents =
          currentPriceEntry?.amountCents ?? variant.defaultPriceCents;
        const currentPriceSource = currentPriceEntry
          ? "price_book"
          : "variant_default";
        if (
          line.priceSource !== currentPriceSource ||
          line.priceBookEntryId !== (currentPriceEntry?.id ?? null) ||
          line.unitPriceCents !== currentUnitPriceCents
        ) {
          throw new Error(
            "A cart price changed after scanning; refresh the quote before checkout",
          );
        }
        const currentTaxRate = await findEffectiveTaxRate(transaction, {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          taxCategoryId: product.taxCategoryId,
          at: checkoutAt,
        });
        const lineTaxRate = currentTaxRate?.rate ?? 0;
        const taxInclusive = currentTaxRate?.inclusive ?? false;
        if (
          currentTaxRate &&
          currentTaxRate.inclusive !== cart.store.pricesIncludeTax
        ) {
          throw new Error(
            "Current tax configuration does not match the store price-inclusion setting",
          );
        }
        const currentAmounts = calculateLineAmounts({
          unitPriceCents: currentUnitPriceCents,
          quantity,
          discountCents: line.discountCents,
          taxRate: lineTaxRate,
          taxInclusive,
        });
        if (
          rateToPpm(line.taxRate ?? 0) !== rateToPpm(lineTaxRate) ||
          line.taxInclusive !== taxInclusive ||
          line.subtotalCents !== currentAmounts.subtotalCents ||
          line.taxCents !== currentAmounts.taxCents ||
          line.totalCents !== currentAmounts.totalCents
        ) {
          throw new Error(
            "A cart tax or amount changed after scanning; refresh the quote before checkout",
          );
        }
      }

      // Compliance classification is live policy, not a cart-time snapshot:
      // a product made restricted after scanning must still require current
      // evidence before checkout.
      const acceptedAgeEvidenceByLine = new Map<
        string,
        {
          primaryVerificationId: string;
          evidence: Array<{
            verificationId: string;
            policyId: string;
            policyRevision: string;
            outcome: string;
            method: string;
            verifiedAt: string;
          }>;
        }
      >();
      const restrictedLines = cart.lines.filter(
        (line) => line.variant?.product?.regulatedSaleType !== "none",
      );
      const requiredAge = Math.max(
        0,
        ...restrictedLines.map(
          (line) => line.variant?.product?.minimumAge ?? 0,
        ),
      );
      if (restrictedLines.length) {
        if (
          restrictedLines.some((line) => {
            const minimumAge = line.variant?.product?.minimumAge;
            return !minimumAge || minimumAge < 1;
          })
        ) {
          throw new Error(
            "Every restricted cart line requires a positive configured minimum age",
          );
        }
        const now = new Date();
        const [policies, verifications] = await Promise.all([
          transaction.compliancePolicy.findMany({
            where: {
              businessId: args.input.businessId,
              policyType: "age_restriction",
              status: "active",
              minimumAge: { gt: 0 },
              AND: [
                { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
                {
                  OR: [
                    { stores: { none: {} } },
                    { stores: { some: { id: args.input.storeId } } },
                  ],
                },
              ],
            },
            include: {
              products: { select: { id: true } },
              categories: { select: { id: true } },
            },
            take: 501,
          }),
          transaction.ageVerification.findMany({
            where: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              cartId: cart.id,
              saleId: null,
            },
            orderBy: [{ verifiedAt: "desc" }, { id: "desc" }],
            take: 101,
          }),
        ]);
        if (policies.length > 500 || verifications.length > 100) {
          throw new Error(
            "Restricted-sale policy or verification evidence exceeds the bounded checkout limit",
          );
        }
        for (const line of restrictedLines) {
          const product = line.variant?.product;
          if (!product)
            throw new Error("Restricted cart line product is missing");
          const categoryIds = new Set(
            product.categories.map((category) => category.id),
          );
          const applicable = policies.filter((policy) => {
            const scoped =
              policy.products.length > 0 || policy.categories.length > 0;
            const productMatches = policy.products.some(
              (candidate) => candidate.id === product.id,
            );
            const categoryMatches = policy.categories.some((candidate) =>
              categoryIds.has(candidate.id),
            );
            return !scoped || productMatches || categoryMatches;
          });
          if (!applicable.length)
            throw new Error(
              "Every restricted product requires an active applicable age policy",
            );
          const acceptedEvidence: Array<{
            verificationId: string;
            policyId: string;
            policyRevision: string;
            outcome: string;
            method: string;
            verifiedAt: string;
          }> = [];
          for (const policy of applicable) {
            // All outcomes participate: the newest attempt for this policy is
            // authoritative, so a later refusal/failure supersedes an older pass.
            const verification = verifications.find(
              (entry) => entry.policyId === policy.id,
            );
            const verificationMetadata =
              verification?.metadata &&
              typeof verification.metadata === "object" &&
              !Array.isArray(verification.metadata)
                ? (verification.metadata as Record<string, unknown>)
                : {};
            const policyRevision = policy.updatedAt.toISOString();
            const validOutcome =
              verification?.outcome === "passed" ||
              (verification?.outcome === "overridden" &&
                policy.managerOverrideAllowed);
            const validMethod =
              verification?.outcome === "overridden" ||
              !policy.scanRequired ||
              verification?.method === "id_scan";
            const currentAndUnexpired = Boolean(
              verification &&
                verification.expiresAt &&
                verification.expiresAt > now &&
                verificationMetadata.cartRevision ===
                  cart.updatedAt.toISOString() &&
                verificationMetadata.policyRevision === policyRevision,
            );
            if (
              !verification ||
              !validOutcome ||
              !validMethod ||
              !currentAndUnexpired ||
              verification.ageAtVerification <
                Math.max(product.minimumAge ?? 0, policy.minimumAge ?? 0)
            ) {
              throw new Error(
                "The latest age decision is adverse, expired, or stale for this cart/policy; verify again before checkout",
              );
            }
            acceptedEvidence.push({
              verificationId: verification.id,
              policyId: policy.id,
              policyRevision,
              outcome: verification.outcome,
              method: verification.method,
              verifiedAt: verification.verifiedAt.toISOString(),
            });
          }
          acceptedEvidence.sort((left, right) =>
            right.verifiedAt.localeCompare(left.verifiedAt),
          );
          acceptedAgeEvidenceByLine.set(line.id, {
            primaryVerificationId: acceptedEvidence[0].verificationId,
            evidence: acceptedEvidence,
          });
        }
      }

      const providerReferences = new Set<string>();
      const confirmationContexts = new Map<string, ReturnType<typeof retailPaymentContext>>();
      for (const tender of args.input.tenders) {
        if (tender.method === "cash") {
          const tendered = tender.tenderedCents ?? tender.amountCents;
          if (tendered < tender.amountCents) {
            throw new Error(
              "Cash tendered cannot be less than its applied amount",
            );
          }
          if (
            tender.paymentProviderId ||
            tender.providerPaymentId?.trim() ||
            tender.providerAuthority?.trim()
          ) {
            throw new Error(
              "Cash tenders cannot carry payment-provider references",
            );
          }
          continue;
        }

        if (tender.tenderedCents != null) {
          throw new Error("Tendered amount is only valid for cash tenders");
        }
        if (
          !tender.paymentProviderId ||
          !tender.providerPaymentId?.trim() ||
          !tender.providerAuthority?.trim()
        ) {
          throw new Error(
            "Non-cash tenders require an active provider, reference, and signed authority proof",
          );
        }
        const provider = await transaction.paymentProvider.findFirst({
          where: {
            id: tender.paymentProviderId,
            businessId: args.input.businessId,
            status: "active",
          },
        });
        if (!provider)
          throw new Error(
            "Active payment provider not found for this business",
          );
        const confirmation = getPaymentProviderAdapter(
          provider.adapterKey,
        ).validateExternalConfirmation({
          providerPaymentId: tender.providerPaymentId,
          amountCents: tender.amountCents,
          currencyCode: cart.currencyCode,
          authorityProof: tender.providerAuthority,
          credentialReference: provider.credentialReference,
          purpose: "payment",
          context: retailPaymentContext({
            ...args.input, scope: "completePosSale", command: args.input, provider,
            subjectId: cart.id, subjectRevision: cart.updatedAt.toISOString(),
          }),
        });
        const providerReferenceKey = `${provider.id}:${confirmation.providerPaymentId}`;
        if (providerReferences.has(providerReferenceKey)) {
          throw new Error(
            "Provider payment reference may appear only once per sale",
          );
        }
        providerReferences.add(providerReferenceKey);
        confirmationContexts.set(providerReferenceKey, confirmation.context!);
        const existingTender = await transaction.tender.findFirst({
          where: {
            businessId: args.input.businessId,
            paymentProviderId: provider.id,
            providerPaymentId: tender.providerPaymentId.trim(),
          },
          select: { id: true },
        });
        if (existingTender) {
          throw new Error("Provider payment reference was already recorded");
        }
      }

      const sale = await transaction.sale.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          receiptNumber: `SALE-${randomUUID()}`,
          source: cart.source,
          status: "completed",
          currencyCode: cart.currencyCode,
          subtotalCents,
          discountCents,
          taxCents,
          roundingCents: 0,
          totalCents,
          refundedCents: 0,
          registerSessionId: cart.registerSession.id,
          cashierId: cart.cashierId,
          customerId: cart.customerId,
          loyaltyAccountId: cart.loyaltyAccountId,
          ageVerifications: {
            connect: [
              ...new Set(
                [...acceptedAgeEvidenceByLine.values()].flatMap((entry) =>
                  entry.evidence.map((evidence) => evidence.verificationId),
                ),
              ),
            ].map((id) => ({ id })),
          },
          startedAt: cart.createdAt,
          completedAt: new Date(),
          idempotencyId,
        },
      });

      const locationId = cart.store.primaryInventoryLocationId;
      if (
        !locationId &&
        cart.lines.some((line) => line.variant?.trackInventory)
      ) {
        throw new Error("Store has no primary inventory location");
      }

      for (const [index, line] of cart.lines.entries()) {
        const variant = line.variant;
        const product = variant?.product;
        if (!variant || !product) {
          throw new Error("Cart line references a missing product variant");
        }

        const saleLine = await transaction.saleLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            saleId: sale.id,
            lineNumber: index + 1,
            titleSnapshot: line.titleSnapshot,
            variantTitleSnapshot: line.variantTitleSnapshot,
            skuSnapshot: line.skuSnapshot,
            barcodeSnapshot: line.barcodeSnapshot,
            productSnapshot: {
              productId: product.id,
              productTitle: product.title,
              variantId: variant.id,
              returnable: product.returnable,
              discountable: product.discountable,
            },
            quantity: line.quantity,
            unitOfMeasure: line.unitOfMeasure,
            unitPriceCents: line.unitPriceCents,
            subtotalCents: line.subtotalCents,
            discountCents: line.discountCents,
            taxCategorySnapshot: product.taxCategory?.name ?? "",
            taxRate: line.taxRate,
            taxInclusive: line.taxInclusive,
            taxCents: line.taxCents,
            totalCents: line.totalCents,
            promotionSnapshot: line.promotions.map((promotion) => ({
              id: promotion.id,
              code: promotion.code,
              name: promotion.name,
              discountCents:
                promotionDiscountByLine.get(line.id)?.[promotion.id] ?? 0,
              revision:
                typeof promotionRevisions[promotion.id] === "string"
                  ? String(promotionRevisions[promotion.id])
                  : null,
            })),
            regulatedSaleType: product.regulatedSaleType,
            minimumAge:
              product.regulatedSaleType === "none" ? null : product.minimumAge,
            ageVerified:
              product.regulatedSaleType === "none" || requiredAge > 0,
            ...(acceptedAgeEvidenceByLine.has(line.id)
              ? {
                  ageVerificationId: acceptedAgeEvidenceByLine.get(line.id)!
                    .primaryVerificationId,
                  metadata: {
                    acceptedAgeEvidence:
                      acceptedAgeEvidenceByLine.get(line.id)!.evidence,
                    evaluatedAt: checkoutAt.toISOString(),
                  },
                }
              : {}),
            productId: product.id,
            variantId: variant.id,
            barcodeId: line.barcodeId,
          },
        });

        if (variant.trackInventory && locationId) {
          const lookupKey = `${locationId}:${variant.id}`;
          const stockLevel = await transaction.stockLevel.findUnique({
            where: { lookupKey },
          });
          const previous = stockLevel?.onHandQuantity.toString() ?? "0.0000";
          const delta = `-${line.quantity.toString()}`;
          const balanceAfter = addQuantities(previous, delta);
          if (
            !variant.allowNegativeInventory &&
            compareQuantities(balanceAfter, "0") < 0
          ) {
            throw new Error(
              `Insufficient inventory for ${line.skuSnapshot || variant.id}`,
            );
          }

          const updatedStock = stockLevel
            ? await transaction.stockLevel.update({
                where: { id: stockLevel.id },
                data: { onHandQuantity: balanceAfter },
              })
            : await transaction.stockLevel.create({
                data: {
                  businessId: args.input.businessId,
                  storeId: args.input.storeId,
                  locationId,
                  variantId: variant.id,
                  lookupKey,
                  onHandQuantity: balanceAfter,
                  reservedQuantity: "0.0000",
                  parQuantity: "0.0000",
                  reorderPoint: "0.0000",
                  reorderQuantity: "0.0000",
                },
              });

          const lotSegments = await consumeInventoryLots(transaction, {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            locationId,
            variantId: variant.id,
            quantity: line.quantity.toString(),
          });
          if (
            lotSegments.some((segment) => !segment.lotId) &&
            !variant.allowNegativeInventory
          ) {
            throw new Error(
              `Insufficient FIFO lot inventory for ${line.skuSnapshot || variant.id}`,
            );
          }
          let runningBalance = previous;
          for (const segment of lotSegments) {
            runningBalance = addQuantities(
              runningBalance,
              `-${segment.quantity}`,
            );
            await transaction.inventoryLedgerEntry.create({
              data: {
                businessId: args.input.businessId,
                storeId: args.input.storeId,
                stockLevelId: updatedStock.id,
                locationId,
                variantId: variant.id,
                lotId: segment.lotId,
                type: "sale",
                quantityDelta: `-${segment.quantity}`,
                balanceAfter: runningBalance,
                unitCostCents: segment.unitCostCents ?? variant.costCents,
                reason: `Sale ${sale.receiptNumber}`,
                sourceType: "Sale",
                sourceId: sale.id,
                saleLineId: saleLine.id,
                actorId: cart.cashierId,
                idempotencyId,
                occurredAt: new Date(),
              },
            });
          }
          if (runningBalance !== balanceAfter) {
            throw new Error(
              "Sale lot allocation did not reconcile to stock balance",
            );
          }
        }
      }

      let cashAppliedCents = 0;
      for (const tenderInput of args.input.tenders) {
        const tenderedCents =
          tenderInput.method === "cash"
            ? (tenderInput.tenderedCents ?? tenderInput.amountCents)
            : null;
        const changeCents =
          tenderedCents == null ? 0 : tenderedCents - tenderInput.amountCents;

        const tender = await transaction.tender.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            saleId: sale.id,
            paymentProviderId: tenderInput.paymentProviderId ?? null,
            method: tenderInput.method,
            status: "captured",
            amountCents: tenderInput.amountCents,
            tenderedCents,
            changeCents,
            refundedCents: 0,
            currencyCode: cart.currencyCode,
            providerPaymentId: tenderInput.providerPaymentId?.trim() || "",
            providerLookupKey:
              tenderInput.paymentProviderId &&
              tenderInput.providerPaymentId?.trim()
                ? `${tenderInput.paymentProviderId}:${tenderInput.providerPaymentId.trim()}`
                : null,
            metadata: tenderInput.method === "cash" ? {} : {
              confirmationContractVersion: 2,
              confirmationContext: confirmationContexts.get(`${tenderInput.paymentProviderId}:${tenderInput.providerPaymentId?.trim()}`),
            },
            cardBrand: tenderInput.cardBrand?.trim() || "",
            cardLast4: tenderInput.cardLast4?.trim() || "",
            processedAt: new Date(),
            processedById: cart.cashierId,
            idempotencyId,
          },
        });

        if (tender.method === "cash") {
          cashAppliedCents += tender.amountCents;
          await transaction.cashMovement.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              registerSessionId: cart.registerSession.id,
              employeeId: cart.cashierId,
              type: "sale_payment",
              direction: "in",
              amountCents: tender.amountCents,
              reason: `Cash sale ${sale.receiptNumber}`,
              saleId: sale.id,
              tenderId: tender.id,
              occurredAt: new Date(),
              idempotencyId,
            },
          });
        }
      }

      if (loyaltyRedemptionCents > 0) {
        await transaction.tender.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            saleId: sale.id,
            method: "loyalty",
            status: "captured",
            amountCents: loyaltyRedemptionCents,
            refundedCents: 0,
            currencyCode: cart.currencyCode,
            providerPaymentId: "",
            processedAt: new Date(),
            processedById: cart.cashierId,
            idempotencyId,
            metadata: {
              loyaltyPoints,
              expiryAllocations: loyaltyExpiryAllocations,
            },
          },
        });
      }

      if (cashAppliedCents > 0) {
        await transaction.registerSession.update({
          where: { id: cart.registerSession.id },
          data: {
            expectedCashCents:
              cart.registerSession.expectedCashCents + cashAppliedCents,
          },
        });
      }

      if (
        loyaltyAccount?.status === "active" &&
        loyaltyProgram?.status === "active"
      ) {
        let balanceAfter = loyaltyAccount.pointsBalance ?? 0;
        if (loyaltyPoints > 0) {
          balanceAfter -= loyaltyPoints;
          await transaction.loyaltyLedgerEntry.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              accountId: loyaltyAccount.id,
              type: "redeemed",
              pointsDelta: -loyaltyPoints,
              balanceAfter,
              description: `Points redeemed on ${sale.receiptNumber}`,
              saleId: sale.id,
              actorId: cart.cashierId,
              occurredAt: loyaltyNow,
              idempotencyId,
              metadata: {
                redemptionValueCents: loyaltyRedemptionCents,
                expiryAllocations: loyaltyExpiryAllocations,
              },
            },
          });
        }
        const points = Math.floor(
          ((totalCents - loyaltyRedemptionCents) *
            (loyaltyProgram.pointsPerDollar ?? 0)) /
            100,
        );
        if (points > 0) {
          balanceAfter += points;
          await transaction.loyaltyLedgerEntry.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              accountId: loyaltyAccount.id,
              type: "earned",
              pointsDelta: points,
              balanceAfter,
              description: `Points earned on ${sale.receiptNumber}`,
              saleId: sale.id,
              actorId: cart.cashierId,
              expiresAt: loyaltyProgram.pointsExpireAfterDays
                ? new Date(
                    loyaltyNow.getTime() +
                      loyaltyProgram.pointsExpireAfterDays * 86_400_000,
                  )
                : null,
              occurredAt: loyaltyNow,
              idempotencyId,
            },
          });
        }
        await transaction.loyaltyAccount.update({
          where: { id: loyaltyAccount.id },
          data: {
            pointsBalance: balanceAfter,
            lifetimePoints: (loyaltyAccount.lifetimePoints ?? 0) + points,
            firstVisitAt: loyaltyAccount.firstVisitAt ?? loyaltyNow,
            lastVisitAt: loyaltyNow,
          },
        });
      }

      if (cart.promotions.length) {
        for (const promotion of cart.promotions) {
          const amountCents = promotionDiscountById.get(promotion.id) ?? 0;
          if (amountCents <= 0) {
            throw new Error(
              "Applied promotion is missing its exact checkout allocation",
            );
          }
          await transaction.promotionRedemption.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              promotionId: promotion.id,
              saleId: sale.id,
              loyaltyAccountId: cart.loyaltyAccountId,
              codeSnapshot: promotion.code,
              amountCents,
              redeemedAt: new Date(),
            },
          });
        }
      }

      await transaction.cart.update({
        where: { id: cart.id },
        data: {
          status: "converted",
          subtotalCents,
          discountCents,
          taxCents,
          totalCents,
          saleId: sale.id,
        },
      });

      return {
        id: sale.id,
        status: sale.status,
        reference: sale.receiptNumber,
      };
    },
  });
}

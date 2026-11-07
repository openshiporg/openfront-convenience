import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";
import { GraphQLError } from "graphql";
import { CART_TRANSITIONS, moveStatus } from "../lib/transitionPolicy";
import type { Context } from ".keystone/types";

import { calculateLineAmounts } from "../lib/money";
import { addQuantities, compareQuantities } from "../lib/quantity";
import { assertPaymentMatches, assertPickupEligible, pickupRevision } from "../lib/pickupPolicy";
import { findEffectivePriceEntry, findEffectiveTaxRate } from "../lib/retailPricing";
import {
  cancelPayment,
  capturePayment,
  createPayment,
  getPaymentStatus,
} from "../utils/paymentProviderAdapter";
import { getPublicPaymentProviderConfig, isPaymentProviderConfigured } from "../utils/paymentProviderConfig";
import { consumeInventoryLots } from "./inventoryPosting";
import { assertProof, currentCustomerId, publishedStore } from "./storefrontOperations";
import { assertStorePermission, type Session } from "../access";
import { requireSession } from "./operationRunner";

// Online pickup orders. A storefront Cart is the order; settling it posts an
// ordinary Sale + Tender (providerPaymentId = the Stripe pi_…), so store-day
// reconciliation, tender totals and refund binding see it like any other sale.

const PROOF = /^[a-f0-9]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The optional "Email for receipt": a plain address kept on the basket's metadata. It creates and links no account. */
export function normalizeReceiptEmail(value: unknown): string | null {
  if (value == null) return null;
  // BAD_USER_INPUT so the shopper sees this message instead of a masked server error.
  const invalid = () => new GraphQLError("Enter a valid email address", { extensions: { code: "BAD_USER_INPUT" } });
  if (typeof value !== "string") throw invalid();
  const email = value.trim().toLowerCase();
  if (!email) return null;
  if (email.length > 254 || !EMAIL.test(email)) throw invalid();
  return email;
}
const CART_ID = /^[a-zA-Z0-9-]{10,64}$/;

type PickupPayment = {
  providerId: string;
  paymentId: string;
  amountCents: number;
  currencyCode: string;
  revision: string;
};

export function readPickupPayment(metadata: unknown): PickupPayment | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).pickupPayment;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (
    typeof p.providerId !== "string" || typeof p.paymentId !== "string" || typeof p.currencyCode !== "string" ||
    typeof p.revision !== "string" || !Number.isSafeInteger(p.amountCents)
  ) return null;
  return { providerId: p.providerId, paymentId: p.paymentId, amountCents: p.amountCents as number, currencyCode: p.currencyCode, revision: p.revision };
}

const cartLineInclude = {
  orderBy: { createdAt: "asc" as const },
  take: 51,
  include: { variant: { include: { product: { include: { taxCategory: true } } } } },
};

async function onlineProvider(db: Prisma.TransactionClient | Context["prisma"], businessId: string) {
  const providers = await db.paymentProvider.findMany({
    where: { businessId, status: "active", createPaymentFunction: "stripe" },
    take: 2,
  });
  if (providers.length !== 1) throw new Error("Online pickup payment is not available");
  const provider = providers[0];
  if (!isPaymentProviderConfigured(provider.createPaymentFunction) || provider.getPaymentStatusFunction !== "stripe" || provider.capturePaymentFunction !== "stripe") {
    throw new Error("Online pickup payment is not available");
  }
  return provider;
}

/** Re-prices every line at the live price/tax, so a stale basket is never charged. */
async function repriceCart(db: Prisma.TransactionClient, cart: { id: string; businessId: string | null; storeId: string | null; priceBookId: string | null }, store: { id: string; pricesIncludeTax: boolean }) {
  const lines = await db.cartLine.findMany({ where: { cartId: cart.id }, ...cartLineInclude });
  if (lines.length > 50) throw new Error("Basket limit reached");
  assertPickupEligible(lines);
  const at = new Date();
  for (const line of lines) {
    const variant = line.variant!;
    const product = variant.product!;
    if (variant.sellBy !== "unit") throw new Error("An item in your basket is not sold online");
    const quantity = line.quantity.toString();
    const price = cart.priceBookId
      ? await findEffectivePriceEntry(db, { businessId: cart.businessId!, priceBookId: cart.priceBookId, variantId: variant.id, quantity, at })
      : null;
    const tax = await findEffectiveTaxRate(db, { businessId: cart.businessId!, storeId: store.id, taxCategoryId: product.taxCategoryId, at });
    if (tax && tax.inclusive !== store.pricesIncludeTax) throw new Error("Item tax configuration unavailable");
    const unitPriceCents = price?.amountCents ?? variant.defaultPriceCents;
    const amounts = calculateLineAmounts({ unitPriceCents, quantity, taxRate: tax?.rate ?? 0, taxInclusive: tax?.inclusive ?? false });
    await db.cartLine.update({
      where: { id: line.id },
      data: {
        unitPriceCents, subtotalCents: amounts.subtotalCents, discountCents: amounts.discountCents,
        taxRate: tax?.rate ?? 0, taxInclusive: tax?.inclusive ?? false, taxCents: amounts.taxCents, totalCents: amounts.totalCents,
        priceBookEntryId: price?.id ?? null, priceSource: price ? "price_book" : "variant_default",
      },
    });
  }
  const sums = await db.cartLine.aggregate({ where: { cartId: cart.id }, _sum: { subtotalCents: true, taxCents: true, totalCents: true } });
  const totals = { subtotalCents: sums._sum.subtotalCents ?? 0, taxCents: sums._sum.taxCents ?? 0, totalCents: sums._sum.totalCents ?? 0 };
  await db.cart.update({ where: { id: cart.id }, data: totals });
  const fresh = await db.cartLine.findMany({ where: { cartId: cart.id }, ...cartLineInclude });
  return { lines: fresh, ...totals };
}

async function assertStock(db: Prisma.TransactionClient, store: { id: string; primaryInventoryLocationId: string | null }, lines: Awaited<ReturnType<typeof repriceCart>>["lines"]) {
  for (const line of lines) {
    const variant = line.variant!;
    if (!variant.trackInventory || variant.allowNegativeInventory) continue;
    if (!store.primaryInventoryLocationId) throw new Error("Store has no primary inventory location");
    const stock = await db.stockLevel.findUnique({ where: { lookupKey: `${store.primaryInventoryLocationId}:${variant.id}` } });
    const onHand = stock?.onHandQuantity.toString() ?? "0.0000";
    if (compareQuantities(onHand, line.quantity.toString()) < 0) throw new Error(`${line.titleSnapshot} is out of stock`);
  }
}

/**
 * Starts (or resumes) the Stripe payment for a basket. The charge amount is
 * always recomputed server-side from live prices, never taken from the client.
 */
export async function startStorefrontPickupPayment(_root: unknown, args: { input: { cartId: string; token: string } }, context: Context) {
  const { cartId, token } = args.input;
  if (!PROOF.test(token) || !CART_ID.test(cartId)) throw new Error("Basket unavailable");
  const prepared = await context.prisma.$transaction(async (db) => {
    const userId = await currentCustomerId(db, context, true);
    await db.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-basket:${cartId}`}))::text`);
    const { business, store } = await publishedStore(db);
    const cart = await db.cart.findUnique({ where: { id: cartId } });
    if (!cart) throw new Error("Basket unavailable");
    assertProof(cart, token, userId);
    if (cart.businessId !== business.id || cart.storeId !== store.id || cart.status !== "open") throw new Error("Basket unavailable");
    const existing = readPickupPayment(cart.metadata);
    const priced = await repriceCart(db, cart, store);
    await assertStock(db, store, priced.lines);
    if (priced.totalCents < 50) throw new Error("Order total is too small to pay online");
    const provider = await onlineProvider(db, business.id);
    const revision = pickupRevision(priced.lines, priced.totalCents);
    return { cart, store, provider, existing, revision, totalCents: priced.totalCents, currencyCode: cart.currencyCode };
  });

  const { cart, provider, existing, revision, totalCents, currencyCode } = prepared;
  if (existing && existing.revision !== revision) {
    // The basket changed since this payment began: retire the old attempt before starting another.
    await retirePickupPayment(context, cart.id, provider, existing);
  }
  const idempotencyKey = `pickup-${cart.id}-${revision.slice(0, 24)}`;
  const created: any = await createPayment({
    provider,
    order: { id: cart.id, orderNumber: cart.cartNumber },
    amount: totalCents,
    currency: currencyCode,
    idempotencyKey,
  });
  const paymentId = created?.paymentIntentId;
  const clientSecret = created?.clientSecret;
  if (typeof paymentId !== "string" || !paymentId.startsWith("pi_") || typeof clientSecret !== "string") {
    throw new Error("Payment could not be started");
  }
  const config = getPublicPaymentProviderConfig("stripe");
  if (!config) throw new Error("Online pickup payment is not available");
  const pickupPayment: PickupPayment = { providerId: provider.id, paymentId, amountCents: totalCents, currencyCode, revision };
  await context.prisma.cart.update({
    where: { id: cart.id },
    data: { metadata: { ...(cart.metadata && typeof cart.metadata === "object" && !Array.isArray(cart.metadata) ? cart.metadata : {}), pickupPayment } as Prisma.InputJsonValue },
  });
  return { clientSecret, publishableKey: config.publishableKey, paymentId, amountCents: totalCents, currencyCode };
}

async function retirePickupPayment(context: Context, cartId: string, provider: any, payment: PickupPayment) {
  const status: any = await getPaymentStatus({ provider, paymentId: payment.paymentId });
  if (status?.status === "succeeded" || status?.status === "processing") {
    throw new Error("This basket has already been paid; it cannot be changed");
  }
  if (status?.status !== "canceled") await cancelPayment({ provider, paymentId: payment.paymentId, idempotencyKey: `cancel-${cartId}-${payment.paymentId}` });
  const cart = await context.prisma.cart.findUnique({ where: { id: cartId }, select: { metadata: true } });
  const { pickupPayment: _removed, ...rest } = (cart?.metadata && typeof cart.metadata === "object" && !Array.isArray(cart.metadata) ? cart.metadata : {}) as Record<string, unknown>;
  await context.prisma.cart.update({ where: { id: cartId }, data: { metadata: rest as Prisma.InputJsonValue } });
}

/** Saves (or clears) the optional receipt email on the guest's own open basket. */
export async function setStorefrontReceiptEmail(_root: unknown, args: { input: { cartId: string; token: string; email?: string | null } }, context: Context) {
  const { cartId, token } = args.input;
  if (!PROOF.test(token) || !CART_ID.test(cartId)) throw new Error("Basket unavailable");
  const email = normalizeReceiptEmail(args.input.email);
  const userId = await currentCustomerId(context.prisma, context);
  const cart = await context.prisma.cart.findUnique({ where: { id: cartId } });
  if (!cart || cart.status !== "open") throw new Error("Basket unavailable");
  assertProof(cart, token, userId);
  const meta = cart.metadata && typeof cart.metadata === "object" && !Array.isArray(cart.metadata) ? { ...(cart.metadata as Record<string, unknown>) } : {};
  if (email) meta.receiptEmail = email; else delete meta.receiptEmail;
  await context.prisma.cart.update({ where: { id: cartId }, data: { metadata: meta as Prisma.InputJsonValue } });
  return { ok: true };
}

/** Called before any basket edit: an unpaid payment attempt is cancelled, a paid basket is frozen. */
export async function releasePickupPaymentForEdit(context: Context, cartId: string, token: string) {
  const cart = await context.prisma.cart.findUnique({ where: { id: cartId } });
  const payment = readPickupPayment(cart?.metadata);
  if (!cart || !payment || cart.status !== "open") return;
  assertProof(cart, token, await currentCustomerId(context.prisma, context));
  const provider = await context.prisma.paymentProvider.findFirst({ where: { id: payment.providerId, businessId: cart.businessId ?? undefined } });
  if (!provider) throw new Error("Basket unavailable");
  await retirePickupPayment(context, cartId, provider, payment);
}

type PostInput = { cartId: string; providerId: string; paymentId: string; amountCents: number; currencyCode: string };

/**
 * Posts the paid order as a Sale + Tender. Idempotent on (provider, payment id):
 * the settle mutation and the Stripe webhook both call this and the loser reads
 * the winner's sale. Amount and currency are asserted against the cart.
 */
export async function postPickupSale(db: Prisma.TransactionClient, input: PostInput) {
  await db.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`pickup-post:${input.providerId}:${input.paymentId}`}))::text`);
  await db.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-basket:${input.cartId}`}))::text`);
  const lookupKey = `${input.providerId}:${input.paymentId}`;
  const existing = await db.tender.findUnique({ where: { providerLookupKey: lookupKey }, include: { sale: true } });
  if (existing?.sale) return { sale: existing.sale, created: false };

  const cart = await db.cart.findUnique({ where: { id: input.cartId }, include: { store: true, lines: cartLineInclude } });
  if (!cart || !cart.store || !cart.businessId || !cart.storeId) throw new Error("Order not found");
  const pickup = readPickupPayment(cart.metadata);
  if (!pickup || pickup.providerId !== input.providerId || pickup.paymentId !== input.paymentId) {
    throw new Error("Payment does not belong to this order");
  }
  if (cart.status !== "open") throw new Error("Order is no longer open");
  assertPickupEligible(cart.lines);
  // Amount AND currency: recorded intent, provider result, and the cart's own total must all agree.
  assertPaymentMatches({ amountCents: pickup.amountCents, currencyCode: pickup.currencyCode }, { amountCents: input.amountCents, currencyCode: input.currencyCode });
  assertPaymentMatches({ amountCents: cart.totalCents, currencyCode: cart.currencyCode }, { amountCents: input.amountCents, currencyCode: input.currencyCode });
  if (pickupRevision(cart.lines, cart.totalCents) !== pickup.revision) throw new Error("Basket changed after payment began");

  const postingAt = new Date();
  if (await db.storeDay.findFirst({ where: { businessId: cart.businessId, storeId: cart.storeId, status: "locked", periodStartedAt: { lte: postingAt }, periodEndedAt: { gt: postingAt } }, select: { id: true } })) {
    throw new Error("Current retail posting period is locked");
  }

  const subtotalCents = cart.lines.reduce((t, l) => t + l.subtotalCents, 0);
  const discountCents = cart.lines.reduce((t, l) => t + l.discountCents, 0);
  const taxCents = cart.lines.reduce((t, l) => t + l.taxCents, 0);
  const sale = await db.sale.create({
    data: {
      businessId: cart.businessId, storeId: cart.storeId, receiptNumber: `WEB-${randomUUID()}`,
      source: "storefront", status: "completed", pickupStatus: "ready_for_pickup", currencyCode: cart.currencyCode,
      subtotalCents, discountCents, taxCents, roundingCents: 0, totalCents: cart.totalCents, refundedCents: 0,
      customerId: cart.customerId, startedAt: cart.createdAt, completedAt: postingAt,
      metadata: { onlinePickup: true, cartId: cart.id },
    },
  });

  const locationId = cart.store.primaryInventoryLocationId;
  for (const [index, line] of cart.lines.entries()) {
    const variant = line.variant!;
    const product = variant.product!;
    const saleLine = await db.saleLine.create({
      data: {
        businessId: cart.businessId, storeId: cart.storeId, saleId: sale.id, lineNumber: index + 1,
        titleSnapshot: line.titleSnapshot, variantTitleSnapshot: line.variantTitleSnapshot, skuSnapshot: line.skuSnapshot,
        barcodeSnapshot: line.barcodeSnapshot,
        productSnapshot: { productId: product.id, productTitle: product.title, variantId: variant.id, returnable: product.returnable, discountable: product.discountable },
        quantity: line.quantity, unitOfMeasure: line.unitOfMeasure, unitPriceCents: line.unitPriceCents,
        subtotalCents: line.subtotalCents, discountCents: line.discountCents,
        taxCategorySnapshot: product.taxCategory?.name ?? "", taxRate: line.taxRate, taxInclusive: line.taxInclusive,
        taxCents: line.taxCents, totalCents: line.totalCents, promotionSnapshot: [],
        regulatedSaleType: "none", minimumAge: null, ageVerified: false,
        productId: product.id, variantId: variant.id,
      },
    });
    if (!variant.trackInventory || !locationId) continue;
    const stockKey = `${locationId}:${variant.id}`;
    const stock = await db.stockLevel.findUnique({ where: { lookupKey: stockKey } });
    const previous = stock?.onHandQuantity.toString() ?? "0.0000";
    const balanceAfter = addQuantities(previous, `-${line.quantity.toString()}`);
    // The customer has already paid, so a shortfall is recorded (negative balance + alert), never lost.
    const updated = stock
      ? await db.stockLevel.update({ where: { id: stock.id }, data: { onHandQuantity: balanceAfter } })
      : await db.stockLevel.create({ data: { businessId: cart.businessId, storeId: cart.storeId, locationId, variantId: variant.id, lookupKey: stockKey, onHandQuantity: balanceAfter, reservedQuantity: "0.0000", parQuantity: "0.0000", reorderPoint: "0.0000", reorderQuantity: "0.0000" } });
    if (compareQuantities(balanceAfter, "0") < 0 && !variant.allowNegativeInventory) {
      await db.operationalAlert.upsert({
        where: { fingerprint: `pickup-oversold:${sale.id}:${variant.id}` },
        update: {},
        create: {
          businessId: cart.businessId, storeId: cart.storeId, alertNumber: `ALT-${randomUUID()}`, fingerprint: `pickup-oversold:${sale.id}:${variant.id}`,
          type: "low_inventory", severity: "critical", status: "open", title: "Online pickup order exceeded stock",
          message: "A paid online pickup order needed more stock than was on hand; fulfil or refund it.", resourceType: "Sale", resourceId: sale.id, detectedAt: postingAt,
        },
      });
    }
    const segments = await consumeInventoryLots(db, { businessId: cart.businessId, storeId: cart.storeId, locationId, variantId: variant.id, quantity: line.quantity.toString() });
    let running = previous;
    for (const segment of segments) {
      running = addQuantities(running, `-${segment.quantity}`);
      await db.inventoryLedgerEntry.create({
        data: {
          businessId: cart.businessId, storeId: cart.storeId, stockLevelId: updated.id, locationId, variantId: variant.id, lotId: segment.lotId,
          type: "sale", quantityDelta: `-${segment.quantity}`, balanceAfter: running, unitCostCents: segment.unitCostCents ?? variant.costCents,
          reason: `Online pickup ${sale.receiptNumber}`, sourceType: "Sale", sourceId: sale.id, saleLineId: saleLine.id, occurredAt: postingAt,
        },
      });
    }
  }

  const tender = await db.tender.create({
    data: {
      businessId: cart.businessId, storeId: cart.storeId, saleId: sale.id, paymentProviderId: input.providerId,
      method: "credit_card", status: "captured", amountCents: input.amountCents, changeCents: 0, refundedCents: 0,
      currencyCode: cart.currencyCode.toUpperCase(), providerPaymentId: input.paymentId, providerLookupKey: lookupKey,
      processedAt: postingAt, metadata: { onlinePickup: true, cartId: cart.id },
    },
  });
  await moveStatus(db.cart, CART_TRANSITIONS, { id: cart.id }, cart.status, "converted", { saleId: sale.id }, "Cart");
  await db.auditEvent.create({
    data: {
      businessId: cart.businessId, storeId: cart.storeId, eventNumber: randomUUID(), action: "pickup.order.paid", resourceType: "Sale", resourceId: sale.id,
      result: "succeeded", actorType: "integration", occurredAt: postingAt, metadata: { tenderId: tender.id, providerId: input.providerId },
    },
  });
  return { sale, created: true };
}

/** Confirms with the provider, then posts the order. Safe to call repeatedly. */
export async function settleStorefrontPickup(_root: unknown, args: { input: { cartId: string; token: string } }, context: Context) {
  const { cartId, token } = args.input;
  if (!PROOF.test(token) || !CART_ID.test(cartId)) throw new Error("Basket unavailable");
  const userId = await currentCustomerId(context.prisma, context);
  const cart = await context.prisma.cart.findUnique({ where: { id: cartId } });
  if (!cart) throw new Error("Basket unavailable");
  // Proof is checked against the stored digest, also for an already-converted order.
  assertProofAllowingConverted(cart, token, userId);
  if (cart.status === "converted" && cart.saleId) {
    const sale = await context.prisma.sale.findUnique({ where: { id: cart.saleId }, select: { id: true, receiptNumber: true, pickupStatus: true } });
    if (sale) return { state: "paid", saleId: sale.id, receiptNumber: sale.receiptNumber, pickupStatus: sale.pickupStatus };
  }
  const payment = readPickupPayment(cart.metadata);
  if (!payment || cart.status !== "open") throw new Error("There is no payment to confirm");
  const provider = await context.prisma.paymentProvider.findFirst({ where: { id: payment.providerId, businessId: cart.businessId ?? undefined, status: "active" } });
  if (!provider) throw new Error("Online pickup payment is not available");

  let status: any = await getPaymentStatus({ provider, paymentId: payment.paymentId });
  if (status?.status === "requires_capture") {
    await capturePayment({ provider, paymentId: payment.paymentId, amount: payment.amountCents, idempotencyKey: `capture-${cart.id}-${payment.paymentId}` });
    status = await getPaymentStatus({ provider, paymentId: payment.paymentId });
  }
  if (status?.status === "processing") return { state: "processing" };
  if (status?.status !== "succeeded") return { state: "unpaid", status: String(status?.status ?? "unknown") };
  // A provider "succeeded" is only trusted with the exact amount and currency we asked it to collect.
  assertPaymentMatches({ amountCents: payment.amountCents, currencyCode: payment.currencyCode }, { amountCents: status.amount, currencyCode: status.currencyCode });

  const result = await context.prisma.$transaction(
    (db) => postPickupSale(db, { cartId: cart.id, providerId: provider.id, paymentId: payment.paymentId, amountCents: status.amount, currencyCode: status.currencyCode }),
    // Posting writes the sale, lines, tender, stock moves and audit in one go; allow for a remote database.
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 },
  );
  // After the commit, never inside it. Lazy import keeps the mail path out of the keystone import graph.
  if (result.created) {
    const { sendConfirmationAfterCommit } = await import("../lib/orderConfirmation");
    await sendConfirmationAfterCommit(context.prisma, result.sale.id, { cartId, token });
  }
  return { state: "paid", saleId: result.sale.id, receiptNumber: result.sale.receiptNumber, pickupStatus: result.sale.pickupStatus };
}

function assertProofAllowingConverted(cart: Parameters<typeof assertProof>[0] & { status: string }, token: string, userId?: string) {
  if (cart.status === "converted") {
    // Expiry only bounds an open basket; a paid order stays readable by its proof holder.
    assertProof({ ...cart, expiresAt: new Date(Date.now() + 60_000) }, token, userId);
    return;
  }
  assertProof(cart, token, userId);
}

/** The order status page: only the proof holder (or signed-in owner) can read it. */
export async function storefrontPickupOrder(_root: unknown, args: { cartId: string; token: string }, context: Context) {
  if (!PROOF.test(args.token) || !CART_ID.test(args.cartId)) return null;
  const userId = await currentCustomerId(context.prisma, context);
  const cart = await context.prisma.cart.findUnique({ where: { id: args.cartId } });
  if (!cart) return null;
  try { assertProofAllowingConverted(cart, args.token, userId); } catch { return null; }
  if (!cart.saleId) return null;
  const sale = await context.prisma.sale.findUnique({
    where: { id: cart.saleId },
    select: { id: true, receiptNumber: true, pickupStatus: true, currencyCode: true, totalCents: true, taxCents: true, completedAt: true, lines: { select: { titleSnapshot: true, variantTitleSnapshot: true, quantity: true, totalCents: true }, orderBy: { lineNumber: "asc" }, take: 100 } },
  });
  if (!sale) return null;
  return { ...sale, completedAt: sale.completedAt?.toISOString() ?? null, lines: sale.lines.map((line) => ({ ...line, quantity: line.quantity.toString() })) };
}

/** Staff hand an online pickup order over at the counter. Only a paid, ready order moves; repeating is a no-op. */
export async function markSalePickedUp(_root: unknown, args: { saleId: string }, context: Context) {
  const session = requireSession(context) as Session;
  const sale = await context.prisma.sale.findUnique({ where: { id: args.saleId }, select: { id: true, businessId: true, storeId: true, pickupStatus: true, status: true } });
  if (!sale?.businessId || !sale.storeId) throw new GraphQLError("Sale not found");
  assertStorePermission(session, sale.businessId, sale.storeId, "canManageSales");
  if (sale.pickupStatus === "picked_up") return { saleId: sale.id, pickupStatus: "picked_up" };
  if (sale.pickupStatus !== "ready_for_pickup" || sale.status !== "completed") throw new GraphQLError("Only a paid order waiting for pickup can be handed over");
  const updated = await context.prisma.sale.updateMany({ where: { id: sale.id, pickupStatus: "ready_for_pickup", status: "completed" }, data: { pickupStatus: "picked_up" } });
  if (!updated.count) throw new GraphQLError("This order changed; refresh and try again");
  return { saleId: sale.id, pickupStatus: "picked_up" };
}

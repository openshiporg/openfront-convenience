import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";
import type { Session } from "../access";
import { calculateLineAmounts } from "../lib/money";
import { findEffectivePriceEntry, findEffectiveTaxRate } from "../lib/retailPricing";
import { plainDocumentText } from "./publicStorefrontProjection";

// Adapted from canonical security/cart-access: raw Cart/CartLine stay locked.
// Public reads are explicit DTOs; customer IDs and prices never come from input.
async function publishedStore(db: Prisma.TransactionClient) {
  const businesses = await db.business.findMany({ where: { status: "active", storefrontStatus: "published" }, include: { storefrontStore: true }, take: 2 });
  const business = businesses.length === 1 ? businesses[0] : null;
  const store = business?.storefrontStore;
  if (!business || !store || store.status !== "active" || store.businessId !== business.id) throw new Error("Store unavailable");
  return { business, store };
}

const CATALOG_PAGE_SIZE = 48;
export async function storefrontCatalog(_root: unknown, args: { search?: string | null; category?: string | null; page?: number | null; productId?: string | null }, context: Context) {
  const { business, store } = await publishedStore(context.prisma);
  const search = (args.search ?? "").trim().slice(0, 100);
  const category = (args.category ?? "").trim().slice(0, 100);
  const page = Number.isSafeInteger(args.page) && Number(args.page) > 0 ? Math.min(Number(args.page), 10_000) : 1;
  const where: Prisma.ProductWhereInput = {
    businessId: business.id,
    status: "active",
    regulatedSaleType: "none",
    variants: { some: { status: "active", sellBy: "unit" } },
    ...(args.productId ? { id: args.productId } : {}),
    ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}),
    ...(category ? { categories: { some: { name: category, status: "active" } } } : {}),
  };
  const [products, total, categories] = await Promise.all([
    context.prisma.product.findMany({
      where,
      select: { id: true, title: true, description: true, categories: { select: { name: true }, take: 1 }, variants: { where: { status: "active", sellBy: "unit" }, select: { id: true, title: true, defaultPriceCents: true, unitOfMeasure: true, trackInventory: true, stockLevels: { where: { storeId: store.id }, select: { onHandQuantity: true } } }, take: 12, orderBy: { id: "asc" } } },
      take: CATALOG_PAGE_SIZE, skip: (page - 1) * CATALOG_PAGE_SIZE, orderBy: { title: "asc" },
    }),
    context.prisma.product.count({ where }),
    context.prisma.productCategory.findMany({
      where: { businessId: business.id, status: "active", products: { some: { businessId: business.id, status: "active", regulatedSaleType: "none" } } },
      select: { name: true }, orderBy: { name: "asc" }, take: 100,
    }),
  ]);
  const now = new Date();
  return { currency: store.currencyCode, page, pageSize: CATALOG_PAGE_SIZE, total, categories: categories.map(entry => entry.name), products: await Promise.all(products.map(async product => ({ id: product.id, title: product.title, description: plainDocumentText(product.description, 2000), category: product.categories[0]?.name ?? "Shop", variants: await Promise.all(product.variants.map(async variant => {
    const price = store.defaultPriceBookId ? await findEffectivePriceEntry(context.prisma, { businessId: business.id, priceBookId: store.defaultPriceBookId, variantId: variant.id, quantity: "1.0000", at: now }) : null;
    // Availability only, never quantities: "in_stock", "ask" (tracked, none on hand) or "untracked".
    const onHand = variant.stockLevels.reduce((sum, level) => sum + Number(level.onHandQuantity), 0);
    const availability = !variant.trackInventory ? "untracked" : onHand > 0 ? "in_stock" : "ask";
    return { id: variant.id, title: variant.title, unitOfMeasure: variant.unitOfMeasure, priceCents: price?.amountCents ?? variant.defaultPriceCents, availability };
  })) }))) };
}

async function currentCustomerId(db: Prisma.TransactionClient, context: Context, lock = false) {
  const session: Session | undefined = context.session;
  if (!session?.itemId || session.apiKeyId) return undefined;
  // The cookie is checked at request start; fence revocation through draft COMMIT.
  if (lock) await db.$queryRaw(Prisma.sql`SELECT id FROM "User" WHERE id = ${session.itemId} FOR SHARE`);
  const live = await db.user.findUnique({ where: { id: session.itemId }, select: { sessionVersion: true } });
  if (!live || !Number.isSafeInteger(session.data.sessionVersion) || live.sessionVersion !== session.data.sessionVersion) throw new Error("Customer session expired");
  return session.itemId;
}

const digest = (token: string) => createHash("sha256").update(token).digest("hex");
function assertProof(cart: { source: string; customerId: string | null; guestTokenDigest: string; expiresAt: Date | null }, token: string, userId?: string) {
  if (cart.source !== "storefront" || !cart.expiresAt || cart.expiresAt <= new Date()) throw new Error("Basket unavailable");
  if (cart.customerId) { if (cart.customerId !== userId) throw new Error("Basket unavailable"); return; }
  const expected = Buffer.from(cart.guestTokenDigest, "hex");
  const actual = Buffer.from(digest(token), "hex");
  if (!/^[a-f0-9]{64}$/.test(token) || expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new Error("Basket unavailable");
}
const basketSelection = { id: true, status: true, currencyCode: true, subtotalCents: true, taxCents: true, totalCents: true, lines: { select: { id: true, titleSnapshot: true, variantTitleSnapshot: true, quantity: true, unitPriceCents: true, totalCents: true }, orderBy: { createdAt: "asc" as const }, take: 50 } };
function basketDto(cart: NonNullable<Awaited<ReturnType<typeof readBasket>>>) { return { ...cart, lines: cart.lines.map(line => ({ ...line, quantity: line.quantity.toString() })) }; }
async function readBasket(db: Prisma.TransactionClient, id: string) { return db.cart.findUnique({ where: { id }, select: basketSelection }); }

export async function storefrontBasket(_root: unknown, args: { cartId: string; token: string }, context: Context) {
  const userId = await currentCustomerId(context.prisma, context);
  const cart = await context.prisma.cart.findUnique({ where: { id: args.cartId } });
  if (!cart) return null;
  assertProof(cart, args.token, userId);
  const result = await readBasket(context.prisma, cart.id);
  return result ? basketDto(result) : null;
}

export async function updateStorefrontBasket(_root: unknown, args: { input: { cartId: string; token: string; variantId?: string; lineId?: string; quantity: number; claim?: boolean } }, context: Context) {
  const input = args.input;
  if (!/^[a-f0-9]{64}$/.test(input.token) || !/^[a-zA-Z0-9-]{10,64}$/.test(input.cartId)) throw new Error("Basket unavailable");
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 0 || input.quantity > 99) throw new Error("Quantity must be between 0 and 99");
  return context.prisma.$transaction(async db => {
    const userId = await currentCustomerId(db, context, true);
    await db.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`customer-basket:${input.cartId}`}))::text`);
    const { business, store } = await publishedStore(db);
    let cart = await db.cart.findUnique({ where: { id: input.cartId } });
    if (cart) {
      assertProof(cart, input.token, userId);
      if (cart.businessId !== business.id || cart.storeId !== store.id || cart.status !== "open") throw new Error("Basket unavailable");
    } else {
      if (!input.variantId || input.quantity === 0) throw new Error("Basket unavailable");
      cart = await db.cart.create({ data: { id: input.cartId, businessId: business.id, storeId: store.id, cartNumber: `WEB-${randomUUID()}`, source: "storefront", currencyCode: store.currencyCode, priceBookId: store.defaultPriceBookId, customerId: userId, guestTokenDigest: digest(input.token), expiresAt: new Date(Date.now() + 86400000) } });
    }
    if (input.claim && userId && !cart.customerId) await db.cart.update({ where: { id: cart.id }, data: { customerId: userId } });
    if (input.lineId) {
      const line = await db.cartLine.findFirst({ where: { id: input.lineId, cartId: cart.id } });
      if (!line) throw new Error("Basket item unavailable");
      if (input.quantity === 0) await db.cartLine.delete({ where: { id: line.id } });
      else input.variantId = line.variantId ?? undefined;
    }
    if (input.variantId && input.quantity > 0) {
      const variant = await db.productVariant.findFirst({ where: { id: input.variantId, businessId: business.id, status: "active", sellBy: "unit", product: { status: "active", regulatedSaleType: "none", businessId: business.id } }, include: { product: true } });
      if (!variant?.product) throw new Error("Item unavailable");
      if (await db.cartLine.count({ where: { cartId: cart.id } }) >= 50 && !input.lineId) throw new Error("Basket limit reached");
      const quantity = `${input.quantity}.0000`;
      const price = cart.priceBookId ? await findEffectivePriceEntry(db, { businessId: business.id, priceBookId: cart.priceBookId, variantId: variant.id, quantity, at: new Date() }) : null;
      const tax = await findEffectiveTaxRate(db, { businessId: business.id, storeId: store.id, taxCategoryId: variant.product.taxCategoryId, at: new Date() });
      if (tax && tax.inclusive !== store.pricesIncludeTax) throw new Error("Item tax configuration unavailable");
      const unitPriceCents = price?.amountCents ?? variant.defaultPriceCents;
      const amounts = calculateLineAmounts({ unitPriceCents, quantity, taxRateBasisPoints: tax?.rateBasisPoints ?? 0, taxInclusive: tax?.inclusive ?? false });
      const data = { businessId: business.id, storeId: store.id, cartId: cart.id, variantId: variant.id, titleSnapshot: variant.product.title, variantTitleSnapshot: variant.title, skuSnapshot: variant.sku, quantity, unitOfMeasure: variant.unitOfMeasure, unitPriceCents, subtotalCents: amounts.subtotalCents, discountCents: amounts.discountCents, taxCents: amounts.taxCents, totalCents: amounts.totalCents, taxRateBasisPoints: tax?.rateBasisPoints ?? 0, taxInclusive: tax?.inclusive ?? false, priceBookEntryId: price?.id ?? null, priceSource: price ? "price_book" as const : "variant_default" as const };
      if (input.lineId) await db.cartLine.update({ where: { id: input.lineId }, data }); else await db.cartLine.create({ data });
    }
    const sums = await db.cartLine.aggregate({ where: { cartId: cart.id }, _sum: { subtotalCents: true, taxCents: true, totalCents: true } });
    // Each basket change keeps the basket alive for another day, matching the cookie.
    await db.cart.update({ where: { id: cart.id }, data: { subtotalCents: sums._sum.subtotalCents ?? 0, taxCents: sums._sum.taxCents ?? 0, totalCents: sums._sum.totalCents ?? 0, expiresAt: new Date(Date.now() + 86400000) } });
    const result = await readBasket(db, cart.id);
    if (!result) throw new Error("Basket unavailable");
    return basketDto(result);
  });
}

/** The signed-in customer's own loyalty accounts (linked by user, never by email). */
export async function storefrontRewards(_root: unknown, _args: Record<string, never>, context: Context) {
  const userId = await currentCustomerId(context.prisma, context);
  if (!userId) return [];
  const { business, store } = await publishedStore(context.prisma);
  const accounts = await context.prisma.loyaltyAccount.findMany({
    where: { userId, businessId: business.id, status: { in: ["active", "paused"] } },
    select: {
      id: true,
      accountNumber: true,
      status: true,
      tier: true,
      pointsBalance: true,
      lifetimePoints: true,
      program: { select: { name: true, redemptionPoints: true, redemptionValueCents: true } },
      entries: { select: { type: true, pointsDelta: true, balanceAfter: true, occurredAt: true }, orderBy: { occurredAt: "desc" }, take: 10 },
    },
    take: 5,
  });
  return accounts.map((account) => ({
    ...account,
    currencyCode: store.currencyCode,
    entries: account.entries.map((entry) => ({ ...entry, occurredAt: entry.occurredAt?.toISOString() ?? null })),
  }));
}

export async function storefrontHistory(_root: unknown, args: { saleId?: string }, context: Context) {
  const userId = await currentCustomerId(context.prisma, context);
  if (!userId) return [];
  // Never claim receipts by an unverified email or accept a client customerId.
  return (await context.prisma.sale.findMany({ where: { customerId: userId, ...(args.saleId ? { id: args.saleId } : {}) }, select: { id: true, receiptNumber: true, status: true, completedAt: true, currencyCode: true, totalCents: true, lines: { select: { titleSnapshot: true, variantTitleSnapshot: true, quantity: true, unitPriceCents: true, totalCents: true }, take: 250 } }, orderBy: { completedAt: "desc" }, take: 50 })).map(sale => ({ ...sale, completedAt: sale.completedAt?.toISOString() ?? null, lines: sale.lines.map(line => ({ ...line, quantity: line.quantity.toString() })) }));
}

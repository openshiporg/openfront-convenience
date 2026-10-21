import type { Prisma } from "@prisma/client";

import { compareQuantities, normalizeQuantity } from "./quantity";

const MAX_EFFECTIVE_PRICE_CANDIDATES = 200;

export type EffectivePriceCandidate = {
  id: string;
  minQuantity: { toString(): string };
  startsAt: Date | null;
  createdAt: Date;
};

/**
 * Higher quantity tiers win; among equal tiers, the latest dated entry wins.
 * An undated base price is deliberately last, independent of PostgreSQL's
 * NULL ordering defaults. Creation time and id make corrupt overlaps stable.
 */
export function compareEffectivePriceCandidates(
  left: EffectivePriceCandidate,
  right: EffectivePriceCandidate,
): number {
  const tier = compareQuantities(
    normalizeQuantity(left.minQuantity.toString()),
    normalizeQuantity(right.minQuantity.toString()),
  );
  if (tier !== 0) return -tier;

  const leftStart = left.startsAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  const rightStart = right.startsAt?.getTime() ?? Number.NEGATIVE_INFINITY;
  if (leftStart !== rightStart) return rightStart - leftStart;

  const created = right.createdAt.getTime() - left.createdAt.getTime();
  return created || left.id.localeCompare(right.id);
}

export async function findEffectivePriceEntry(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    priceBookId: string;
    variantId: string;
    quantity: string;
    at: Date;
  },
) {
  const quantity = normalizeQuantity(input.quantity);
  const candidates = await transaction.priceBookEntry.findMany({
    where: {
      businessId: input.businessId,
      priceBookId: input.priceBookId,
      variantId: input.variantId,
      status: "active",
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: input.at } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: input.at } }] },
        { minQuantity: { lte: quantity } },
        { OR: [{ maxQuantity: null }, { maxQuantity: { gte: quantity } }] },
      ],
    },
    orderBy: [{ minQuantity: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    take: MAX_EFFECTIVE_PRICE_CANDIDATES + 1,
  });
  if (candidates.length > MAX_EFFECTIVE_PRICE_CANDIDATES) {
    throw new Error(
      "Effective price history exceeds the bounded evaluation limit",
    );
  }
  candidates.sort(compareEffectivePriceCandidates);
  return candidates[0] ?? null;
}

export async function findEffectiveTaxRate(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    storeId: string;
    taxCategoryId: string | null;
    at: Date;
  },
) {
  if (!input.taxCategoryId) return null;
  const rates = await transaction.taxRate.findMany({
    where: {
      businessId: input.businessId,
      storeId: input.storeId,
      taxCategoryId: input.taxCategoryId,
      status: "active",
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: input.at } }] },
        { OR: [{ endsAt: null }, { endsAt: { gt: input.at } }] },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 2,
  });
  if (rates.length > 1) {
    throw new Error(
      "Multiple tax rates apply to this category; configure one verified composite rate before checkout",
    );
  }
  return rates[0] ?? null;
}

export function assertSellQuantity(
  sellBy: "unit" | "weight" | "volume",
  quantity: string,
): string {
  const normalized = normalizeQuantity(quantity);
  if (sellBy === "unit" && !/^\d+(?:\.0{1,4})?$/.test(normalized)) {
    throw new Error("Unit-priced products must be sold in whole units");
  }
  return normalized;
}

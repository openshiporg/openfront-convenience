import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";
import { Prisma } from "@prisma/client";

import { compareQuantities, normalizeQuantity } from "../lib/quantity";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

export async function setRetailPrice(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      priceBookId: string;
      variantId: string;
      amountCents: number;
      minQuantity?: string | null;
      startsAt: string;
      endsAt?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (
    !Number.isSafeInteger(args.input.amountCents) ||
    args.input.amountCents < 0
  ) {
    throw new Error("Retail price must be non-negative integer cents");
  }
  const minQuantity = normalizeQuantity(args.input.minQuantity ?? "1");
  if (compareQuantities(minQuantity, "0") <= 0)
    throw new Error("Minimum quantity must be positive");
  const startsAt = new Date(args.input.startsAt);
  const endsAt = args.input.endsAt ? new Date(args.input.endsAt) : null;
  if (
    !Number.isFinite(startsAt.getTime()) ||
    (endsAt && !Number.isFinite(endsAt.getTime()))
  ) {
    throw new Error("Price effective timestamps must be valid");
  }
  if (endsAt && endsAt <= startsAt)
    throw new Error("Price end must be after its start");

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePricing",
    scope: "setRetailPrice",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, minQuantity, startsAt, endsAt },
    resourceType: "PriceBookEntry",
    action: "pricing.entry.set",
    execute: async (transaction, idempotencyId) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`retail-price:${args.input.priceBookId}:${args.input.variantId}:${minQuantity}`}))::text AS "locked"`,
      );
      const [priceBook, variant] = await Promise.all([
        transaction.priceBook.findFirst({
          where: {
            id: args.input.priceBookId,
            businessId: args.input.businessId,
            status: "active",
            stores: { some: { id: args.input.storeId } },
          },
        }),
        transaction.productVariant.findFirst({
          where: {
            id: args.input.variantId,
            businessId: args.input.businessId,
            status: "active",
          },
        }),
      ]);
      if (!priceBook || !variant)
        throw new Error("Active price book or product variant not found");
      const priceScope = {
        businessId: args.input.businessId,
        priceBookId: priceBook.id,
        variantId: variant.id,
        status: "active" as const,
        minQuantity,
      };
      const continuationSource = endsAt
        ? await transaction.priceBookEntry.findFirst({
            where: {
              ...priceScope,
              startsAt: { lt: endsAt },
              OR: [{ endsAt: null }, { endsAt: { gt: endsAt } }],
            },
            orderBy: [{ startsAt: "desc" }, { updatedAt: "desc" }],
          })
        : null;
      const existingAtContinuation = endsAt
        ? await transaction.priceBookEntry.findFirst({
            where: { ...priceScope, startsAt: endsAt },
            select: { id: true },
          })
        : null;
      await transaction.priceBookEntry.updateMany({
        where: {
          ...priceScope,
          startsAt: { lt: startsAt },
          OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }],
        },
        data: { endsAt: startsAt },
      });
      // A correction at the same instant, or a new interval covering a later
      // scheduled row, supersedes only the covered portion. A bounded
      // temporary price restores the previously effective interval afterward.
      await transaction.priceBookEntry.updateMany({
        where: {
          ...priceScope,
          startsAt: endsAt ? { gte: startsAt, lt: endsAt } : { gte: startsAt },
        },
        data: { status: "inactive" },
      });
      if (endsAt && continuationSource && !existingAtContinuation) {
        await transaction.priceBookEntry.create({
          data: {
            businessId: args.input.businessId,
            priceBookId: priceBook.id,
            variantId: variant.id,
            lookupKey: `${priceBook.id}:${variant.id}:${minQuantity}:${endsAt.toISOString()}:${randomUUID()}`,
            amountCents: continuationSource.amountCents,
            minQuantity: continuationSource.minQuantity,
            maxQuantity: continuationSource.maxQuantity,
            status: "active",
            startsAt: endsAt,
            endsAt: continuationSource.endsAt,
            metadata: {
              ...(continuationSource.metadata &&
              typeof continuationSource.metadata === "object" &&
              !Array.isArray(continuationSource.metadata)
                ? continuationSource.metadata
                : {}),
              restoredAfterTemporaryPriceId: idempotencyId,
              restoredFromPriceEntryId: continuationSource.id,
            },
          },
        });
      }
      const entry = await transaction.priceBookEntry.create({
        data: {
          businessId: args.input.businessId,
          priceBookId: priceBook.id,
          variantId: variant.id,
          lookupKey: `${priceBook.id}:${variant.id}:${minQuantity}:${startsAt.toISOString()}:${randomUUID()}`,
          amountCents: args.input.amountCents,
          minQuantity,
          status: "active",
          startsAt,
          endsAt,
          metadata: { idempotencyId },
        },
      });
      return { id: entry.id, status: entry.status, reference: variant.sku };
    },
  });
}

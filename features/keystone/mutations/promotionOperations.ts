import { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import { allocateDiscountByCapacity } from "../lib/discountAllocation";
import { calculateBasisPoints, calculateLineAmounts } from "../lib/money";
import { addQuantities, compareQuantities } from "../lib/quantity";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

function discountForRule(
  rule: {
    benefitMethod: string;
    valueBasisPoints: number | null;
    valueCents: number | null;
    maxDiscountCents: number | null;
  },
  subtotalCents: number,
): number {
  let discount: number;
  switch (rule.benefitMethod) {
    case "percentage":
      discount = calculateBasisPoints(
        subtotalCents,
        rule.valueBasisPoints ?? 0,
      );
      break;
    case "fixed_amount":
      discount = rule.valueCents ?? 0;
      break;
    case "fixed_price":
      discount = Math.max(
        0,
        subtotalCents - (rule.valueCents ?? subtotalCents),
      );
      break;
    case "free_item":
      discount = subtotalCents;
      break;
    default:
      throw new Error(`Unsupported promotion benefit ${rule.benefitMethod}`);
  }
  if (rule.maxDiscountCents != null)
    discount = Math.min(discount, rule.maxDiscountCents);
  return Math.min(subtotalCents, Math.max(0, discount));
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

export async function applyPromotionToCart(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      cartId: string;
      promotionId: string;
      code?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const input = args.input;
  return runIdempotentOperation({
    context,
    businessId: input.businessId,
    storeId: input.storeId,
    permission: "canManageSales",
    scope: "applyPromotionToCart",
    idempotencyKey: input.idempotencyKey,
    input,
    resourceType: "Promotion",
    action: "promotion.apply",
    execute: async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock_shared(hashtext(${`checkout-policy:${input.businessId}`}))::text AS "locked"`,
      );
      const now = new Date();
      const cart = await transaction.cart.findFirst({
        where: {
          id: input.cartId,
          businessId: input.businessId,
          storeId: input.storeId,
          status: "open",
        },
        include: {
          promotions: true,
          lines: {
            include: {
              variant: {
                include: { product: { include: { categories: true } } },
              },
              promotions: true,
            },
          },
        },
      });
      if (!cart || !cart.lines.length)
        throw new Error("Non-empty open cart not found");
      if (
        cart.promotions.some((promotion) => promotion.id === input.promotionId)
      ) {
        throw new Error("Promotion is already applied to this cart");
      }

      const promotion = await transaction.promotion.findFirst({
        where: {
          id: input.promotionId,
          businessId: input.businessId,
          status: "active",
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
            {
              OR: [
                { stores: { none: {} } },
                { stores: { some: { id: input.storeId } } },
              ],
            },
          ],
        },
        include: {
          stores: true,
          rules: {
            orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
            include: { products: true, categories: true },
          },
        },
      });
      if (!promotion)
        throw new Error("Active promotion not found for this store");
      const promotionMetadata =
        promotion.metadata &&
        typeof promotion.metadata === "object" &&
        !Array.isArray(promotion.metadata)
          ? (promotion.metadata as Record<string, unknown>)
          : {};
      const promotionRevision = promotionMetadata.revision;
      if (typeof promotionRevision !== "string" || !promotionRevision) {
        throw new Error(
          "Promotion must be resaved with revision evidence before it can be applied",
        );
      }
      if (
        promotion.requiresCode &&
        promotion.code?.toLowerCase() !== input.code?.trim().toLowerCase()
      ) {
        throw new Error("A valid promotion code is required");
      }
      if (cart.promotions.length && !promotion.stackable) {
        throw new Error(
          "Promotion cannot stack with an existing cart promotion",
        );
      }
      if (cart.promotions.some((existing) => !existing.stackable)) {
        throw new Error("An existing cart promotion does not allow stacking");
      }
      if (promotion.usageLimit != null) {
        const redemptionCount = await transaction.promotionRedemption.count({
          where: {
            promotionId: promotion.id,
            sale: { status: { not: "voided" } },
          },
        });
        if (redemptionCount >= promotion.usageLimit)
          throw new Error("Promotion usage limit reached");
      }
      if (promotion.perCustomerLimit != null) {
        if (!cart.customerId)
          throw new Error("Promotion requires an identified customer");
        const customerRedemptions = await transaction.promotionRedemption.count(
          {
            where: {
              promotionId: promotion.id,
              sale: { customerId: cart.customerId, status: { not: "voided" } },
            },
          },
        );
        if (customerRedemptions >= promotion.perCustomerLimit) {
          throw new Error("Customer promotion limit reached");
        }
      }
      if (!promotion.rules.length) throw new Error("Promotion has no rules");

      let appliedDiscount = 0;
      const productEligible = (
        line: (typeof cart.lines)[number],
        rule: (typeof promotion.rules)[number],
      ) => {
        const product = line.variant?.product;
        if (!product?.discountable) return false;
        const productIds = new Set(rule.products.map((entry) => entry.id));
        const categoryIds = new Set(rule.categories.map((entry) => entry.id));
        const scoped = productIds.size > 0 || categoryIds.size > 0;
        return (
          !scoped ||
          productIds.has(product.id) ||
          product.categories.some((category) => categoryIds.has(category.id))
        );
      };
      const applyLineDiscount = async (
        line: (typeof cart.lines)[number],
        ruleDiscountCents: number,
      ) => {
        if (ruleDiscountCents <= 0) return;
        const available = line.subtotalCents - line.discountCents;
        if (ruleDiscountCents > available) {
          throw new Error(
            "Promotion allocation exceeds the eligible line amount",
          );
        }
        const discountCents = line.discountCents + ruleDiscountCents;
        const amounts = calculateLineAmounts({
          unitPriceCents: line.unitPriceCents,
          quantity: line.quantity.toString(),
          discountCents,
          taxRate: line.taxRate ?? 0,
          taxInclusive: line.taxInclusive,
        });
        const existingMetadata =
          line.metadata &&
          typeof line.metadata === "object" &&
          !Array.isArray(line.metadata)
            ? (line.metadata as Record<string, unknown>)
            : {};
        const previousAllocations =
          existingMetadata.promotionAllocations &&
          typeof existingMetadata.promotionAllocations === "object" &&
          !Array.isArray(existingMetadata.promotionAllocations)
            ? (existingMetadata.promotionAllocations as Record<string, unknown>)
            : {};
        const previousAmount = previousAllocations[promotion.id] ?? 0;
        if (
          !Number.isSafeInteger(previousAmount) ||
          Number(previousAmount) < 0
        ) {
          throw new Error("Cart promotion allocation evidence is invalid");
        }
        const metadata = {
          ...existingMetadata,
          promotionAllocations: {
            ...previousAllocations,
            [promotion.id]: Number(previousAmount) + ruleDiscountCents,
          },
        };
        await transaction.cartLine.update({
          where: { id: line.id },
          data: {
            discountCents,
            taxCents: amounts.taxCents,
            totalCents: amounts.totalCents,
            promotions: { connect: { id: promotion.id } },
            metadata: metadata as Prisma.InputJsonValue,
          },
        });
        line.discountCents = discountCents;
        line.taxCents = amounts.taxCents;
        line.totalCents = amounts.totalCents;
        line.metadata = metadata as Prisma.JsonValue;
        appliedDiscount += ruleDiscountCents;
      };

      for (const rule of promotion.rules) {
        if (
          !(
            ["item_discount", "quantity_break", "basket_discount"] as string[]
          ).includes(rule.ruleType)
        ) {
          throw new Error(
            `Promotion rule type ${rule.ruleType} is not supported by POS`,
          );
        }
        const cartSubtotal = cart.lines.reduce(
          (sum, line) => sum + line.subtotalCents,
          0,
        );
        if (
          rule.minSubtotalCents != null &&
          cartSubtotal < rule.minSubtotalCents
        )
          continue;

        const eligible = cart.lines.filter(
          (line) =>
            productEligible(line, rule) &&
            line.subtotalCents > line.discountCents,
        );
        if (rule.ruleType === "basket_discount") {
          const capacities = eligible.map(
            (line) => line.subtotalCents - line.discountCents,
          );
          const eligibleAvailable = capacities.reduce(
            (sum, amount) => sum + amount,
            0,
          );
          const benefit = discountForRule(rule, eligibleAvailable);
          const allocations = allocateDiscountByCapacity(benefit, capacities);
          for (const [index, line] of eligible.entries()) {
            await applyLineDiscount(line, allocations[index]);
          }
          continue;
        }

        if (rule.ruleType === "quantity_break") {
          const groups = new Map<string, typeof eligible>();
          for (const line of eligible) {
            const variantId = line.variant?.id ?? line.variantId;
            if (!variantId)
              throw new Error("Quantity promotion line has no variant");
            const group = groups.get(variantId) ?? [];
            group.push(line);
            groups.set(variantId, group);
          }
          for (const group of groups.values()) {
            const groupQuantity = group.reduce(
              (sum, line) => addQuantities(sum, line.quantity.toString()),
              "0.0000",
            );
            if (
              rule.minQuantity &&
              compareQuantities(groupQuantity, rule.minQuantity.toString()) < 0
            ) {
              continue;
            }
            const capacities = group.map(
              (line) => line.subtotalCents - line.discountCents,
            );
            const benefit = discountForRule(
              rule,
              capacities.reduce((sum, amount) => sum + amount, 0),
            );
            const allocations = allocateDiscountByCapacity(
              benefit,
              capacities,
            );
            for (const [index, line] of group.entries()) {
              await applyLineDiscount(line, allocations[index]);
            }
          }
          continue;
        }

        for (const line of eligible) {
          if (
            rule.minQuantity &&
            compareQuantities(
              line.quantity.toString(),
              rule.minQuantity.toString(),
            ) < 0
          ) {
            continue;
          }
          const available = line.subtotalCents - line.discountCents;
          await applyLineDiscount(line, discountForRule(rule, available));
        }
      }

      if (appliedDiscount <= 0)
        throw new Error("Cart does not satisfy this promotion");
      const cartMetadata =
        cart.metadata &&
        typeof cart.metadata === "object" &&
        !Array.isArray(cart.metadata)
          ? (cart.metadata as Record<string, unknown>)
          : {};
      const priorRevisions =
        cartMetadata.promotionRevisions &&
        typeof cartMetadata.promotionRevisions === "object" &&
        !Array.isArray(cartMetadata.promotionRevisions)
          ? (cartMetadata.promotionRevisions as Record<string, unknown>)
          : {};
      await transaction.cart.update({
        where: { id: cart.id },
        data: {
          promotions: { connect: { id: promotion.id } },
          metadata: {
            ...cartMetadata,
            promotionRevisions: {
              ...priorRevisions,
              [promotion.id]: promotionRevision,
            },
          } as Prisma.InputJsonValue,
        },
      });
      const updated = await recalculateCart(transaction, cart.id);
      return {
        id: promotion.id,
        status: "applied",
        reference: updated.cartNumber,
      };
    },
  });
}

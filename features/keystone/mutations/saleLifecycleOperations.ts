import type { Context } from ".keystone/types";
import { Prisma } from "@prisma/client";

import {
  assertStorePermission,
  canAccessStore,
  type Session,
} from "../access";
import {
  admitManagerPinAttempt,
  requireManagerPinAuthority,
} from "../lib/managerAuthority";
import { lockSaleRefundOrVoid } from "../lib/saleRefundVoidLock";
import { assertCashLedger, assertRetailRegister, retailRegisterInclude } from "../lib/retailCashBoundary";
import {
  posReceiptChildWhere,
  posReceiptRefundChildWhere,
  posReceiptSaleWhere,
} from "../lib/saleOwnershipScope";
import { addQuantities, normalizeQuantity } from "../lib/quantity";
import type { OperationResult } from "./cashOperations";
import { requireSession, runIdempotentOperation } from "./operationRunner";

const MAX_RECEIPT_LINES = 250;
const MAX_RECEIPT_TENDERS = 50;
const MAX_RECEIPT_REFUNDS = 100;
const MAX_RECEIPT_REFUND_LINES = 250;
const MAX_RECEIPT_REFUND_ALLOCATIONS = 100;

export async function posSaleReceipt(
  _root: unknown,
  args: { input: { businessId: string; storeId: string; saleId: string } },
  context: Context,
) {
  const session = requireSession(context) as Session;
  assertStorePermission(
    session,
    args.input.businessId,
    args.input.storeId,
    "canReadSales",
  );
  const ownershipScope = {
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    saleId: args.input.saleId,
  };
  const sale = await context.prisma.sale.findFirst({
    where: posReceiptSaleWhere(ownershipScope),
    include: {
      store: { select: { name: true, code: true, timezone: true } },
      cashier: {
        select: { employeeNumber: true, user: { select: { name: true } } },
      },
    },
  });
  if (!sale || !sale.store) throw new Error("Sale receipt not found");
  const canReadPayments = canAccessStore(
    session,
    ownershipScope.businessId,
    ownershipScope.storeId,
    "canReadPayments",
  );
  const scopedSale = { ...ownershipScope, saleId: sale.id };
  const [lines, tenders, refunds] = await Promise.all([
    context.prisma.saleLine.findMany({
      where: posReceiptChildWhere(scopedSale),
      orderBy: { lineNumber: "asc" },
      take: MAX_RECEIPT_LINES + 1,
    }),
    canReadPayments
      ? context.prisma.tender.findMany({
          where: posReceiptChildWhere(scopedSale),
          orderBy: { createdAt: "asc" },
          take: MAX_RECEIPT_TENDERS + 1,
        })
      : Promise.resolve([]),
    canReadPayments
      ? context.prisma.refund.findMany({
          where: posReceiptChildWhere(scopedSale),
          orderBy: { processedAt: "asc" },
          take: MAX_RECEIPT_REFUNDS + 1,
        })
      : Promise.resolve([]),
  ]);
  if (
    lines.length > MAX_RECEIPT_LINES ||
    tenders.length > MAX_RECEIPT_TENDERS ||
    refunds.length > MAX_RECEIPT_REFUNDS
  ) {
    throw new Error(
      "Receipt evidence exceeds the bounded line, tender, or refund cardinality",
    );
  }
  const refundIds = refunds.map((refund) => refund.id);
  const [refundLines, refundAllocations] =
    canReadPayments && refundIds.length
      ? await Promise.all([
          context.prisma.refundLine.findMany({
            where: posReceiptRefundChildWhere(scopedSale, refundIds),
            orderBy: [{ refundId: "asc" }, { createdAt: "asc" }],
            take: MAX_RECEIPT_REFUND_LINES + 1,
          }),
          context.prisma.refundTenderAllocation.findMany({
            where: posReceiptRefundChildWhere(scopedSale, refundIds),
            orderBy: [{ refundId: "asc" }, { createdAt: "asc" }],
            take: MAX_RECEIPT_REFUND_ALLOCATIONS + 1,
          }),
        ])
      : [[], []];
  if (
    refundLines.length > MAX_RECEIPT_REFUND_LINES ||
    refundAllocations.length > MAX_RECEIPT_REFUND_ALLOCATIONS
  ) {
    throw new Error("Receipt refund evidence exceeds the bounded cardinality");
  }
  return {
    schemaVersion: 1,
    receiptNumber: sale.receiptNumber,
    status: sale.status,
    store: sale.store,
    cashier: sale.cashier
      ? {
          employeeNumber: sale.cashier.employeeNumber,
          name: sale.cashier.user?.name ?? null,
        }
      : null,
    currencyCode: sale.currencyCode,
    startedAt: sale.startedAt.toISOString(),
    completedAt: sale.completedAt?.toISOString() ?? null,
    voidedAt: sale.voidedAt?.toISOString() ?? null,
    subtotalCents: sale.subtotalCents,
    discountCents: sale.discountCents,
    taxCents: sale.taxCents,
    totalCents: sale.totalCents,
    refundedCents: sale.refundedCents,
    paymentDetailsAvailable: canReadPayments,
    lines: lines.map((line) => ({
      lineNumber: line.lineNumber,
      description: [line.titleSnapshot, line.variantTitleSnapshot]
        .filter(Boolean)
        .join(" · "),
      sku: line.skuSnapshot,
      barcode: line.barcodeSnapshot,
      quantity: line.quantity.toString(),
      unitPriceCents: line.unitPriceCents,
      discountCents: line.discountCents,
      taxRate: line.taxRate,
      taxInclusive: line.taxInclusive,
      taxCents: line.taxCents,
      totalCents: line.totalCents,
    })),
    tenders: tenders.map((tender) => ({
      method: tender.method,
      status: tender.status,
      amountCents: tender.amountCents,
      tenderedCents: tender.tenderedCents,
      changeCents: tender.changeCents,
      cardBrand: tender.cardBrand,
      cardLast4: tender.cardLast4,
      providerPaymentId: tender.providerPaymentId,
    })),
    refunds: refunds.map((refund) => ({
      refundNumber: refund.refundNumber,
      status: refund.status,
      amountCents: refund.amountCents,
      processedAt: refund.processedAt?.toISOString() ?? null,
      tenderAllocations: refundAllocations
        .filter((allocation) => allocation.refundId === refund.id)
        .map((allocation) => ({
          method: allocation.method,
          amountCents: allocation.amountCents,
          providerRefundId: allocation.providerRefundId,
        })),
      lines: refundLines
        .filter((line) => line.refundId === refund.id)
        .map((line) => ({
          quantity: line.quantity.toString(),
          subtotalCents: line.subtotalCents,
          taxCents: line.taxCents,
          totalCents: line.totalCents,
        })),
    })),
  };
}

export async function voidCompletedPosSale(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      saleId: string;
      registerSessionId: string;
      employeeId: string;
      reason: string;
      managerPin: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const reason = args.input.reason.trim();
  if (reason.length < 4 || reason.length > 500)
    throw new Error("Completed-sale void reason must contain 4-500 characters");
  await admitManagerPinAttempt(
    context.prisma,
    context.session as Session | undefined,
    args.input,
    "a completed-sale void",
    "canManagePayments",
  );
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePayments",
    scope: "voidCompletedPosSale",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, reason },
    resourceType: "Sale",
    action: "sale.completed_void",
    execute: async (transaction, idempotencyId) => {
      await lockSaleRefundOrVoid(transaction, args.input);
      const sale = await transaction.sale.findFirst({
        where: {
          id: args.input.saleId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          registerSessionId: args.input.registerSessionId,
        },
        include: {
          registerSession: { include: retailRegisterInclude },
          tenders: true,
          refunds: { select: { id: true } },
          lines: { include: { inventoryEntries: true } },
          loyaltyAccount: true,
          loyaltyEntries: { where: { type: { in: ["earned", "redeemed"] } } },
        },
      });
      if (!sale) throw new Error("Sale not found for this register session");
      if (sale.loyaltyAccountId) {
        await transaction.$queryRaw(
          Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`loyalty:${sale.loyaltyAccountId}`}))::text AS "locked"`,
        );
      }
      const loyaltyAccount = sale.loyaltyAccountId
        ? await transaction.loyaltyAccount.findFirst({
            where: {
              id: sale.loyaltyAccountId,
              businessId: args.input.businessId,
            },
          })
        : null;
      if (sale.status === "voided")
        return {
          id: sale.id,
          status: sale.status,
          reference: sale.receiptNumber,
        };
      if (
        sale.status !== "completed" ||
        sale.refunds.length ||
        sale.refundedCents !== 0
      ) {
        throw new Error("Only an unrefunded completed sale may be voided");
      }
      if (
        (await transaction.fuelTransaction.count({
          where: { saleId: sale.id, status: "completed" },
        })) > 0
      ) {
        throw new Error(
          "A completed fuel dispense cannot be voided through the merchandise sale workflow",
        );
      }
      if (sale.registerSession?.status !== "open") {
        throw new Error(
          "Completed sale may be voided only while its register session remains open",
        );
      }
      if (
        sale.tenders.some(
          (tender) => tender.method !== "cash" || tender.status !== "captured",
        )
      ) {
        throw new Error(
          "Non-cash captured sales must use the provider-authorized refund workflow",
        );
      }
      const employee = await requireManagerPinAuthority(
        transaction,
        args.input,
        "a completed-sale void",
      );

      assertRetailRegister(sale.registerSession, args.input.businessId, args.input.storeId, sale.currencyCode);
      if (sale.tenders.some((tender) => tender.currencyCode !== sale.currencyCode)) {
        throw new Error("Completed-sale void tender currency does not match original sale");
      }
      await assertCashLedger(transaction, sale.registerSession);
      const cashTotalCents = sale.tenders.reduce(
        (sum, tender) => sum + tender.amountCents,
        0,
      );
      if (sale.registerSession.expectedCashCents < cashTotalCents) {
        throw new Error(
          "Completed-sale void would make expected register cash negative",
        );
      }

      const now = new Date();
      for (const line of sale.lines) {
        for (const original of line.inventoryEntries) {
          const originalDelta = original.quantityDelta.toString();
          if (!originalDelta.startsWith("-")) continue;
          const quantity = normalizeQuantity(originalDelta.slice(1));
          if (!original.stockLevelId)
            throw new Error("Sale inventory entry is missing its stock level");
          const stock = await transaction.stockLevel.findFirst({
            where: {
              id: original.stockLevelId,
              businessId: args.input.businessId,
              storeId: args.input.storeId,
            },
          });
          if (!stock)
            throw new Error("Sale inventory stock level no longer exists");
          const balanceAfter = addQuantities(
            stock.onHandQuantity.toString(),
            quantity,
          );
          await transaction.stockLevel.update({
            where: { id: stock.id },
            data: { onHandQuantity: balanceAfter },
          });
          if (original.lotId) {
            const lot = await transaction.inventoryLot.findFirst({
              where: {
                id: original.lotId,
                businessId: args.input.businessId,
                storeId: args.input.storeId,
              },
            });
            if (!lot) throw new Error("Sale inventory lot no longer exists");
            await transaction.inventoryLot.update({
              where: { id: lot.id },
              data: {
                quantityRemaining: addQuantities(
                  lot.quantityRemaining.toString(),
                  quantity,
                ),
                status: "active",
              },
            });
          }
          await transaction.inventoryLedgerEntry.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              stockLevelId: stock.id,
              locationId: original.locationId,
              variantId: original.variantId,
              lotId: original.lotId,
              type: "return",
              quantityDelta: quantity,
              balanceAfter,
              unitCostCents: original.unitCostCents,
              reason: `Completed-sale void: ${reason}`,
              sourceType: "Sale",
              sourceId: sale.id,
              actorId: employee.id,
              idempotencyId,
              occurredAt: now,
            },
          });
        }
      }

      if (loyaltyAccount && sale.loyaltyEntries.length) {
        const earned = sale.loyaltyEntries.reduce(
          (sum, entry) => sum + Math.max(0, entry.pointsDelta),
          0,
        );
        const redeemed = sale.loyaltyEntries.reduce(
          (sum, entry) => sum + Math.max(0, -entry.pointsDelta),
          0,
        );
        if ((loyaltyAccount.pointsBalance ?? 0) < earned) {
          throw new Error(
            "Loyalty points earned by this sale have already been spent; use a reviewed refund",
          );
        }
        const reversalPoints = redeemed - earned;
        const balanceAfter =
          (loyaltyAccount.pointsBalance ?? 0) + reversalPoints;
        await transaction.loyaltyAccount.update({
          where: { id: loyaltyAccount.id },
          data: {
            pointsBalance: balanceAfter,
            lifetimePoints: Math.max(
              0,
              (loyaltyAccount.lifetimePoints ?? 0) - earned,
            ),
          },
        });
        if (reversalPoints !== 0) {
          await transaction.loyaltyLedgerEntry.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              accountId: loyaltyAccount.id,
              type: "refund_reversal",
              pointsDelta: reversalPoints,
              balanceAfter,
              description: `Voided ${sale.receiptNumber}`,
              saleId: sale.id,
              actorId: employee.id,
              idempotencyId,
              occurredAt: now,
              metadata: { earnedReversed: earned, redeemedRestored: redeemed },
            },
          });
        }
      }

      for (const tender of sale.tenders) {
        await transaction.cashMovement.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            registerSessionId: sale.registerSessionId,
            employeeId: employee.id,
            type: "refund",
            direction: "out",
            amountCents: tender.amountCents,
            reason: `Completed-sale void ${sale.receiptNumber}: ${reason}`,
            saleId: sale.id,
            occurredAt: now,
            idempotencyId,
            metadata: { originalTenderId: tender.id, completedSaleVoid: true },
          },
        });
      }
      await transaction.registerSession.update({
        where: { id: sale.registerSessionId! },
        data: { expectedCashCents: { decrement: cashTotalCents } },
      });
      await transaction.tender.updateMany({
        where: { saleId: sale.id },
        data: { status: "cancelled" },
      });
      const updated = await transaction.sale.update({
        where: { id: sale.id },
        data: {
          status: "voided",
          voidedAt: now,
          metadata: {
            ...(sale.metadata &&
            typeof sale.metadata === "object" &&
            !Array.isArray(sale.metadata)
              ? sale.metadata
              : {}),
            voidReason: reason,
            voidedByEmployeeId: employee.id,
          },
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.receiptNumber,
      };
    },
  });
}

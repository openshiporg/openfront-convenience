import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";

import {
  assertPeriodWithinTradingDate,
  calculateStoreDayTotals,
  normalizeTradingDate,
} from "../lib/reconciliation";
import { addQuantities, quantityToScaledInteger } from "../lib/quantity";
import { assertCashLedger } from "../lib/retailCashBoundary";
import {
  metadataSourceSetDigest,
  sourceSetDigest,
} from "../lib/sourceSetDigest";
import { assertStoreDayRegulatedSourcesSettled } from "../lib/settlementPeriodPolicy";
import {
  BANK_DEPOSIT_TRANSITIONS,
  STORE_DAY_TRANSITIONS,
  evaluateTransition,
} from "../lib/transitionPolicy";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

function parseTimestamp(value: string, label: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()))
    throw new Error(`${label} must be a valid ISO timestamp`);
  return parsed;
}

function assertPeriod(start: Date, end: Date): void {
  if (end <= start)
    throw new Error("Reconciliation period end must be after its start");
  if (end.getTime() - start.getTime() > 48 * 60 * 60 * 1000) {
    throw new Error("A store-day reconciliation period cannot exceed 48 hours");
  }
}

function extendedInventoryCost(
  entries: Array<{
    quantityDelta: { toString(): string };
    unitCostCents: number | null;
  }>,
): number {
  const total = entries.reduce((sum, entry) => {
    const quantity = quantityToScaledInteger(
      entry.quantityDelta.toString().replace(/^-/, ""),
    );
    return (
      sum +
      Number((BigInt(entry.unitCostCents ?? 0) * quantity + 5_000n) / 10_000n)
    );
  }, 0);
  if (!Number.isSafeInteger(total))
    throw new Error("Merchandise COGS exceeds safe integer range");
  return total;
}

function assertCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of cents`);
  }
}

export async function generateStoreDayReconciliation(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      tradingDate: string;
      periodStartedAt: string;
      periodEndedAt: string;
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const tradingDate = normalizeTradingDate(args.input.tradingDate);
  const periodStartedAt = parseTimestamp(
    args.input.periodStartedAt,
    "Period start",
  );
  const periodEndedAt = parseTimestamp(args.input.periodEndedAt, "Period end");
  assertPeriod(periodStartedAt, periodEndedAt);

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageReporting",
    scope: "generateStoreDayReconciliation",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, tradingDate, periodStartedAt: periodStartedAt.toISOString(), periodEndedAt: periodEndedAt.toISOString() },
    resourceType: "StoreDay",
    action: "store_day.generate",
    execute: async (transaction, idempotencyId) => {
      const store = await transaction.store.findFirst({
        where: {
          id: args.input.storeId,
          businessId: args.input.businessId,
          status: { not: "closed" },
        },
      });
      if (!store) throw new Error("Store not found for this business");
      assertPeriodWithinTradingDate(
        tradingDate,
        periodStartedAt,
        periodEndedAt,
        store.timezone,
        "Store-day",
      );

      const lookupKey = `${store.id}:${tradingDate}`;
      const existing = await transaction.storeDay.findUnique({
        where: { lookupKey },
      });
      if (existing) {
        if (existing.status === "reconciled") {
          evaluateTransition(
            STORE_DAY_TRANSITIONS,
            existing.status,
            "reopened",
          );
          await transaction.storeDay.update({
            where: { id: existing.id },
            data: { status: "reopened" },
          });
          evaluateTransition(STORE_DAY_TRANSITIONS, "reopened", "in_review");
        } else {
          evaluateTransition(
            STORE_DAY_TRANSITIONS,
            existing.status,
            "in_review",
          );
        }
      }

      const overlappingDay = await transaction.storeDay.findFirst({
        where: {
          businessId: args.input.businessId,
          storeId: store.id,
          ...(existing ? { id: { not: existing.id } } : {}),
          periodStartedAt: { lt: periodEndedAt },
          periodEndedAt: { gt: periodStartedAt },
        },
        select: { id: true, tradingDate: true },
      });
      if (overlappingDay) {
        throw new Error(
          `Store-day period overlaps ${overlappingDay.tradingDate}`,
        );
      }

      const registerSessions = await transaction.registerSession.findMany({
        where: {
          businessId: args.input.businessId,
          storeId: store.id,
          openedAt: { lt: periodEndedAt },
          OR: [{ closedAt: null }, { closedAt: { gt: periodStartedAt } }],
        },
        include: { register: true },
        orderBy: { openedAt: "asc" },
      });
      const invalidSessions = registerSessions.filter(
        (session) =>
          session.status !== "closed" ||
          session.openedAt < periodStartedAt ||
          !session.closedAt ||
          session.closedAt > periodEndedAt,
      );
      if (invalidSessions.length) {
        throw new Error(
          `${invalidSessions.length} register session(s) cross the store-day boundary or remain open`,
        );
      }

      for (const session of registerSessions) await assertCashLedger(transaction, session);

      const sales = await transaction.sale.findMany({
        where: {
          businessId: args.input.businessId,
          storeId: store.id,
          completedAt: { gte: periodStartedAt, lt: periodEndedAt },
          status: { in: ["completed", "partially_refunded", "refunded"] },
        },
        select: {
          id: true,
          subtotalCents: true,
          discountCents: true,
          taxCents: true,
          totalCents: true,
          lines: {
            select: {
              id: true,
              titleSnapshot: true,
              skuSnapshot: true,
              taxCategorySnapshot: true,
              quantity: true,
              subtotalCents: true,
              discountCents: true,
              taxCents: true,
              totalCents: true,
              inventoryEntries: {
                where: { type: "sale" },
                select: { quantityDelta: true, unitCostCents: true },
              },
            },
          },
        },
        take: 10_001,
      });
      const refunds = await transaction.refund.findMany({
        where: {
          businessId: args.input.businessId,
          storeId: store.id,
          status: "completed",
          processedAt: { gte: periodStartedAt, lt: periodEndedAt },
        },
        select: {
          id: true,
          amountCents: true,
          originalTender: { select: { method: true } },
          tenderAllocations: {
            where: { status: "completed" },
            select: { amountCents: true, method: true },
          },
          lines: {
            select: {
              taxCents: true,
              subtotalCents: true,
              totalCents: true,
              quantity: true,
              returnLine: { select: { disposition: true } },
              saleLine: {
                select: {
                  titleSnapshot: true,
                  skuSnapshot: true,
                  taxCategorySnapshot: true,
                  quantity: true,
                  subtotalCents: true,
                  discountCents: true,
                  inventoryEntries: {
                    where: { type: "sale" },
                    select: { quantityDelta: true, unitCostCents: true },
                  },
                },
              },
            },
          },
        },
        take: 10_001,
      });
      const tenders = await transaction.tender.findMany({
        where: {
          businessId: args.input.businessId,
          storeId: store.id,
          sale: { completedAt: { gte: periodStartedAt, lt: periodEndedAt } },
          status: { in: ["captured", "partially_refunded", "refunded"] },
        },
        select: { id: true, method: true, amountCents: true },
        take: 10_001,
      });
      if (
        sales.length > 10_000 ||
        refunds.length > 10_000 ||
        tenders.length > 10_000
      ) {
        throw new Error(
          "Store-day source records exceed 10,000; use a shorter period",
        );
      }
      const deposits = existing
        ? await transaction.bankDeposit.findMany({
            where: {
              storeDayId: existing.id,
              status: { in: ["deposited", "verified"] },
            },
            select: { id: true, amountCents: true },
          })
        : [];
      const [fuel, lottery, moneyServices] = await Promise.all([
        transaction.fuelTransaction.aggregate({
          where: {
            businessId: args.input.businessId,
            storeId: store.id,
            status: "completed",
            completedAt: { gte: periodStartedAt, lt: periodEndedAt },
          },
          _sum: { totalCents: true },
          _count: { id: true },
        }),
        transaction.lotterySettlement.aggregate({
          where: {
            businessId: args.input.businessId,
            storeId: store.id,
            tradingDate,
            status: { in: ["approved", "exported"] },
            periodStartedAt,
            periodEndedAt,
          },
          _sum: { reportedSettlementCents: true, varianceCents: true },
          _count: { id: true },
        }),
        transaction.moneyServiceSettlement.aggregate({
          where: {
            businessId: args.input.businessId,
            storeId: store.id,
            tradingDate,
            status: { in: ["approved", "exported"] },
            periodStartedAt,
            periodEndedAt,
          },
          _sum: { reportedSettlementCents: true, varianceCents: true },
          _count: { id: true },
        }),
      ]);
      const [fuelSourceIds, lotterySourceIds, moneyServiceSourceIds] =
        await Promise.all([
          transaction.fuelTransaction.findMany({
            where: {
              businessId: args.input.businessId,
              storeId: store.id,
              status: "completed",
              completedAt: { gte: periodStartedAt, lt: periodEndedAt },
            },
            select: { id: true },
            take: 10_001,
          }),
          transaction.lotterySettlement.findMany({
            where: {
              businessId: args.input.businessId,
              storeId: store.id,
              tradingDate,
              status: { in: ["approved", "exported"] },
              periodStartedAt,
              periodEndedAt,
            },
            select: { id: true },
            take: 10_001,
          }),
          transaction.moneyServiceSettlement.findMany({
            where: {
              businessId: args.input.businessId,
              storeId: store.id,
              tradingDate,
              status: { in: ["approved", "exported"] },
              periodStartedAt,
              periodEndedAt,
            },
            select: { id: true },
            take: 10_001,
          }),
        ]);
      if (
        fuelSourceIds.length > 10_000 ||
        lotterySourceIds.length > 10_000 ||
        moneyServiceSourceIds.length > 10_000
      ) {
        throw new Error(
          "Store-day settlement sources exceed 10,000; use a shorter period",
        );
      }
      const generatedSourceSetDigest = sourceSetDigest({
        registerSessions: registerSessions.map((session) => session.id),
        sales: sales.map((sale) => sale.id),
        refunds: refunds.map((refund) => refund.id),
        tenders: tenders.map((tender) => tender.id),
        deposits: deposits.map((deposit) => deposit.id),
        fuelTransactions: fuelSourceIds.map((source) => source.id),
        lotterySettlements: lotterySourceIds.map((source) => source.id),
        moneyServiceSettlements: moneyServiceSourceIds.map(
          (source) => source.id,
        ),
      });

      const totals = calculateStoreDayTotals({
        sales,
        refunds: refunds.flatMap<{
          amountCents: number;
          taxCents: number;
          tenderMethod?: string;
        }>((refund) => {
          const taxCents = refund.lines.reduce(
            (sum, line) => sum + line.taxCents,
            0,
          );
          return refund.tenderAllocations.length
            ? refund.tenderAllocations.map((allocation, index) => ({
                amountCents: allocation.amountCents,
                taxCents: index === 0 ? taxCents : 0,
                tenderMethod: allocation.method,
              }))
            : [
                {
                  amountCents: refund.amountCents,
                  taxCents,
                  tenderMethod: refund.originalTender?.method,
                },
              ];
        }),
        tenders: tenders.map((tender) => ({ ...tender, refundedCents: 0 })),
        registerSessions,
        deposits,
      });
      const merchandiseGroups = new Map<
        string,
        {
          label: string;
          taxCategory: string;
          quantity: string;
          grossCents: number;
          discountCents: number;
          taxCents: number;
          netCents: number;
          cogsCents: number;
          sourceCount: number;
        }
      >();
      const merchandiseGroup = (
        sku: string,
        label: string,
        taxCategory: string,
      ) => {
        const key = sku || `title:${label}`;
        const existingGroup = merchandiseGroups.get(key) ?? {
          label,
          taxCategory,
          quantity: "0.0000",
          grossCents: 0,
          discountCents: 0,
          taxCents: 0,
          netCents: 0,
          cogsCents: 0,
          sourceCount: 0,
        };
        merchandiseGroups.set(key, existingGroup);
        return { key, group: existingGroup };
      };
      for (const sale of sales) {
        for (const line of sale.lines) {
          const { group } = merchandiseGroup(
            line.skuSnapshot,
            line.titleSnapshot,
            line.taxCategorySnapshot,
          );
          group.quantity = addQuantities(
            group.quantity,
            line.quantity.toString(),
          );
          group.grossCents += line.subtotalCents;
          group.discountCents += line.discountCents;
          group.taxCents += line.taxCents;
          group.netCents += line.totalCents;
          group.cogsCents += extendedInventoryCost(line.inventoryEntries);
          group.sourceCount += 1;
        }
      }
      for (const refund of refunds) {
        for (const line of refund.lines) {
          if (!line.saleLine) continue;
          const originalQuantity = quantityToScaledInteger(
            line.saleLine.quantity.toString(),
          );
          const refundQuantity = quantityToScaledInteger(
            line.quantity.toString(),
          );
          const originalCost = extendedInventoryCost(
            line.saleLine.inventoryEntries,
          );
          const refundedCost =
            originalQuantity > 0n
              ? Number(
                  (BigInt(originalCost) * refundQuantity +
                    originalQuantity / 2n) /
                    originalQuantity,
                )
              : 0;
          const refundedGross =
            originalQuantity > 0n
              ? Number(
                  (BigInt(line.saleLine.subtotalCents) * refundQuantity +
                    originalQuantity / 2n) /
                    originalQuantity,
                )
              : 0;
          const refundedDiscount =
            originalQuantity > 0n
              ? Number(
                  (BigInt(line.saleLine.discountCents) * refundQuantity +
                    originalQuantity / 2n) /
                    originalQuantity,
                )
              : 0;
          const { group } = merchandiseGroup(
            line.saleLine.skuSnapshot,
            line.saleLine.titleSnapshot,
            line.saleLine.taxCategorySnapshot,
          );
          group.quantity = addQuantities(
            group.quantity,
            `-${line.quantity.toString()}`,
          );
          group.grossCents -= refundedGross;
          group.discountCents -= refundedDiscount;
          group.taxCents -= line.taxCents;
          group.netCents -= line.totalCents;
          if (line.returnLine?.disposition === "restock")
            group.cogsCents -= refundedCost;
          group.sourceCount += 1;
        }
      }
      for (const [key, group] of merchandiseGroups) {
        for (const value of [
          group.grossCents,
          group.discountCents,
          group.taxCents,
          group.netCents,
          group.cogsCents,
        ]) {
          if (!Number.isSafeInteger(value))
            throw new Error(`Merchandise report overflow for ${key}`);
        }
      }

      const tenderNetCents = totals.cashTenderCents + totals.nonCashTenderCents;
      const tenderVarianceCents = tenderNetCents - totals.netReceiptsCents;
      const exceptionCount =
        registerSessions.filter(
          (session) => (session.overShortCents ?? 0) !== 0,
        ).length +
        (tenderVarianceCents === 0 ? 0 : 1) +
        ((lottery._sum.varianceCents ?? 0) === 0 ? 0 : 1) +
        ((moneyServices._sum.varianceCents ?? 0) === 0 ? 0 : 1);
      const generatedAt = new Date();

      const storeDay = existing
        ? await transaction.storeDay.update({
            where: { id: existing.id },
            data: {
              status: "in_review",
              timezoneSnapshot: store.timezone,
              currencyCode: store.currencyCode,
              periodStartedAt,
              periodEndedAt,
              generatedAt,
              approvedAt: null,
              approvedById: null,
              lockedAt: null,
              ...totals,
              fuelSalesCents: fuel._sum.totalCents ?? 0,
              lotteryNetCents: lottery._sum.reportedSettlementCents ?? 0,
              moneyServiceNetCents:
                moneyServices._sum.reportedSettlementCents ?? 0,
              saleCount: sales.length,
              refundCount: refunds.length,
              registerSessionCount: registerSessions.length,
              exceptionCount,
              notes: args.input.notes?.trim() || existing.notes,
              idempotencyId,
              metadata: {
                calculationVersion: 2,
                tenderVarianceCents,
                fuelTransactionCount: fuel._count.id,
                lotterySettlementCount: lottery._count.id,
                moneyServiceSettlementCount: moneyServices._count.id,
                sourceSetDigest: generatedSourceSetDigest,
              },
            },
          })
        : await transaction.storeDay.create({
            data: {
              businessId: args.input.businessId,
              storeId: store.id,
              tradingDate,
              lookupKey,
              status: "in_review",
              timezoneSnapshot: store.timezone,
              currencyCode: store.currencyCode,
              periodStartedAt,
              periodEndedAt,
              generatedAt,
              ...totals,
              fuelSalesCents: fuel._sum.totalCents ?? 0,
              lotteryNetCents: lottery._sum.reportedSettlementCents ?? 0,
              moneyServiceNetCents:
                moneyServices._sum.reportedSettlementCents ?? 0,
              saleCount: sales.length,
              refundCount: refunds.length,
              registerSessionCount: registerSessions.length,
              exceptionCount,
              notes: args.input.notes?.trim() || "",
              idempotencyId,
              metadata: {
                calculationVersion: 2,
                tenderVarianceCents,
                fuelTransactionCount: fuel._count.id,
                lotterySettlementCount: lottery._count.id,
                moneyServiceSettlementCount: moneyServices._count.id,
                sourceSetDigest: generatedSourceSetDigest,
              },
            },
          });

      if (existing) {
        await transaction.storeDayLine.deleteMany({
          where: { storeDayId: storeDay.id },
        });
      }

      let lineNumber = 1;
      for (const session of registerSessions) {
        if (!session.registerId)
          throw new Error("A closed register session is missing its register");
        await transaction.storeDayLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: store.id,
            storeDayId: storeDay.id,
            lineNumber: lineNumber++,
            dimension: "register",
            dimensionKey: session.registerId,
            label:
              session.register?.name ?? session.sessionNumber ?? session.id,
            expectedCents: session.expectedCashCents,
            actualCents: session.countedCashCents ?? 0,
            varianceCents: session.overShortCents ?? 0,
            sourceCount: 1,
          },
        });
      }

      const tenderGroups = new Map<
        string,
        { gross: number; refunds: number; count: number }
      >();
      for (const tender of tenders) {
        const group = tenderGroups.get(tender.method) ?? {
          gross: 0,
          refunds: 0,
          count: 0,
        };
        group.gross += tender.amountCents;
        group.count += 1;
        tenderGroups.set(tender.method, group);
      }
      for (const refund of refunds) {
        const allocations = refund.tenderAllocations.length
          ? refund.tenderAllocations.map((allocation) => ({
              method: allocation.method,
              amountCents: allocation.amountCents,
            }))
          : refund.originalTender
            ? [
                {
                  method: refund.originalTender.method,
                  amountCents: refund.amountCents,
                },
              ]
            : [];
        for (const allocation of allocations) {
          const group = tenderGroups.get(allocation.method) ?? {
            gross: 0,
            refunds: 0,
            count: 0,
          };
          group.refunds += allocation.amountCents;
          group.count += 1;
          tenderGroups.set(allocation.method, group);
        }
      }
      for (const [method, group] of [...tenderGroups.entries()].sort(
        ([left], [right]) => left.localeCompare(right),
      )) {
        await transaction.storeDayLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: store.id,
            storeDayId: storeDay.id,
            lineNumber: lineNumber++,
            dimension: "tender",
            dimensionKey: method,
            label: method.replaceAll("_", " "),
            grossCents: group.gross,
            netCents: group.gross - group.refunds,
            expectedCents: group.gross - group.refunds,
            actualCents: group.gross - group.refunds,
            varianceCents: 0,
            sourceCount: group.count,
            metadata: { refundedCents: group.refunds },
          },
        });
      }

      await transaction.storeDayLine.create({
        data: {
          businessId: args.input.businessId,
          storeId: store.id,
          storeDayId: storeDay.id,
          lineNumber: lineNumber++,
          dimension: "tax",
          dimensionKey: "all",
          label: "Collected tax",
          taxCents: totals.taxCents,
          netCents: totals.taxCents,
          expectedCents: totals.taxCents,
          actualCents: totals.taxCents,
          sourceCount: sales.length + refunds.length,
        },
      });
      for (const [key, group] of [...merchandiseGroups.entries()].sort(
        ([left], [right]) => left.localeCompare(right),
      )) {
        await transaction.storeDayLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: store.id,
            storeDayId: storeDay.id,
            lineNumber: lineNumber++,
            dimension: "merchandise",
            dimensionKey: key,
            label: group.label,
            grossCents: group.grossCents,
            discountCents: group.discountCents,
            taxCents: group.taxCents,
            netCents: group.netCents,
            expectedCents: group.netCents,
            actualCents: group.netCents,
            varianceCents: 0,
            quantity: group.quantity,
            sourceCount: group.sourceCount,
            metadata: {
              taxCategory: group.taxCategory,
              cogsCents: group.cogsCents,
            },
          },
        });
      }
      if ((fuel._count.id ?? 0) > 0) {
        await transaction.storeDayLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: store.id,
            storeDayId: storeDay.id,
            lineNumber: lineNumber++,
            dimension: "fuel",
            dimensionKey: "all",
            label: "Fuel transactions",
            grossCents: fuel._sum.totalCents ?? 0,
            netCents: fuel._sum.totalCents ?? 0,
            expectedCents: fuel._sum.totalCents ?? 0,
            actualCents: fuel._sum.totalCents ?? 0,
            sourceCount: fuel._count.id,
          },
        });
      }
      if ((lottery._count.id ?? 0) > 0) {
        await transaction.storeDayLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: store.id,
            storeDayId: storeDay.id,
            lineNumber: lineNumber++,
            dimension: "lottery",
            dimensionKey: "all",
            label: "Approved lottery settlements",
            netCents: lottery._sum.reportedSettlementCents ?? 0,
            expectedCents:
              (lottery._sum.reportedSettlementCents ?? 0) -
              (lottery._sum.varianceCents ?? 0),
            actualCents: lottery._sum.reportedSettlementCents ?? 0,
            varianceCents: lottery._sum.varianceCents ?? 0,
            sourceCount: lottery._count.id,
          },
        });
      }
      if ((moneyServices._count.id ?? 0) > 0) {
        await transaction.storeDayLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: store.id,
            storeDayId: storeDay.id,
            lineNumber: lineNumber++,
            dimension: "money_service",
            dimensionKey: "all",
            label: "Approved money-service settlements",
            netCents: moneyServices._sum.reportedSettlementCents ?? 0,
            expectedCents:
              (moneyServices._sum.reportedSettlementCents ?? 0) -
              (moneyServices._sum.varianceCents ?? 0),
            actualCents: moneyServices._sum.reportedSettlementCents ?? 0,
            varianceCents: moneyServices._sum.varianceCents ?? 0,
            sourceCount: moneyServices._count.id,
          },
        });
      }

      return {
        id: storeDay.id,
        status: storeDay.status,
        reference: tradingDate,
      };
    },
  });
}

export async function approveStoreDayReconciliation(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      storeDayId: string;
      employeeId: string;
      lock: boolean;
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageReporting",
    scope: "approveStoreDayReconciliation",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "StoreDay",
    action: "store_day.approve",
    execute: async (transaction) => {
      const storeDay = await transaction.storeDay.findFirst({
        where: {
          id: args.input.storeDayId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
      });
      if (!storeDay) throw new Error("Store day not found");
      const nextStatus = args.input.lock ? "locked" : "reconciled";
      const transition = evaluateTransition(
        STORE_DAY_TRANSITIONS,
        storeDay.status,
        nextStatus,
      );
      if (transition.replay) {
        return {
          id: storeDay.id,
          status: storeDay.status,
          reference: storeDay.tradingDate,
        };
      }
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!employee)
        throw new Error("Approving employee is not active at this store");
      const [
        registerSources,
        saleSources,
        refundSources,
        tenderSources,
        depositSources,
        fuelSources,
        lotterySources,
        moneyServiceSources,
      ] = await Promise.all([
        transaction.registerSession.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            openedAt: { lt: storeDay.periodEndedAt },
            OR: [
              { closedAt: null },
              { closedAt: { gt: storeDay.periodStartedAt } },
            ],
          },
          select: { id: true, businessId: true, storeId: true, expectedCashCents: true, status: true, openedAt: true, closedAt: true },
          take: 10_001,
        }),
        transaction.sale.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            completedAt: {
              gte: storeDay.periodStartedAt,
              lt: storeDay.periodEndedAt,
            },
            status: { in: ["completed", "partially_refunded", "refunded"] },
          },
          select: { id: true },
          take: 10_001,
        }),
        transaction.refund.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            status: "completed",
            processedAt: {
              gte: storeDay.periodStartedAt,
              lt: storeDay.periodEndedAt,
            },
          },
          select: { id: true },
          take: 10_001,
        }),
        transaction.tender.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            sale: {
              completedAt: {
                gte: storeDay.periodStartedAt,
                lt: storeDay.periodEndedAt,
              },
            },
            status: { in: ["captured", "partially_refunded", "refunded"] },
          },
          select: { id: true },
          take: 10_001,
        }),
        transaction.bankDeposit.findMany({
          where: {
            storeDayId: storeDay.id,
            status: { in: ["deposited", "verified"] },
          },
          select: { id: true },
          take: 10_001,
        }),
        transaction.fuelTransaction.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            status: "completed",
            completedAt: {
              gte: storeDay.periodStartedAt,
              lt: storeDay.periodEndedAt,
            },
          },
          select: { id: true },
          take: 10_001,
        }),
        transaction.lotterySettlement.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            tradingDate: storeDay.tradingDate,
            status: { in: ["approved", "exported"] },
            periodStartedAt: storeDay.periodStartedAt,
            periodEndedAt: storeDay.periodEndedAt,
          },
          select: { id: true },
          take: 10_001,
        }),
        transaction.moneyServiceSettlement.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            tradingDate: storeDay.tradingDate,
            status: { in: ["approved", "exported"] },
            periodStartedAt: storeDay.periodStartedAt,
            periodEndedAt: storeDay.periodEndedAt,
          },
          select: { id: true },
          take: 10_001,
        }),
      ]);
      const boundedSources = [
        registerSources,
        saleSources,
        refundSources,
        tenderSources,
        depositSources,
        fuelSources,
        lotterySources,
        moneyServiceSources,
      ];
      if (boundedSources.some((sources) => sources.length > 10_000))
        throw new Error(
          "Store-day source changed beyond the 10,000-record approval bound",
        );
      if (registerSources.some((register) => register.status !== "closed" || register.openedAt < storeDay.periodStartedAt || !register.closedAt || register.closedAt > storeDay.periodEndedAt)) {
        throw new Error("Store-day register state changed; close and regenerate before approval");
      }
      for (const session of registerSources) await assertCashLedger(transaction, session);
      const currentSourceSetDigest = sourceSetDigest({
        registerSessions: registerSources.map((source) => source.id),
        sales: saleSources.map((source) => source.id),
        refunds: refundSources.map((source) => source.id),
        tenders: tenderSources.map((source) => source.id),
        deposits: depositSources.map((source) => source.id),
        fuelTransactions: fuelSources.map((source) => source.id),
        lotterySettlements: lotterySources.map((source) => source.id),
        moneyServiceSettlements: moneyServiceSources.map((source) => source.id),
      });
      if (
        metadataSourceSetDigest(storeDay.metadata) !== currentSourceSetDigest
      ) {
        throw new Error(
          "Store-day source changed after generation; regenerate before approval",
        );
      }
      if (
        storeDay.exceptionCount > 0 &&
        !args.input.notes?.trim() &&
        !storeDay.notes?.trim()
      ) {
        throw new Error("Reconciliation exceptions require an approval note");
      }
      if (args.input.lock) {
        await assertStoreDayRegulatedSourcesSettled(transaction, {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          periodStartedAt: storeDay.periodStartedAt,
          periodEndedAt: storeDay.periodEndedAt,
          tradingDate: storeDay.tradingDate,
        });
      }
      const now = new Date();
      const updated = await transaction.storeDay.update({
        where: { id: storeDay.id },
        data: {
          status: nextStatus,
          approvedAt: now,
          approvedById: employee.id,
          lockedAt: args.input.lock ? now : null,
          notes: args.input.notes?.trim() || storeDay.notes,
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.tradingDate,
      };
    },
  });
}

export async function prepareBankDeposit(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      storeDayId: string;
      employeeId: string;
      amountCents: number;
      bagReference: string;
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  assertCents(args.input.amountCents, "Deposit amount");
  if (!args.input.bagReference.trim())
    throw new Error("Deposit bag reference is required");

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageCash",
    scope: "prepareBankDeposit",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "BankDeposit",
    action: "bank_deposit.prepare",
    execute: async (transaction, idempotencyId) => {
      const storeDay = await transaction.storeDay.findFirst({
        where: {
          id: args.input.storeDayId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: { in: ["in_review", "reconciled", "reopened"] },
        },
      });
      if (!storeDay) throw new Error("Unlocked store day not found");
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!employee)
        throw new Error("Preparing employee is not active at this store");
      const pendingDeposits = await transaction.bankDeposit.aggregate({
        where: {
          storeDayId: storeDay.id,
          status: { in: ["prepared", "in_transit"] },
        },
        _sum: { amountCents: true },
      });
      const physicallyAvailable = Math.max(
        0,
        storeDay.countedCashCents -
          storeDay.openingCashCents -
          storeDay.depositedCashCents,
      );
      const expectedAvailable = Math.max(
        0,
        physicallyAvailable - (pendingDeposits._sum.amountCents ?? 0),
      );
      if (args.input.amountCents > expectedAvailable) {
        throw new Error("Deposit amount exceeds unreserved counted cash");
      }
      const varianceCents = args.input.amountCents - expectedAvailable;
      const deposit = await transaction.bankDeposit.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          storeDayId: storeDay.id,
          depositNumber: `DEP-${randomUUID()}`,
          status: "prepared",
          currencyCode: storeDay.currencyCode,
          expectedAmountCents: expectedAvailable,
          amountCents: args.input.amountCents,
          varianceCents,
          bagReference: args.input.bagReference.trim(),
          preparedById: employee.id,
          preparedAt: new Date(),
          notes: args.input.notes?.trim() || "",
          idempotencyId,
        },
      });
      if (varianceCents !== 0) {
        await transaction.storeDay.update({
          where: { id: storeDay.id },
          data: { exceptionCount: storeDay.exceptionCount + 1 },
        });
      }
      return {
        id: deposit.id,
        status: deposit.status,
        reference: deposit.depositNumber,
      };
    },
  });
}

export async function transitionBankDeposit(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      depositId: string;
      employeeId: string;
      nextStatus: "in_transit" | "deposited" | "verified" | "voided";
      bankReference?: string | null;
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageCash",
    scope: "transitionBankDeposit",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "BankDeposit",
    action: "bank_deposit.transition",
    execute: async (transaction) => {
      const deposit = await transaction.bankDeposit.findFirst({
        where: {
          id: args.input.depositId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
        include: { storeDay: true },
      });
      if (!deposit?.storeDay)
        throw new Error("Deposit and store day not found");
      if (deposit.status === args.input.nextStatus) {
        return {
          id: deposit.id,
          status: deposit.status,
          reference: deposit.depositNumber,
        };
      }
      if (
        deposit.storeDay.status === "locked" &&
        !(
          deposit.status === "deposited" && args.input.nextStatus === "verified"
        )
      ) {
        throw new Error(
          "Only bank verification of an already deposited bag may occur after store-day lock",
        );
      }
      evaluateTransition(
        BANK_DEPOSIT_TRANSITIONS,
        deposit.status,
        args.input.nextStatus,
      );
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!employee)
        throw new Error("Deposit employee is not active at this store");
      if (
        args.input.nextStatus === "verified" &&
        !args.input.bankReference?.trim()
      ) {
        throw new Error("Bank reference is required to verify a deposit");
      }
      const now = new Date();
      const updated = await transaction.bankDeposit.update({
        where: { id: deposit.id },
        data: {
          status: args.input.nextStatus,
          bankReference:
            args.input.bankReference?.trim() || deposit.bankReference,
          depositedAt:
            args.input.nextStatus === "deposited" ? now : deposit.depositedAt,
          verifiedAt:
            args.input.nextStatus === "verified" ? now : deposit.verifiedAt,
          verifiedById:
            args.input.nextStatus === "verified"
              ? employee.id
              : deposit.verifiedById,
          notes: args.input.notes?.trim() || deposit.notes,
        },
      });
      if (args.input.nextStatus === "deposited") {
        await transaction.storeDay.update({
          where: { id: deposit.storeDay.id },
          data: {
            depositedCashCents:
              deposit.storeDay.depositedCashCents + deposit.amountCents,
            undepositedCashCents:
              deposit.storeDay.undepositedCashCents - deposit.amountCents,
          },
        });
      }
      if (args.input.nextStatus === "voided") {
        if (deposit.storeDay.status === "locked") {
          throw new Error("A deposit on a locked store day cannot be voided");
        }
        if (deposit.varianceCents !== 0) {
          await transaction.storeDay.update({
            where: { id: deposit.storeDay.id },
            data: {
              exceptionCount: Math.max(0, deposit.storeDay.exceptionCount - 1),
            },
          });
        }
      }
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.depositNumber,
      };
    },
  });
}

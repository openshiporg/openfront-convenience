import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import {
  assertPeriodWithinTradingDate,
  normalizeTradingDate,
} from "../lib/reconciliation";
import {
  assertLotterySourcePeriodOpen,
  assertSettlementDoesNotOverlapLockedDay,
  assertSettlementMatchesStoreDay,
} from "../lib/settlementPeriodPolicy";
import {
  metadataSourceSetDigest,
  sourceSetDigest,
} from "../lib/sourceSetDigest";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

function assertCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of cents`);
  }
}

function safeProduct(left: number, right: number, label: string): number {
  const product = left * right;
  if (!Number.isSafeInteger(product))
    throw new Error(`${label} exceeds safe integer range`);
  return product;
}

async function activeStoreEmployee(
  transaction: Prisma.TransactionClient,
  businessId: string,
  storeId: string,
  employeeId: string,
) {
  return transaction.employee.findFirst({
    where: {
      id: employeeId,
      businessId,
      status: "active",
      stores: { some: { id: storeId } },
    },
  });
}

export async function configureLotteryGame(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      name: string;
      gameCode: string;
      jurisdictionCode: string;
      operatorName: string;
      ticketPriceCents: number;
      ticketsPerPack: number;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const name = args.input.name.trim();
  const gameCode = args.input.gameCode.trim();
  const jurisdictionCode = args.input.jurisdictionCode.trim();
  const operatorName = args.input.operatorName.trim();
  if (!name || !gameCode || !jurisdictionCode || !operatorName) {
    throw new Error(
      "Lottery game name, code, jurisdiction label, and operator name are required",
    );
  }
  assertCents(args.input.ticketPriceCents, "Ticket price");
  if (args.input.ticketPriceCents === 0)
    throw new Error("Ticket price must be positive");
  if (
    !Number.isSafeInteger(args.input.ticketsPerPack) ||
    args.input.ticketsPerPack < 1
  ) {
    throw new Error("Tickets per pack must be a positive integer");
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageLottery",
    scope: "configureLotteryGame",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, name, gameCode, jurisdictionCode, operatorName },
    resourceType: "LotteryGame",
    action: "lottery.game.configure",
    execute: async (transaction, idempotencyId) => {
      const lookupKey = `${args.input.businessId}:${jurisdictionCode.toLowerCase()}:${gameCode.toLowerCase()}`;
      const existing = await transaction.lotteryGame.findUnique({
        where: { lookupKey },
      });
      if (
        existing &&
        (existing.operatorName !== operatorName ||
          existing.ticketPriceCents !== args.input.ticketPriceCents ||
          existing.ticketsPerPack !== args.input.ticketsPerPack) &&
        (await transaction.lotteryPack.count({
          where: { gameId: existing.id },
        })) > 0
      ) {
        throw new Error(
          "Lottery operator, ticket price, and pack size are immutable after pack custody begins; configure a new game code",
        );
      }
      const data = {
        name,
        gameCode,
        jurisdictionCode,
        operatorName,
        ticketPriceCents: args.input.ticketPriceCents,
        ticketsPerPack: args.input.ticketsPerPack,
        status: "active" as const,
        metadata: {
          idempotencyId,
          claimBoundary:
            "operator-supplied configuration; not jurisdiction approval",
        },
      };
      const game = existing
        ? await transaction.lotteryGame.update({
            where: { id: existing.id },
            data,
          })
        : await transaction.lotteryGame.create({
            data: { businessId: args.input.businessId, lookupKey, ...data },
          });
      return { id: game.id, status: game.status, reference: game.gameCode };
    },
  });
}

export async function receiveLotteryPack(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      gameId: string;
      employeeId: string;
      packNumber: string;
      firstTicketNumber: number;
      lastTicketNumber: number;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const packNumber = args.input.packNumber.trim();
  if (!packNumber) throw new Error("Lottery pack number is required");
  if (
    !Number.isSafeInteger(args.input.firstTicketNumber) ||
    !Number.isSafeInteger(args.input.lastTicketNumber) ||
    args.input.firstTicketNumber < 0 ||
    args.input.lastTicketNumber < args.input.firstTicketNumber
  ) {
    throw new Error("Lottery ticket range is invalid");
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageLottery",
    scope: "receiveLotteryPack",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, packNumber },
    resourceType: "LotteryPack",
    action: "lottery.pack.receive",
    execute: async (transaction, idempotencyId) => {
      const game = await transaction.lotteryGame.findFirst({
        where: {
          id: args.input.gameId,
          businessId: args.input.businessId,
          status: "active",
        },
      });
      const store = await transaction.store.findFirst({
        where: {
          id: args.input.storeId,
          businessId: args.input.businessId,
          status: "active",
        },
      });
      const employee = await activeStoreEmployee(
        transaction,
        args.input.businessId,
        args.input.storeId,
        args.input.employeeId,
      );
      if (!game || !store || !employee)
        throw new Error("Lottery game, store, or receiver is invalid");
      const ticketsReceived =
        args.input.lastTicketNumber - args.input.firstTicketNumber + 1;
      if (ticketsReceived !== game.ticketsPerPack) {
        throw new Error(
          `Ticket range must contain the configured ${game.ticketsPerPack} tickets`,
        );
      }
      const lookupKey = `${args.input.businessId}:${args.input.storeId}:${game.id}:${packNumber}`;
      if (await transaction.lotteryPack.findUnique({ where: { lookupKey } })) {
        throw new Error("Lottery pack is already recorded for this store");
      }
      const now = new Date();
      const pack = await transaction.lotteryPack.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          gameId: game.id,
          packNumber,
          lookupKey,
          status: "received",
          firstTicketNumber: args.input.firstTicketNumber,
          lastTicketNumber: args.input.lastTicketNumber,
          currentTicketNumber: args.input.firstTicketNumber,
          ticketsReceived,
          ticketsSold: 0,
          ticketsVoided: 0,
          expectedSalesCents: 0,
          actualSalesCents: 0,
          varianceCents: 0,
          receivedAt: now,
          receivedById: employee.id,
          idempotencyId,
        },
      });
      await transaction.lotteryPackEvent.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          packId: pack.id,
          eventNumber: `LEVT-${randomUUID()}`,
          type: "received",
          firstTicketNumber: args.input.firstTicketNumber,
          lastTicketNumber: args.input.lastTicketNumber,
          quantity: ticketsReceived,
          amountCents: safeProduct(
            ticketsReceived,
            game.ticketPriceCents,
            "Pack face value",
          ),
          employeeId: employee.id,
          reason: "Pack received",
          occurredAt: now,
          idempotencyId,
        },
      });
      return { id: pack.id, status: pack.status, reference: pack.packNumber };
    },
  });
}

export async function activateLotteryPack(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      packId: string;
      employeeId: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageLottery",
    scope: "activateLotteryPack",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "LotteryPack",
    action: "lottery.pack.activate",
    execute: async (transaction, idempotencyId) => {
      const pack = await transaction.lotteryPack.findFirst({
        where: {
          id: args.input.packId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
      });
      if (!pack) throw new Error("Lottery pack not found");
      if (pack.status === "activated" || pack.status === "in_sale") {
        return { id: pack.id, status: pack.status, reference: pack.packNumber };
      }
      if (pack.status !== "received")
        throw new Error(`Cannot activate a ${pack.status} lottery pack`);
      const employee = await activeStoreEmployee(
        transaction,
        args.input.businessId,
        args.input.storeId,
        args.input.employeeId,
      );
      if (!employee)
        throw new Error("Activating employee is not active at this store");
      const now = new Date();
      const updated = await transaction.lotteryPack.update({
        where: { id: pack.id },
        data: {
          status: "activated",
          activatedAt: now,
          activatedById: employee.id,
        },
      });
      await transaction.lotteryPackEvent.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          packId: pack.id,
          eventNumber: `LEVT-${randomUUID()}`,
          type: "activated",
          quantity: 0,
          amountCents: 0,
          employeeId: employee.id,
          reason: "Pack activated for sale",
          occurredAt: now,
          idempotencyId,
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.packNumber,
      };
    },
  });
}

export async function recordLotteryPackSale(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      packId: string;
      registerSessionId: string;
      employeeId: string;
      firstTicketNumber: number;
      lastTicketNumber: number;
      cashAmountCents: number;
      occurredAt?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  assertCents(args.input.cashAmountCents, "Lottery cash amount");
  const now = new Date();
  const occurredAt = args.input.occurredAt
    ? new Date(args.input.occurredAt)
    : now;
  if (!Number.isFinite(occurredAt.getTime()))
    throw new Error("Lottery sale time must be valid");
  if (occurredAt.getTime() > now.getTime() + 5 * 60_000) {
    throw new Error(
      "Lottery sale time cannot be more than five minutes in the future",
    );
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageLottery",
    scope: "recordLotteryPackSale",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, occurredAt },
    resourceType: "LotteryPackEvent",
    action: "lottery.pack.sale",
    execute: async (transaction, idempotencyId) => {
      const pack = await transaction.lotteryPack.findFirst({
        where: {
          id: args.input.packId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: { in: ["activated", "in_sale"] },
        },
        include: { game: true },
      });
      if (!pack?.game)
        throw new Error("Active lottery pack and game not found");
      await assertLotterySourcePeriodOpen(transaction, {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        operatorName: pack.game.operatorName,
        occurredAt,
      });
      if (
        !Number.isSafeInteger(args.input.firstTicketNumber) ||
        !Number.isSafeInteger(args.input.lastTicketNumber) ||
        args.input.firstTicketNumber !== pack.currentTicketNumber ||
        args.input.lastTicketNumber < args.input.firstTicketNumber ||
        args.input.lastTicketNumber > pack.lastTicketNumber
      ) {
        throw new Error(
          "Lottery sale range must be contiguous with the pack's next ticket",
        );
      }
      const registerSession = await transaction.registerSession.findFirst({
        where: {
          id: args.input.registerSessionId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "open",
        },
      });
      const employee = await activeStoreEmployee(
        transaction,
        args.input.businessId,
        args.input.storeId,
        args.input.employeeId,
      );
      if (!registerSession || !employee)
        throw new Error("Open register session or employee not found");
      const quantity =
        args.input.lastTicketNumber - args.input.firstTicketNumber + 1;
      const amountCents = safeProduct(
        quantity,
        pack.game.ticketPriceCents,
        "Lottery sale",
      );
      if (args.input.cashAmountCents !== amountCents) {
        throw new Error(
          "Lottery cash collection must exactly equal recorded ticket sales",
        );
      }
      const closesPack = args.input.lastTicketNumber === pack.lastTicketNumber;
      const nowStatus = closesPack ? "closed" : "in_sale";
      const expectedSalesCents = pack.expectedSalesCents + amountCents;
      const actualSalesCents = pack.actualSalesCents + amountCents;
      const updated = await transaction.lotteryPack.update({
        where: { id: pack.id },
        data: {
          status: nowStatus,
          currentTicketNumber: args.input.lastTicketNumber + 1,
          ticketsSold: pack.ticketsSold + quantity,
          expectedSalesCents,
          actualSalesCents,
          varianceCents: actualSalesCents - expectedSalesCents,
          closedAt: closesPack ? occurredAt : pack.closedAt,
          closedById: closesPack ? employee.id : pack.closedById,
        },
      });
      const event = await transaction.lotteryPackEvent.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          packId: pack.id,
          eventNumber: `LEVT-${randomUUID()}`,
          type: "sale_range",
          firstTicketNumber: args.input.firstTicketNumber,
          lastTicketNumber: args.input.lastTicketNumber,
          quantity,
          amountCents,
          registerSessionId: registerSession.id,
          employeeId: employee.id,
          reason: "Contiguous ticket range sold",
          occurredAt,
          idempotencyId,
          metadata: { cashAmountCents: args.input.cashAmountCents },
        },
      });
      if (args.input.cashAmountCents > 0) {
        await transaction.cashMovement.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            registerSessionId: registerSession.id,
            employeeId: employee.id,
            type: "lottery_sale",
            direction: "in",
            amountCents: args.input.cashAmountCents,
            reason: `Lottery pack ${pack.packNumber} tickets ${args.input.firstTicketNumber}-${args.input.lastTicketNumber}`,
            occurredAt,
            idempotencyId,
          },
        });
        await transaction.registerSession.update({
          where: { id: registerSession.id },
          data: {
            expectedCashCents:
              registerSession.expectedCashCents + args.input.cashAmountCents,
          },
        });
      }
      return {
        id: event.id,
        status: updated.status,
        reference: event.eventNumber,
      };
    },
  });
}

export async function closeLotteryPack(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      packId: string;
      employeeId: string;
      disposition: "returned" | "void_remaining";
      reason: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const reason = args.input.reason.trim();
  if (!reason) throw new Error("Lottery pack close requires a reason");
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageLottery",
    scope: "closeLotteryPack",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, reason },
    resourceType: "LotteryPack",
    action: "lottery.pack.close",
    execute: async (transaction, idempotencyId) => {
      const pack = await transaction.lotteryPack.findFirst({
        where: {
          id: args.input.packId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: { in: ["received", "activated", "in_sale"] },
        },
      });
      const employee = await activeStoreEmployee(
        transaction,
        args.input.businessId,
        args.input.storeId,
        args.input.employeeId,
      );
      if (!pack || !employee)
        throw new Error("Open lottery pack or employee not found");
      const remaining = Math.max(
        0,
        pack.lastTicketNumber - pack.currentTicketNumber + 1,
      );
      if (remaining === 0)
        throw new Error("Lottery pack has no remaining tickets to close");
      const returned = args.input.disposition === "returned";
      const now = new Date();
      const updated = await transaction.lotteryPack.update({
        where: { id: pack.id },
        data: {
          status: returned ? "returned" : "closed",
          currentTicketNumber: pack.lastTicketNumber + 1,
          ticketsVoided: returned
            ? pack.ticketsVoided
            : pack.ticketsVoided + remaining,
          closedAt: now,
          closedById: employee.id,
        },
      });
      const event = await transaction.lotteryPackEvent.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          packId: pack.id,
          eventNumber: `LEVT-${randomUUID()}`,
          type: returned ? "returned" : "void_range",
          firstTicketNumber: pack.currentTicketNumber,
          lastTicketNumber: pack.lastTicketNumber,
          quantity: remaining,
          amountCents: 0,
          employeeId: employee.id,
          reason,
          occurredAt: now,
          idempotencyId,
        },
      });
      return {
        id: event.id,
        status: updated.status,
        reference: pack.packNumber,
      };
    },
  });
}

export async function generateLotterySettlement(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      tradingDate: string;
      operatorName: string;
      periodStartedAt: string;
      periodEndedAt: string;
      onlineSalesCents: number;
      payoutCents: number;
      commissionCents: number;
      reportedSettlementCents: number;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const tradingDate = normalizeTradingDate(args.input.tradingDate);
  const operatorName = args.input.operatorName.trim();
  if (!operatorName) throw new Error("Lottery operator name is required");
  for (const [label, value] of Object.entries({
    onlineSalesCents: args.input.onlineSalesCents,
    payoutCents: args.input.payoutCents,
    commissionCents: args.input.commissionCents,
    reportedSettlementCents: args.input.reportedSettlementCents,
  }))
    assertCents(value, label);
  const periodStartedAt = new Date(args.input.periodStartedAt);
  const periodEndedAt = new Date(args.input.periodEndedAt);
  if (
    !Number.isFinite(periodStartedAt.getTime()) ||
    !Number.isFinite(periodEndedAt.getTime()) ||
    periodEndedAt <= periodStartedAt
  ) {
    throw new Error("Lottery settlement period is invalid");
  }
  if (
    periodEndedAt.getTime() - periodStartedAt.getTime() >
    26 * 60 * 60 * 1000
  ) {
    throw new Error("Lottery settlement period cannot exceed one trading date");
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageLottery",
    scope: "generateLotterySettlement",
    idempotencyKey: args.input.idempotencyKey,
    input: {
      ...args.input,
      tradingDate,
      operatorName,
      periodStartedAt,
      periodEndedAt,
    },
    resourceType: "LotterySettlement",
    action: "lottery.settlement.generate",
    execute: async (transaction, idempotencyId) => {
      const store = await transaction.store.findFirst({
        where: { id: args.input.storeId, businessId: args.input.businessId },
      });
      if (!store) throw new Error("Store not found");
      assertPeriodWithinTradingDate(
        tradingDate,
        periodStartedAt,
        periodEndedAt,
        store.timezone,
        "Lottery settlement",
      );
      const lookupKey = `${args.input.storeId}:${tradingDate}:${operatorName.toLowerCase()}`;
      const existing = await transaction.lotterySettlement.findUnique({
        where: { lookupKey },
      });
      if (existing?.status === "approved" || existing?.status === "exported") {
        throw new Error(
          "Approved/exported lottery settlement cannot be regenerated",
        );
      }
      const overlap = await transaction.lotterySettlement.findFirst({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          operatorName: { equals: operatorName, mode: "insensitive" },
          ...(existing ? { id: { not: existing.id } } : {}),
          status: { in: ["in_review", "approved", "disputed", "exported"] },
          periodStartedAt: { lt: periodEndedAt },
          periodEndedAt: { gt: periodStartedAt },
        },
        select: { id: true },
      });
      if (overlap)
        throw new Error(
          "Lottery settlement period overlaps an existing settlement",
        );
      const events = await transaction.lotteryPackEvent.findMany({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          type: "sale_range",
          occurredAt: { gte: periodStartedAt, lt: periodEndedAt },
          pack: { game: { operatorName } },
        },
        select: { id: true, amountCents: true, packId: true },
        take: 10_001,
      });
      if (events.length > 10_000)
        throw new Error(
          "Lottery settlement contains too many events; use a shorter period",
        );
      const instantSalesCents = events.reduce(
        (sum, event) => sum + event.amountCents,
        0,
      );
      if (!Number.isSafeInteger(instantSalesCents))
        throw new Error("Lottery sales exceed safe integer range");
      const expectedSettlementCents =
        instantSalesCents +
        args.input.onlineSalesCents -
        args.input.payoutCents -
        args.input.commissionCents;
      const varianceCents =
        args.input.reportedSettlementCents - expectedSettlementCents;
      const data = {
        operatorName,
        periodStartedAt,
        periodEndedAt,
        status: "in_review" as const,
        currencyCode: store.currencyCode,
        instantSalesCents,
        onlineSalesCents: args.input.onlineSalesCents,
        payoutCents: args.input.payoutCents,
        commissionCents: args.input.commissionCents,
        expectedSettlementCents,
        reportedSettlementCents: args.input.reportedSettlementCents,
        varianceCents,
        packCount: new Set(events.map((event) => event.packId)).size,
        generatedAt: new Date(),
        approvedAt: null,
        approvedById: null,
        idempotencyId,
        metadata: {
          periodStartedAt: periodStartedAt.toISOString(),
          periodEndedAt: periodEndedAt.toISOString(),
          claimBoundary: "operational reconciliation only",
          sourceSetDigest: sourceSetDigest({
            saleEvents: events.map((event) => event.id),
          }),
        },
      };
      const settlement = existing
        ? await transaction.lotterySettlement.update({
            where: { id: existing.id },
            data,
          })
        : await transaction.lotterySettlement.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              settlementNumber: `LSET-${randomUUID()}`,
              lookupKey,
              tradingDate,
              ...data,
            },
          });
      const closedPacks = await transaction.lotteryPack.findMany({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "closed",
          closedAt: { gte: periodStartedAt, lt: periodEndedAt },
          game: { operatorName },
        },
        select: { id: true },
        take: 10_001,
      });
      if (closedPacks.length > 10_000)
        throw new Error(
          "Lottery settlement contains too many packs; use a shorter period",
        );
      if (closedPacks.length) {
        await transaction.lotteryPack.updateMany({
          where: { id: { in: closedPacks.map((pack) => pack.id) } },
          data: { settlementId: settlement.id },
        });
        await transaction.lotterySettlement.update({
          where: { id: settlement.id },
          data: { packCount: closedPacks.length },
        });
      }
      return {
        id: settlement.id,
        status: settlement.status,
        reference: settlement.settlementNumber,
      };
    },
  });
}

export async function approveLotterySettlement(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      settlementId: string;
      employeeId: string;
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
    permission: "canManageLottery",
    scope: "approveLotterySettlement",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "LotterySettlement",
    action: "lottery.settlement.approve",
    execute: async (transaction, idempotencyId) => {
      const settlement = await transaction.lotterySettlement.findFirst({
        where: {
          id: args.input.settlementId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
      });
      if (!settlement) throw new Error("Lottery settlement not found");
      if (
        settlement.status === "approved" ||
        settlement.status === "exported"
      ) {
        return {
          id: settlement.id,
          status: settlement.status,
          reference: settlement.settlementNumber,
        };
      }
      if (
        settlement.status !== "in_review" &&
        settlement.status !== "disputed"
      ) {
        throw new Error(
          `Cannot approve lottery settlement in ${settlement.status} status`,
        );
      }
      const employee = await activeStoreEmployee(
        transaction,
        args.input.businessId,
        args.input.storeId,
        args.input.employeeId,
      );
      if (!employee)
        throw new Error("Approving employee is not active at this store");
      if (settlement.varianceCents !== 0 && !args.input.notes?.trim()) {
        throw new Error(
          "Lottery settlement variance requires an approval note",
        );
      }
      await assertSettlementDoesNotOverlapLockedDay(transaction, {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        periodStartedAt: settlement.periodStartedAt,
        periodEndedAt: settlement.periodEndedAt,
        label: "Lottery settlement approval",
      });
      await assertSettlementMatchesStoreDay(transaction, {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        tradingDate: settlement.tradingDate,
        periodStartedAt: settlement.periodStartedAt,
        periodEndedAt: settlement.periodEndedAt,
        label: "Lottery settlement approval",
      });
      const currentEvents = await transaction.lotteryPackEvent.findMany({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          type: "sale_range",
          occurredAt: {
            gte: settlement.periodStartedAt,
            lt: settlement.periodEndedAt,
          },
          pack: {
            game: {
              operatorName: {
                equals: settlement.operatorName,
                mode: "insensitive",
              },
            },
          },
        },
        select: { id: true, amountCents: true, packId: true },
        take: 10_001,
      });
      const periodPacks = await transaction.lotteryPack.findMany({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "closed",
          closedAt: {
            gte: settlement.periodStartedAt,
            lt: settlement.periodEndedAt,
          },
          game: {
            operatorName: {
              equals: settlement.operatorName,
              mode: "insensitive",
            },
          },
        },
        select: { id: true, packNumber: true, settlementId: true },
        take: 10_001,
      });
      if (currentEvents.length > 10_000 || periodPacks.length > 10_000)
        throw new Error(
          "Lottery settlement source changed beyond the 10,000-record bound",
        );
      const currentInstantSales = currentEvents.reduce(
        (sum, event) => sum + event.amountCents,
        0,
      );
      const currentExpected =
        currentInstantSales +
        settlement.onlineSalesCents -
        settlement.payoutCents -
        settlement.commissionCents;
      const expectedPackCount = periodPacks.length
        ? periodPacks.length
        : new Set(currentEvents.map((event) => event.packId)).size;
      if (
        !Number.isSafeInteger(currentInstantSales) ||
        currentInstantSales !== settlement.instantSalesCents ||
        metadataSourceSetDigest(settlement.metadata) !==
          sourceSetDigest({
            saleEvents: currentEvents.map((event) => event.id),
          }) ||
        currentExpected !== settlement.expectedSettlementCents ||
        settlement.reportedSettlementCents - currentExpected !==
          settlement.varianceCents ||
        expectedPackCount !== settlement.packCount ||
        periodPacks.some((pack) => pack.settlementId !== settlement.id)
      ) {
        throw new Error(
          "Lottery settlement source changed after generation; regenerate before approval",
        );
      }
      const approvedAt = new Date();
      for (const pack of periodPacks) {
        await transaction.lotteryPack.update({
          where: { id: pack.id },
          data: { status: "settled" },
        });
        await transaction.lotteryPackEvent.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            packId: pack.id,
            eventNumber: `LEVT-${randomUUID()}`,
            type: "settled",
            quantity: 0,
            amountCents: 0,
            employeeId: employee.id,
            reason: `Approved settlement ${settlement.settlementNumber}`,
            occurredAt: approvedAt,
            idempotencyId,
          },
        });
      }
      const updated = await transaction.lotterySettlement.update({
        where: { id: settlement.id },
        data: {
          status: "approved",
          approvedAt,
          approvedById: employee.id,
          notes: args.input.notes?.trim() || settlement.notes,
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.settlementNumber,
      };
    },
  });
}

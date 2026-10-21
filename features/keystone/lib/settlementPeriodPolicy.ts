import type { Prisma } from "@prisma/client";

export async function assertStoreDayPeriodOpen(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    storeId: string;
    occurredAt: Date;
    label: string;
  },
): Promise<void> {
  const locked = await transaction.storeDay.findFirst({
    where: {
      businessId: input.businessId,
      storeId: input.storeId,
      status: "locked",
      periodStartedAt: { lte: input.occurredAt },
      periodEndedAt: { gt: input.occurredAt },
    },
    select: { tradingDate: true },
  });
  if (locked)
    throw new Error(
      `${input.label} cannot be backdated into locked store day ${locked.tradingDate}`,
    );
}

export async function assertLotterySourcePeriodOpen(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    storeId: string;
    operatorName: string;
    occurredAt: Date;
  },
): Promise<void> {
  await assertStoreDayPeriodOpen(transaction, {
    ...input,
    label: "Lottery source evidence",
  });
  const approved = await transaction.lotterySettlement.findFirst({
    where: {
      businessId: input.businessId,
      storeId: input.storeId,
      operatorName: { equals: input.operatorName, mode: "insensitive" },
      status: { in: ["approved", "exported"] },
      periodStartedAt: { lte: input.occurredAt },
      periodEndedAt: { gt: input.occurredAt },
    },
    select: { settlementNumber: true },
  });
  if (approved)
    throw new Error(
      `Lottery source period is closed by settlement ${approved.settlementNumber}`,
    );
}

export async function assertMoneyServiceSourcePeriodOpen(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    storeId: string;
    providerId: string;
    occurredAt: Date;
  },
): Promise<void> {
  await assertStoreDayPeriodOpen(transaction, {
    ...input,
    label: "Money-service source evidence",
  });
  const approved = await transaction.moneyServiceSettlement.findFirst({
    where: {
      businessId: input.businessId,
      storeId: input.storeId,
      providerId: input.providerId,
      status: { in: ["approved", "exported"] },
      periodStartedAt: { lte: input.occurredAt },
      periodEndedAt: { gt: input.occurredAt },
    },
    select: { settlementNumber: true },
  });
  if (approved)
    throw new Error(
      `Money-service source period is closed by settlement ${approved.settlementNumber}`,
    );
}

export async function assertSettlementDoesNotOverlapLockedDay(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    storeId: string;
    periodStartedAt: Date;
    periodEndedAt: Date;
    label: string;
  },
): Promise<void> {
  const locked = await transaction.storeDay.findFirst({
    where: {
      businessId: input.businessId,
      storeId: input.storeId,
      status: "locked",
      periodStartedAt: { lt: input.periodEndedAt },
      periodEndedAt: { gt: input.periodStartedAt },
    },
    select: { tradingDate: true },
  });
  if (locked)
    throw new Error(
      `${input.label} cannot change locked store day ${locked.tradingDate}`,
    );
}

export async function assertSettlementMatchesStoreDay(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    storeId: string;
    tradingDate: string;
    periodStartedAt: Date;
    periodEndedAt: Date;
    label: string;
  },
): Promise<void> {
  const matchingDay = await transaction.storeDay.findFirst({
    where: {
      businessId: input.businessId,
      storeId: input.storeId,
      tradingDate: input.tradingDate,
      periodStartedAt: input.periodStartedAt,
      periodEndedAt: input.periodEndedAt,
      status: { in: ["draft", "in_review", "reconciled", "reopened"] },
    },
    select: { id: true },
  });
  if (!matchingDay) {
    throw new Error(
      `${input.label} requires a non-locked StoreDay with the exact trading date and period; generate or regenerate StoreDay evidence first`,
    );
  }
}

export async function assertStoreDayRegulatedSourcesSettled(
  transaction: Prisma.TransactionClient,
  input: {
    businessId: string;
    storeId: string;
    periodStartedAt: Date;
    periodEndedAt: Date;
    tradingDate: string;
  },
): Promise<void> {
  const [lotteryEvents, moneyTransactions, paymentTenders, fuelTransactions] =
    await Promise.all([
      transaction.lotteryPackEvent.findMany({
        where: {
          businessId: input.businessId,
          storeId: input.storeId,
          type: "sale_range",
          occurredAt: { gte: input.periodStartedAt, lt: input.periodEndedAt },
        },
        select: {
          pack: { select: { game: { select: { operatorName: true } } } },
        },
        take: 10_001,
      }),
      transaction.moneyServiceTransaction.findMany({
        where: {
          businessId: input.businessId,
          storeId: input.storeId,
          status: { in: ["confirmed", "reconciled"] },
          occurredAt: { gte: input.periodStartedAt, lt: input.periodEndedAt },
        },
        select: { providerId: true },
        take: 10_001,
      }),
      transaction.tender.findMany({
        where: {
          businessId: input.businessId,
          storeId: input.storeId,
          paymentProviderId: { not: null },
          status: { in: ["captured", "partially_refunded", "refunded"] },
          processedAt: { gte: input.periodStartedAt, lt: input.periodEndedAt },
        },
        select: { paymentProviderId: true },
        take: 10_001,
      }),
      transaction.fuelTransaction.findMany({
        where: {
          businessId: input.businessId,
          storeId: input.storeId,
          status: "completed",
          completedAt: { gte: input.periodStartedAt, lt: input.periodEndedAt },
        },
        select: {
          siteId: true,
          nozzle: { select: { tankId: true } },
        },
        take: 10_001,
      }),
    ]);
  if (
    lotteryEvents.length > 10_000 ||
    moneyTransactions.length > 10_000 ||
    paymentTenders.length > 10_000 ||
    fuelTransactions.length > 10_000
  ) {
    throw new Error(
      "Store-day regulated source evidence exceeds the 10,000-record closure bound",
    );
  }

  const operatorNames = new Set(
    lotteryEvents
      .map((event) => event.pack?.game?.operatorName)
      .filter((name): name is string => Boolean(name)),
  );
  for (const operatorName of operatorNames) {
    const covering = await transaction.lotterySettlement.findFirst({
      where: {
        businessId: input.businessId,
        storeId: input.storeId,
        operatorName: { equals: operatorName, mode: "insensitive" },
        tradingDate: input.tradingDate,
        status: { in: ["approved", "exported"] },
        periodStartedAt: input.periodStartedAt,
        periodEndedAt: input.periodEndedAt,
      },
      select: { id: true },
    });
    if (!covering)
      throw new Error(
        `Lottery source evidence for ${operatorName} requires an approved settlement matching the exact store-day period`,
      );
  }

  for (const providerId of new Set(
    paymentTenders
      .map((tender) => tender.paymentProviderId)
      .filter((id): id is string => Boolean(id)),
  )) {
    const covering = await transaction.paymentReconciliation.findFirst({
      where: {
        businessId: input.businessId,
        storeId: input.storeId,
        paymentProviderId: providerId,
        status: { in: ["approved", "exported"] },
        periodStartedAt: { lte: input.periodStartedAt },
        periodEndedAt: { gte: input.periodEndedAt },
      },
      select: { id: true },
    });
    if (!covering)
      throw new Error(
        "Provider tender evidence requires an approved payment reconciliation covering the store day",
      );
  }

  const fuelScopes = new Map<string, { siteId: string; tankId: string }>();
  for (const fuelTransaction of fuelTransactions) {
    if (!fuelTransaction.siteId || !fuelTransaction.nozzle?.tankId)
      throw new Error("Fuel source evidence is missing its site or tank");
    fuelScopes.set(
      `${fuelTransaction.siteId}:${fuelTransaction.nozzle.tankId}`,
      {
        siteId: fuelTransaction.siteId,
        tankId: fuelTransaction.nozzle.tankId,
      },
    );
  }
  for (const { siteId, tankId } of fuelScopes.values()) {
    const covering = await transaction.fuelReconciliation.findFirst({
      where: {
        businessId: input.businessId,
        storeId: input.storeId,
        siteId,
        tankId,
        status: "locked",
        periodStartedAt: { lte: input.periodStartedAt },
        periodEndedAt: { gte: input.periodEndedAt },
      },
      select: { id: true },
    });
    if (!covering)
      throw new Error(
        "Fuel dispense evidence requires a locked tank reconciliation covering the store day",
      );
  }

  for (const providerId of new Set(
    moneyTransactions
      .map((transaction) => transaction.providerId)
      .filter((id): id is string => Boolean(id)),
  )) {
    const covering = await transaction.moneyServiceSettlement.findFirst({
      where: {
        businessId: input.businessId,
        storeId: input.storeId,
        providerId,
        tradingDate: input.tradingDate,
        status: { in: ["approved", "exported"] },
        periodStartedAt: input.periodStartedAt,
        periodEndedAt: input.periodEndedAt,
      },
      select: { id: true },
    });
    if (!covering)
      throw new Error(
        "Money-service source evidence requires an approved provider settlement matching the exact store-day period",
      );
  }
}

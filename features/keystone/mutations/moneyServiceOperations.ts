import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import { assertStorePermission, type Session } from "../access";
import {
  assertPeriodWithinTradingDate,
  normalizeTradingDate,
} from "../lib/reconciliation";
import {
  assertMoneyServiceSourcePeriodOpen,
  assertSettlementDoesNotOverlapLockedDay,
  assertSettlementMatchesStoreDay,
} from "../lib/settlementPeriodPolicy";
import {
  assertNoInlineSecrets,
  assertOpaqueSecretReference,
} from "../lib/secretPolicy";
import {
  metadataSourceSetDigest,
  sourceSetDigest,
} from "../lib/sourceSetDigest";
import { requireSession, runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

const serviceTypes = [
  "money_order",
  "money_transfer",
  "bill_payment",
  "check_cashing",
  "stored_value",
  "atm_other",
] as const;

type MoneyServiceType = (typeof serviceTypes)[number];
type CashDirection = "in" | "out" | "none";

function assertCents(
  value: number,
  label: string,
  allowNegative = false,
): void {
  if (!Number.isSafeInteger(value) || (!allowNegative && value < 0)) {
    throw new Error(
      `${label} must be ${allowNegative ? "a" : "a non-negative"} safe integer number of cents`,
    );
  }
}

function timestamp(value: string, label: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()))
    throw new Error(`${label} must be a valid ISO timestamp`);
  return parsed;
}

async function storeEmployee(
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

export async function configureMoneyServiceProvider(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      name: string;
      code: string;
      serviceType: MoneyServiceType;
      adapterKey: string;
      externalAgentReference?: string | null;
      jurisdictionCode?: string | null;
      credentialReference?: string | null;
      configuration?: Prisma.InputJsonValue | null;
      storeIds: string[];
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const name = args.input.name.trim();
  const code = args.input.code.trim().toLowerCase();
  const adapterKey = args.input.adapterKey.trim();
  const storeIds = [...new Set(args.input.storeIds.filter(Boolean))].sort();
  if (!name || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(code) || !adapterKey) {
    throw new Error("Provider name, slug code, and adapter key are required");
  }
  if (!serviceTypes.includes(args.input.serviceType))
    throw new Error("Unsupported money-service type");
  if (!storeIds.length)
    throw new Error("At least one provider store is required");
  assertNoInlineSecrets(args.input.configuration ?? {});
  assertOpaqueSecretReference(args.input.credentialReference);
  const session = requireSession(context) as Session;
  for (const storeId of storeIds)
    assertStorePermission(
      session,
      args.input.businessId,
      storeId,
      "canManageMoneyServices",
    );

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageMoneyServices",
    scope: "configureMoneyServiceProvider",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, name, code, adapterKey, storeIds },
    resourceType: "MoneyServiceProvider",
    action: "money_service.provider.configure",
    execute: async (transaction, idempotencyId) => {
      const matchedStores = await transaction.store.count({
        where: {
          businessId: args.input.businessId,
          id: { in: storeIds },
          status: "active",
        },
      });
      if (matchedStores !== storeIds.length)
        throw new Error("One or more provider stores are invalid");
      const lookupKey = `${args.input.businessId}:${code}`;
      const existing = await transaction.moneyServiceProvider.findUnique({
        where: { lookupKey },
      });
      const data = {
        name,
        code,
        serviceType: args.input.serviceType,
        status: "active" as const,
        executionMode: "external_only" as const,
        adapterKey,
        externalAgentReference: args.input.externalAgentReference?.trim() || "",
        jurisdictionCode: args.input.jurisdictionCode?.trim() || "",
        credentialReference: args.input.credentialReference?.trim() || "",
        configuration: (args.input.configuration ??
          {}) as Prisma.InputJsonValue,
        metadata: {
          idempotencyId,
          claimBoundary: "externally executed transaction recording only",
        },
      };
      const provider = existing
        ? await transaction.moneyServiceProvider.update({
            where: { id: existing.id },
            data: { ...data, stores: { set: storeIds.map((id) => ({ id })) } },
          })
        : await transaction.moneyServiceProvider.create({
            data: {
              businessId: args.input.businessId,
              lookupKey,
              ...data,
              stores: { connect: storeIds.map((id) => ({ id })) },
            },
          });
      return {
        id: provider.id,
        status: provider.status,
        reference: provider.code,
      };
    },
  });
}

export async function recordExternalMoneyServiceTransaction(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      providerId: string;
      registerSessionId?: string | null;
      employeeId: string;
      serviceType: MoneyServiceType;
      externalTransactionReference: string;
      cashDirection: CashDirection;
      faceAmountCents: number;
      feeCents: number;
      cashAmountCents: number;
      providerSettlementCents: number;
      occurredAt: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const externalReference = args.input.externalTransactionReference.trim();
  if (!externalReference)
    throw new Error("Externally confirmed transaction reference is required");
  if (!serviceTypes.includes(args.input.serviceType))
    throw new Error("Unsupported money-service type");
  for (const [label, value] of [
    ["Face amount", args.input.faceAmountCents],
    ["Fee", args.input.feeCents],
    ["Cash amount", args.input.cashAmountCents],
  ] as const)
    assertCents(value, label);
  assertCents(args.input.providerSettlementCents, "Provider settlement", true);
  if (args.input.cashDirection === "none" && args.input.cashAmountCents !== 0) {
    throw new Error("A no-cash transaction must have zero cash amount");
  }
  if (args.input.cashDirection !== "none" && args.input.cashAmountCents === 0) {
    throw new Error(
      "A cash-direction transaction requires a positive cash amount",
    );
  }
  const occurredAt = timestamp(
    args.input.occurredAt,
    "Money-service transaction time",
  );
  if (occurredAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new Error(
      "Money-service transaction time cannot be more than five minutes in the future",
    );
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageMoneyServices",
    scope: "recordExternalMoneyServiceTransaction",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, externalReference, occurredAt },
    resourceType: "MoneyServiceTransaction",
    action: "money_service.transaction.record",
    execute: async (transaction, idempotencyId) => {
      const provider = await transaction.moneyServiceProvider.findFirst({
        where: {
          id: args.input.providerId,
          businessId: args.input.businessId,
          serviceType: args.input.serviceType,
          status: "active",
          executionMode: "external_only",
          stores: { some: { id: args.input.storeId } },
        },
      });
      const employee = await storeEmployee(
        transaction,
        args.input.businessId,
        args.input.storeId,
        args.input.employeeId,
      );
      if (!provider || !employee)
        throw new Error("Active provider or store employee not found");
      await assertMoneyServiceSourcePeriodOpen(transaction, {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        providerId: provider.id,
        occurredAt,
      });

      const registerSession =
        args.input.cashDirection === "none"
          ? null
          : await transaction.registerSession.findFirst({
              where: {
                id: args.input.registerSessionId ?? "",
                businessId: args.input.businessId,
                storeId: args.input.storeId,
                status: "open",
              },
            });
      if (args.input.cashDirection !== "none" && !registerSession) {
        throw new Error(
          "Cash money-service activity requires an open register session",
        );
      }
      const lookupKey = `${provider.id}:${externalReference}`;
      if (
        await transaction.moneyServiceTransaction.findUnique({
          where: { lookupKey },
        })
      ) {
        throw new Error(
          "External money-service transaction is already recorded",
        );
      }

      const item = await transaction.moneyServiceTransaction.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          providerId: provider.id,
          transactionNumber: `MSTX-${randomUUID()}`,
          externalTransactionReference: externalReference,
          lookupKey,
          serviceType: args.input.serviceType,
          status: "confirmed",
          cashDirection: args.input.cashDirection,
          faceAmountCents: args.input.faceAmountCents,
          feeCents: args.input.feeCents,
          cashAmountCents: args.input.cashAmountCents,
          providerSettlementCents: args.input.providerSettlementCents,
          currencyCode:
            (
              await transaction.store.findUnique({
                where: { id: args.input.storeId },
                select: { currencyCode: true },
              })
            )?.currencyCode ?? "USD",
          registerSessionId: registerSession?.id ?? null,
          employeeId: employee.id,
          occurredAt,
          idempotencyId,
          metadata: {
            executionBoundary: "confirmed by configured external provider",
          },
        },
      });
      if (registerSession && args.input.cashDirection !== "none") {
        const direction = args.input.cashDirection;
        const delta =
          direction === "in"
            ? args.input.cashAmountCents
            : -args.input.cashAmountCents;
        if (registerSession.expectedCashCents + delta < 0) {
          throw new Error(
            "Money-service transaction would make expected register cash negative",
          );
        }
        await transaction.cashMovement.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            registerSessionId: registerSession.id,
            employeeId: employee.id,
            type: direction === "in" ? "money_service_in" : "money_service_out",
            direction,
            amountCents: args.input.cashAmountCents,
            reason: `External ${args.input.serviceType.replaceAll("_", " ")} ${externalReference}`,
            occurredAt,
            idempotencyId,
          },
        });
        await transaction.registerSession.update({
          where: { id: registerSession.id },
          data: {
            expectedCashCents: registerSession.expectedCashCents + delta,
          },
        });
      }
      return {
        id: item.id,
        status: item.status,
        reference: item.transactionNumber,
      };
    },
  });
}

export async function voidExternalMoneyServiceTransaction(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      transactionId: string;
      employeeId: string;
      externalVoidReference: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const externalVoidReference = args.input.externalVoidReference.trim();
  if (!externalVoidReference)
    throw new Error("External void confirmation reference is required");
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageMoneyServices",
    scope: "voidExternalMoneyServiceTransaction",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, externalVoidReference },
    resourceType: "MoneyServiceTransaction",
    action: "money_service.transaction.void",
    execute: async (transaction, idempotencyId) => {
      const item = await transaction.moneyServiceTransaction.findFirst({
        where: {
          id: args.input.transactionId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
      });
      if (!item) throw new Error("Money-service transaction not found");
      if (item.status === "voided") {
        return {
          id: item.id,
          status: item.status,
          reference: item.transactionNumber,
        };
      }
      if (item.status !== "confirmed")
        throw new Error(
          `Cannot void a ${item.status} money-service transaction`,
        );
      if (!item.providerId)
        throw new Error("Money-service transaction is missing its provider");
      await assertMoneyServiceSourcePeriodOpen(transaction, {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        providerId: item.providerId,
        occurredAt: item.occurredAt,
      });
      const employee = await storeEmployee(
        transaction,
        args.input.businessId,
        args.input.storeId,
        args.input.employeeId,
      );
      if (!employee)
        throw new Error("Voiding employee is not active at this store");

      if (item.cashDirection !== "none") {
        const registerSession = await transaction.registerSession.findFirst({
          where: {
            id: item.registerSessionId ?? "",
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            status: "open",
          },
        });
        if (!registerSession)
          throw new Error(
            "Cash transaction can only be voided while its register session is open",
          );
        const reversalDirection = item.cashDirection === "in" ? "out" : "in";
        const delta =
          reversalDirection === "in"
            ? item.cashAmountCents
            : -item.cashAmountCents;
        if (registerSession.expectedCashCents + delta < 0) {
          throw new Error(
            "Money-service void would make expected register cash negative",
          );
        }
        await transaction.cashMovement.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            registerSessionId: registerSession.id,
            employeeId: employee.id,
            type:
              reversalDirection === "in"
                ? "money_service_in"
                : "money_service_out",
            direction: reversalDirection,
            amountCents: item.cashAmountCents,
            reason: `Void ${item.transactionNumber} · ${externalVoidReference}`,
            occurredAt: new Date(),
            idempotencyId,
          },
        });
        await transaction.registerSession.update({
          where: { id: registerSession.id },
          data: {
            expectedCashCents: registerSession.expectedCashCents + delta,
          },
        });
      }
      const updated = await transaction.moneyServiceTransaction.update({
        where: { id: item.id },
        data: {
          status: "voided",
          externalVoidReference,
          voidedAt: new Date(),
          metadata: {
            executionBoundary: "void confirmed by configured external provider",
          },
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.transactionNumber,
      };
    },
  });
}

export async function generateMoneyServiceSettlement(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      providerId: string;
      tradingDate: string;
      periodStartedAt: string;
      periodEndedAt: string;
      reportedSettlementCents: number;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const tradingDate = normalizeTradingDate(args.input.tradingDate);
  const periodStartedAt = timestamp(
    args.input.periodStartedAt,
    "Settlement period start",
  );
  const periodEndedAt = timestamp(
    args.input.periodEndedAt,
    "Settlement period end",
  );
  if (
    periodEndedAt <= periodStartedAt ||
    periodEndedAt.getTime() - periodStartedAt.getTime() > 26 * 60 * 60 * 1000
  ) {
    throw new Error(
      "Money-service settlement period must be positive and no longer than one trading date",
    );
  }
  assertCents(args.input.reportedSettlementCents, "Reported settlement", true);

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageMoneyServices",
    scope: "generateMoneyServiceSettlement",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, tradingDate, periodStartedAt, periodEndedAt },
    resourceType: "MoneyServiceSettlement",
    action: "money_service.settlement.generate",
    execute: async (transaction, idempotencyId) => {
      const provider = await transaction.moneyServiceProvider.findFirst({
        where: {
          id: args.input.providerId,
          businessId: args.input.businessId,
          stores: { some: { id: args.input.storeId } },
        },
      });
      const store = await transaction.store.findFirst({
        where: { id: args.input.storeId, businessId: args.input.businessId },
      });
      if (!provider || !store)
        throw new Error("Money-service provider or store not found");
      assertPeriodWithinTradingDate(
        tradingDate,
        periodStartedAt,
        periodEndedAt,
        store.timezone,
        "Money-service settlement",
      );
      const transactions = await transaction.moneyServiceTransaction.findMany({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          providerId: provider.id,
          status: { in: ["confirmed", "reconciled"] },
          occurredAt: { gte: periodStartedAt, lt: periodEndedAt },
        },
        take: 10_001,
      });
      if (transactions.length > 10_000)
        throw new Error(
          "Money-service settlement exceeds 10,000 transactions; use a shorter period",
        );
      const sum = (
        selector: (item: (typeof transactions)[number]) => number,
      ) => {
        const value = transactions.reduce(
          (total, item) => total + selector(item),
          0,
        );
        if (!Number.isSafeInteger(value))
          throw new Error(
            "Money-service settlement total exceeds safe integer range",
          );
        return value;
      };
      const faceAmountCents = sum((item) => item.faceAmountCents);
      const feeCents = sum((item) => item.feeCents);
      const cashInCents = sum((item) =>
        item.cashDirection === "in" ? item.cashAmountCents : 0,
      );
      const cashOutCents = sum((item) =>
        item.cashDirection === "out" ? item.cashAmountCents : 0,
      );
      const expectedSettlementCents = sum(
        (item) => item.providerSettlementCents,
      );
      const varianceCents =
        args.input.reportedSettlementCents - expectedSettlementCents;
      if (!Number.isSafeInteger(varianceCents))
        throw new Error("Settlement variance exceeds safe integer range");
      const lookupKey = `${args.input.storeId}:${provider.id}:${tradingDate}`;
      const existing = await transaction.moneyServiceSettlement.findUnique({
        where: { lookupKey },
      });
      if (existing && ["approved", "exported"].includes(existing.status)) {
        throw new Error(
          "Approved/exported money-service settlement cannot be regenerated",
        );
      }
      const overlap = await transaction.moneyServiceSettlement.findFirst({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          providerId: provider.id,
          ...(existing ? { id: { not: existing.id } } : {}),
          status: { in: ["in_review", "approved", "disputed", "exported"] },
          periodStartedAt: { lt: periodEndedAt },
          periodEndedAt: { gt: periodStartedAt },
        },
        select: { id: true },
      });
      if (overlap)
        throw new Error(
          "Money-service settlement period overlaps an existing settlement",
        );
      const data = {
        status: "in_review" as const,
        periodStartedAt,
        periodEndedAt,
        currencyCode: store.currencyCode,
        faceAmountCents,
        feeCents,
        cashInCents,
        cashOutCents,
        expectedSettlementCents,
        reportedSettlementCents: args.input.reportedSettlementCents,
        varianceCents,
        transactionCount: transactions.length,
        generatedAt: new Date(),
        approvedAt: null,
        approvedById: null,
        idempotencyId,
        metadata: {
          periodStartedAt: periodStartedAt.toISOString(),
          periodEndedAt: periodEndedAt.toISOString(),
          claimBoundary: "operational provider reconciliation only",
          sourceSetDigest: sourceSetDigest({
            transactions: transactions.map((transaction) => transaction.id),
          }),
        },
      };
      const settlement = existing
        ? await transaction.moneyServiceSettlement.update({
            where: { id: existing.id },
            data,
          })
        : await transaction.moneyServiceSettlement.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              providerId: provider.id,
              settlementNumber: `MSST-${randomUUID()}`,
              lookupKey,
              tradingDate,
              ...data,
            },
          });
      return {
        id: settlement.id,
        status: settlement.status,
        reference: settlement.settlementNumber,
      };
    },
  });
}

export async function approveMoneyServiceSettlement(
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
    permission: "canManageMoneyServices",
    scope: "approveMoneyServiceSettlement",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "MoneyServiceSettlement",
    action: "money_service.settlement.approve",
    execute: async (transaction) => {
      const settlement = await transaction.moneyServiceSettlement.findFirst({
        where: {
          id: args.input.settlementId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
      });
      if (!settlement) throw new Error("Money-service settlement not found");
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
        !(["in_review", "disputed"] as string[]).includes(settlement.status)
      ) {
        throw new Error(
          `Cannot approve money-service settlement in ${settlement.status} status`,
        );
      }
      const employee = await storeEmployee(
        transaction,
        args.input.businessId,
        args.input.storeId,
        args.input.employeeId,
      );
      if (!employee)
        throw new Error("Approving employee is not active at this store");
      if (settlement.varianceCents !== 0 && !args.input.notes?.trim()) {
        throw new Error(
          "Money-service settlement variance requires an approval note",
        );
      }
      await assertSettlementDoesNotOverlapLockedDay(transaction, {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        periodStartedAt: settlement.periodStartedAt,
        periodEndedAt: settlement.periodEndedAt,
        label: "Money-service settlement approval",
      });
      await assertSettlementMatchesStoreDay(transaction, {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        tradingDate: settlement.tradingDate,
        periodStartedAt: settlement.periodStartedAt,
        periodEndedAt: settlement.periodEndedAt,
        label: "Money-service settlement approval",
      });
      const currentSources = await transaction.moneyServiceTransaction.findMany(
        {
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            providerId: settlement.providerId ?? "",
            status: { in: ["confirmed", "reconciled"] },
            occurredAt: {
              gte: settlement.periodStartedAt,
              lt: settlement.periodEndedAt,
            },
          },
          select: {
            id: true,
            faceAmountCents: true,
            feeCents: true,
            cashDirection: true,
            cashAmountCents: true,
            providerSettlementCents: true,
          },
          take: 10_001,
        },
      );
      if (currentSources.length > 10_000)
        throw new Error(
          "Money-service settlement source changed beyond the 10,000-record bound",
        );
      const sourceSum = (
        selector: (source: (typeof currentSources)[number]) => number,
      ) =>
        currentSources.reduce((total, source) => total + selector(source), 0);
      const currentFace = sourceSum((source) => source.faceAmountCents);
      const currentFees = sourceSum((source) => source.feeCents);
      const currentCashIn = sourceSum((source) =>
        source.cashDirection === "in" ? source.cashAmountCents : 0,
      );
      const currentCashOut = sourceSum((source) =>
        source.cashDirection === "out" ? source.cashAmountCents : 0,
      );
      const currentExpected = sourceSum(
        (source) => source.providerSettlementCents,
      );
      if (
        ![
          currentFace,
          currentFees,
          currentCashIn,
          currentCashOut,
          currentExpected,
        ].every(Number.isSafeInteger) ||
        currentSources.length !== settlement.transactionCount ||
        currentFace !== settlement.faceAmountCents ||
        currentFees !== settlement.feeCents ||
        currentCashIn !== settlement.cashInCents ||
        currentCashOut !== settlement.cashOutCents ||
        currentExpected !== settlement.expectedSettlementCents ||
        settlement.reportedSettlementCents - currentExpected !==
          settlement.varianceCents ||
        metadataSourceSetDigest(settlement.metadata) !==
          sourceSetDigest({
            transactions: currentSources.map((source) => source.id),
          })
      ) {
        throw new Error(
          "Money-service settlement source changed after generation; regenerate before approval",
        );
      }
      await transaction.moneyServiceTransaction.updateMany({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          providerId: settlement.providerId ?? "",
          status: "confirmed",
          occurredAt: {
            gte: settlement.periodStartedAt,
            lt: settlement.periodEndedAt,
          },
        },
        data: { status: "reconciled" },
      });
      const updated = await transaction.moneyServiceSettlement.update({
        where: { id: settlement.id },
        data: {
          status: "approved",
          approvedAt: new Date(),
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

import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import { assertCents } from "../lib/money";
import {
  assertNoInlineSecrets,
  assertOpaqueSecretReference,
} from "../lib/secretPolicy";
import { assertSettlementDoesNotOverlapLockedDay } from "../lib/settlementPeriodPolicy";
import {
  metadataSourceSetDigest,
  sourceSetDigest,
} from "../lib/sourceSetDigest";
import { getPaymentProviderAdapter } from "../utils/paymentProviderAdapter";
import type { OperationResult } from "./cashOperations";
import { runIdempotentOperation } from "./operationRunner";

function dateTime(value: string, label: string): Date {
  const result = new Date(value);
  if (!value.trim() || !Number.isFinite(result.getTime()))
    throw new Error(`${label} must be an ISO timestamp`);
  return result;
}

function providerCode(value: string): string {
  const code = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(code))
    throw new Error("Provider code must be a lowercase slug");
  return code;
}

export async function configurePaymentProvider(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      name: string;
      code: string;
      adapterKey: string;
      credentialReference?: string | null;
      configuration?: unknown;
      activate?: boolean | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const name = args.input.name.trim();
  const code = providerCode(args.input.code);
  if (!name) throw new Error("Provider name is required");
  const adapter = getPaymentProviderAdapter(args.input.adapterKey);
  assertOpaqueSecretReference(args.input.credentialReference ?? null);
  assertNoInlineSecrets(args.input.configuration ?? {});

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageIntegrations",
    scope: "configurePaymentProvider",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, name, code, adapterKey: adapter.key },
    resourceType: "PaymentProvider",
    action: "payment_provider.configure",
    execute: async (transaction) => {
      const lookupKey = `${args.input.businessId}:payment:${code}`;
      const existing = await transaction.paymentProvider.findUnique({
        where: { lookupKey },
      });
      const data = {
        name,
        code,
        adapterKey: adapter.key,
        status: args.input.activate
          ? ("active" as const)
          : ("configured" as const),
        createPaymentFunction: "external_confirmation",
        capturePaymentFunction: "external_confirmation",
        refundPaymentFunction: "external_confirmation",
        getPaymentStatusFunction: "external_confirmation",
        handleWebhookFunction: adapter.supportsWebhooks
          ? "signed_webhook"
          : "manual",
        credentialReference: args.input.credentialReference?.trim() || "",
        configuration: (args.input.configuration ??
          {}) as Prisma.InputJsonValue,
      };
      const provider = existing
        ? await transaction.paymentProvider.update({
            where: { id: existing.id },
            data,
          })
        : await transaction.paymentProvider.create({
            data: { businessId: args.input.businessId, lookupKey, ...data },
          });
      return {
        id: provider.id,
        status: provider.status,
        reference: provider.code,
      };
    },
  });
}

export async function generatePaymentReconciliation(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      paymentProviderId: string;
      periodStartedAt: string;
      periodEndedAt: string;
      reportedFeeCents: number;
      reportedSettlementCents: number;
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  assertCents(args.input.reportedFeeCents, "Reported provider fee");
  assertCents(
    args.input.reportedSettlementCents,
    "Reported provider settlement",
    true,
  );
  const periodStartedAt = dateTime(args.input.periodStartedAt, "Period start");
  const periodEndedAt = dateTime(args.input.periodEndedAt, "Period end");
  if (periodEndedAt <= periodStartedAt)
    throw new Error("Payment reconciliation period must end after it starts");
  if (
    periodEndedAt.getTime() - periodStartedAt.getTime() >
    32 * 24 * 60 * 60 * 1000
  ) {
    throw new Error("Payment reconciliation period cannot exceed 32 days");
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePayments",
    scope: "generatePaymentReconciliation",
    idempotencyKey: args.input.idempotencyKey,
    input: {
      ...args.input,
      periodStartedAt: periodStartedAt.toISOString(),
      periodEndedAt: periodEndedAt.toISOString(),
    },
    resourceType: "PaymentReconciliation",
    action: "payment_reconciliation.generate",
    execute: async (transaction, idempotencyId) => {
      const [store, provider] = await Promise.all([
        transaction.store.findFirst({
          where: {
            id: args.input.storeId,
            businessId: args.input.businessId,
            status: "active",
          },
        }),
        transaction.paymentProvider.findFirst({
          where: {
            id: args.input.paymentProviderId,
            businessId: args.input.businessId,
          },
        }),
      ]);
      if (!store) throw new Error("Active store not found");
      if (!provider)
        throw new Error("Payment provider not found for this business");
      const [capturedTenders, refunds] = await Promise.all([
        transaction.tender.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            paymentProviderId: provider.id,
            status: { in: ["captured", "partially_refunded", "refunded"] },
            processedAt: { gte: periodStartedAt, lt: periodEndedAt },
          },
          orderBy: [{ processedAt: "asc" }, { id: "asc" }],
          take: 10_001,
        }),
        transaction.refund.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            status: "completed",
            processedAt: { gte: periodStartedAt, lt: periodEndedAt },
            OR: [
              {
                tenderAllocations: {
                  some: {
                    status: "completed",
                    tender: { paymentProviderId: provider.id },
                  },
                },
              },
              {
                tenderAllocations: { none: {} },
                originalTender: { paymentProviderId: provider.id },
              },
            ],
          },
          include: {
            originalTender: true,
            tenderAllocations: {
              where: {
                status: "completed",
                tender: { paymentProviderId: provider.id },
              },
              include: { tender: true },
            },
          },
          orderBy: [{ processedAt: "asc" }, { id: "asc" }],
          take: 10_001,
        }),
      ]);
      if (capturedTenders.length > 10_000 || refunds.length > 10_000) {
        throw new Error(
          "Payment reconciliation exceeds 10,000 payment records; use a shorter period",
        );
      }
      if (
        capturedTenders.some(
          (tender) => tender.currencyCode !== store.currencyCode,
        ) ||
        refunds.some((refund) => refund.currencyCode !== store.currencyCode)
      )
        throw new Error("Payment reconciliation contains a currency mismatch");
      const capturedCents = capturedTenders.reduce(
        (sum, tender) => sum + tender.amountCents,
        0,
      );
      const refundedCents = refunds.reduce(
        (sum, refund) =>
          sum +
          (refund.tenderAllocations.length
            ? refund.tenderAllocations.reduce(
                (allocationSum, allocation) =>
                  allocationSum + allocation.amountCents,
                0,
              )
            : refund.amountCents),
        0,
      );
      const expectedSettlementCents =
        capturedCents - refundedCents - args.input.reportedFeeCents;
      if (!Number.isSafeInteger(expectedSettlementCents))
        throw new Error("Payment settlement exceeds safe integer range");
      const tendersById = new Map(
        capturedTenders.map((tender) => [tender.id, tender]),
      );
      for (const refund of refunds) {
        if (!refund.tenderAllocations.length && refund.originalTender)
          tendersById.set(refund.originalTender.id, refund.originalTender);
        for (const allocation of refund.tenderAllocations) {
          if (!allocation.tender)
            throw new Error("Refund allocation is missing its original tender");
          tendersById.set(allocation.tender.id, allocation.tender);
        }
      }
      const tenders = Array.from(tendersById.values()).sort((left, right) =>
        left.id.localeCompare(right.id),
      );
      const varianceCents =
        args.input.reportedSettlementCents - expectedSettlementCents;
      const lookupKey = `${provider.id}:${store.id}:${periodStartedAt.toISOString()}:${periodEndedAt.toISOString()}`;
      const existing = await transaction.paymentReconciliation.findUnique({
        where: { lookupKey },
      });
      if (existing && !["in_review", "reopened"].includes(existing.status)) {
        throw new Error(
          "Approved payment reconciliation cannot be regenerated",
        );
      }
      const overlap = await transaction.paymentReconciliation.findFirst({
        where: {
          businessId: args.input.businessId,
          storeId: store.id,
          paymentProviderId: provider.id,
          ...(existing ? { id: { not: existing.id } } : {}),
          status: { in: ["in_review", "approved", "reopened"] },
          periodStartedAt: { lt: periodEndedAt },
          periodEndedAt: { gt: periodStartedAt },
        },
        select: { id: true },
      });
      if (overlap)
        throw new Error(
          "Payment reconciliation period overlaps an existing reconciliation",
        );
      const data = {
        businessId: args.input.businessId,
        storeId: store.id,
        paymentProviderId: provider.id,
        status: "in_review" as const,
        periodStartedAt,
        periodEndedAt,
        currencyCode: store.currencyCode,
        capturedCents,
        refundedCents,
        reportedFeeCents: args.input.reportedFeeCents,
        expectedSettlementCents,
        reportedSettlementCents: args.input.reportedSettlementCents,
        varianceCents,
        tenderCount: tenders.length,
        exceptionCount: varianceCents === 0 ? 0 : 1,
        notes: args.input.notes?.trim() || "",
        idempotencyId,
        metadata: {
          calculationVersion: 3,
          captureCount: capturedTenders.length,
          refundCount: refunds.length,
          sourceSetDigest: sourceSetDigest({
            tenders: capturedTenders.map((tender) => tender.id),
            refunds: refunds.map((refund) => refund.id),
            refundAllocations: refunds.flatMap((refund) =>
              refund.tenderAllocations.map((allocation) => allocation.id),
            ),
          }),
        },
      };
      const reconciliation = existing
        ? await transaction.paymentReconciliation.update({
            where: { id: existing.id },
            data,
          })
        : await transaction.paymentReconciliation.create({
            data: {
              ...data,
              lookupKey,
              reconciliationNumber: `PAYREC-${randomUUID()}`,
            },
          });
      if (existing) {
        await transaction.paymentReconciliationLine.deleteMany({
          where: { reconciliationId: reconciliation.id },
        });
      }
      const lineEvidence = tenders.map((tender) => {
        const capturedForPeriod = capturedTenders.some(
          (entry) => entry.id === tender.id,
        )
          ? tender.amountCents
          : 0;
        const refundedForPeriod = refunds.reduce((sum, refund) => {
          const allocated = refund.tenderAllocations
            .filter((allocation) => allocation.tenderId === tender.id)
            .reduce(
              (allocationSum, allocation) =>
                allocationSum + allocation.amountCents,
              0,
            );
          return (
            sum +
            (allocated ||
              (!refund.tenderAllocations.length &&
              refund.originalTenderId === tender.id
                ? refund.amountCents
                : 0))
          );
        }, 0);
        return {
          tender,
          capturedForPeriod,
          refundedForPeriod,
          activityCents: capturedForPeriod + refundedForPeriod,
        };
      });
      const activityCents = lineEvidence.reduce(
        (sum, line) => sum + line.activityCents,
        0,
      );
      if (args.input.reportedFeeCents > 0 && activityCents === 0)
        throw new Error(
          "Provider fee cannot be allocated without payment activity",
        );
      let remainingFeeCents = args.input.reportedFeeCents;
      for (const [index, line] of lineEvidence.entries()) {
        const allocatedFeeCents =
          index === lineEvidence.length - 1
            ? remainingFeeCents
            : activityCents === 0
              ? 0
              : Number(
                  (BigInt(args.input.reportedFeeCents) *
                    BigInt(line.activityCents)) /
                    BigInt(activityCents),
                );
        remainingFeeCents -= allocatedFeeCents;
        await transaction.paymentReconciliationLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: store.id,
            reconciliationId: reconciliation.id,
            tenderId: line.tender.id,
            lineKey: `${reconciliation.id}:${line.tender.id}`,
            capturedCents: line.capturedForPeriod,
            refundedCents: line.refundedForPeriod,
            reportedFeeCents: allocatedFeeCents,
            expectedSettlementCents:
              line.capturedForPeriod -
              line.refundedForPeriod -
              allocatedFeeCents,
          },
        });
      }
      return {
        id: reconciliation.id,
        status: reconciliation.status,
        reference: reconciliation.reconciliationNumber,
      };
    },
  });
}

export async function approvePaymentReconciliation(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      reconciliationId: string;
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
    permission: "canManagePayments",
    scope: "approvePaymentReconciliation",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "PaymentReconciliation",
    action: "payment_reconciliation.approve",
    execute: async (transaction) => {
      const reconciliation = await transaction.paymentReconciliation.findFirst({
        where: {
          id: args.input.reconciliationId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
      });
      if (!reconciliation) throw new Error("Payment reconciliation not found");
      if (reconciliation.status === "approved") {
        return {
          id: reconciliation.id,
          status: reconciliation.status,
          reference: reconciliation.reconciliationNumber,
        };
      }
      if (!["in_review", "reopened"].includes(reconciliation.status))
        throw new Error("Payment reconciliation is not approvable");
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
      if (
        reconciliation.varianceCents !== 0 &&
        !args.input.notes?.trim() &&
        !reconciliation.notes?.trim()
      ) {
        throw new Error(
          "Payment settlement variance requires a disposition note",
        );
      }
      await assertSettlementDoesNotOverlapLockedDay(transaction, {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        periodStartedAt: reconciliation.periodStartedAt,
        periodEndedAt: reconciliation.periodEndedAt,
        label: "Payment reconciliation approval",
      });
      if (!reconciliation.paymentProviderId)
        throw new Error("Payment reconciliation provider is missing");
      const store = await transaction.store.findFirst({
        where: {
          id: args.input.storeId,
          businessId: args.input.businessId,
        },
        select: { currencyCode: true },
      });
      if (!store) throw new Error("Payment reconciliation store is missing");
      const [capturedTenders, refunds] = await Promise.all([
        transaction.tender.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            paymentProviderId: reconciliation.paymentProviderId,
            status: { in: ["captured", "partially_refunded", "refunded"] },
            processedAt: {
              gte: reconciliation.periodStartedAt,
              lt: reconciliation.periodEndedAt,
            },
          },
          orderBy: [{ processedAt: "asc" }, { id: "asc" }],
          take: 10_001,
        }),
        transaction.refund.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            status: "completed",
            processedAt: {
              gte: reconciliation.periodStartedAt,
              lt: reconciliation.periodEndedAt,
            },
            OR: [
              {
                tenderAllocations: {
                  some: {
                    status: "completed",
                    tender: {
                      paymentProviderId: reconciliation.paymentProviderId,
                    },
                  },
                },
              },
              {
                tenderAllocations: { none: {} },
                originalTender: {
                  paymentProviderId: reconciliation.paymentProviderId,
                },
              },
            ],
          },
          include: {
            originalTender: true,
            tenderAllocations: {
              where: {
                status: "completed",
                tender: {
                  paymentProviderId: reconciliation.paymentProviderId,
                },
              },
              include: { tender: true },
            },
          },
          orderBy: [{ processedAt: "asc" }, { id: "asc" }],
          take: 10_001,
        }),
      ]);
      if (capturedTenders.length > 10_000 || refunds.length > 10_000)
        throw new Error(
          "Payment reconciliation source changed beyond the 10,000-record bound",
        );
      if (
        capturedTenders.some(
          (tender) => tender.currencyCode !== store.currencyCode,
        ) ||
        refunds.some((refund) => refund.currencyCode !== store.currencyCode)
      ) {
        throw new Error("Payment reconciliation source currency changed");
      }
      const currentCaptured = capturedTenders.reduce(
        (sum, tender) => sum + tender.amountCents,
        0,
      );
      const currentRefunded = refunds.reduce(
        (sum, refund) =>
          sum +
          (refund.tenderAllocations.length
            ? refund.tenderAllocations.reduce(
                (allocationSum, allocation) =>
                  allocationSum + allocation.amountCents,
                0,
              )
            : refund.amountCents),
        0,
      );
      const currentExpected =
        currentCaptured - currentRefunded - reconciliation.reportedFeeCents;
      const tenderIds = new Set(capturedTenders.map((tender) => tender.id));
      for (const refund of refunds) {
        if (!refund.tenderAllocations.length && refund.originalTenderId)
          tenderIds.add(refund.originalTenderId);
        for (const allocation of refund.tenderAllocations) {
          if (!allocation.tenderId)
            throw new Error("Refund allocation is missing its original tender");
          tenderIds.add(allocation.tenderId);
        }
      }
      if (
        !Number.isSafeInteger(currentCaptured) ||
        !Number.isSafeInteger(currentRefunded) ||
        !Number.isSafeInteger(currentExpected) ||
        currentCaptured !== reconciliation.capturedCents ||
        currentRefunded !== reconciliation.refundedCents ||
        currentExpected !== reconciliation.expectedSettlementCents ||
        reconciliation.reportedSettlementCents - currentExpected !==
          reconciliation.varianceCents ||
        tenderIds.size !== reconciliation.tenderCount ||
        metadataSourceSetDigest(reconciliation.metadata) !==
          sourceSetDigest({
            tenders: capturedTenders.map((tender) => tender.id),
            refunds: refunds.map((refund) => refund.id),
            refundAllocations: refunds.flatMap((refund) =>
              refund.tenderAllocations.map((allocation) => allocation.id),
            ),
          })
      ) {
        throw new Error(
          "Payment reconciliation source changed after generation; regenerate before approval",
        );
      }
      const updated = await transaction.paymentReconciliation.update({
        where: { id: reconciliation.id },
        data: {
          status: "approved",
          approvedById: employee.id,
          approvedAt: new Date(),
          notes: args.input.notes?.trim() || reconciliation.notes,
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.reconciliationNumber,
      };
    },
  });
}

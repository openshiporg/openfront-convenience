import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";

import { fingerprintInput } from "../lib/idempotency";
import {
  compareQuantities,
  quantityToScaledInteger,
  scaledIntegerToQuantity,
} from "../lib/quantity";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

type Candidate = {
  storeId: string | null;
  type:
    | "cash_variance"
    | "fuel_variance"
    | "low_inventory"
    | "expiring_lot"
    | "lottery_variance"
    | "money_service_variance"
    | "payment_variance"
    | "integration_failure"
    | "offline_conflict"
    | "other";
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  resourceType: string;
  resourceId: string;
  observedValue: string;
  thresholdValue: string;
};

function absolute(value: number): number {
  if (!Number.isSafeInteger(value))
    throw new Error("Alert amount exceeds safe integer range");
  return Math.abs(value);
}

async function boundedPages<T extends { id: string }>(
  label: string,
  load: (cursor: string | null) => Promise<T[]>,
): Promise<T[]> {
  const rows: T[] = [];
  let cursor: string | null = null;
  while (true) {
    const page = await load(cursor);
    rows.push(...page);
    if (rows.length > 10_000)
      throw new Error(`${label} exceeds the 10,000-record evaluation bound`);
    if (page.length < 500) return rows;
    cursor = page.at(-1)!.id;
  }
}

function candidateFingerprint(
  businessId: string,
  candidate: Candidate,
): string {
  return fingerprintInput({
    businessId,
    type: candidate.type,
    resourceType: candidate.resourceType,
    resourceId: candidate.resourceId,
    observedValue: candidate.observedValue,
    thresholdValue: candidate.thresholdValue,
  });
}

export async function evaluateOperationalAlerts(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId?: string | null;
      cashVarianceThresholdCents: number;
      fuelVarianceThresholdGallons: string;
      expiryWindowDays: number;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (
    !Number.isSafeInteger(args.input.cashVarianceThresholdCents) ||
    args.input.cashVarianceThresholdCents < 0
  ) {
    throw new Error(
      "Cash variance threshold must be a non-negative integer number of cents",
    );
  }
  const fuelThreshold = quantityToScaledInteger(
    args.input.fuelVarianceThresholdGallons,
  );
  if (fuelThreshold < 0n)
    throw new Error("Fuel variance threshold cannot be negative");
  if (
    !Number.isSafeInteger(args.input.expiryWindowDays) ||
    args.input.expiryWindowDays < 0 ||
    args.input.expiryWindowDays > 365
  ) {
    throw new Error("Expiry window must be an integer from 0 to 365 days");
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageAlerts",
    scope: "evaluateOperationalAlerts",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "AlertEvaluation",
    action: "alerts.evaluate",
    execute: async (transaction, idempotencyId) => {
      if (args.input.storeId) {
        const store = await transaction.store.findFirst({
          where: { id: args.input.storeId, businessId: args.input.businessId },
        });
        if (!store)
          throw new Error(
            "Alert-evaluation store does not belong to this business",
          );
      }
      const scope = {
        businessId: args.input.businessId,
        ...(args.input.storeId ? { storeId: args.input.storeId } : {}),
      };
      const expiryCutoff = new Date(
        Date.now() + args.input.expiryWindowDays * 86_400_000,
      );
      const page = (cursor: string | null) => ({
        orderBy: { id: "asc" as const },
        take: 500,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      const [
        storeDays,
        fuelReconciliations,
        stockLevels,
        lots,
        lotterySettlements,
        moneySettlements,
        paymentReconciliations,
        deadLetters,
      ] = await Promise.all([
        boundedPages("Store-day alert source", (cursor) =>
          transaction.storeDay.findMany({
            where: {
              ...scope,
              status: { in: ["in_review", "reconciled", "locked"] },
            },
            select: {
              id: true,
              storeId: true,
              tradingDate: true,
              cashOverShortCents: true,
            },
            ...page(cursor),
          }),
        ),
        boundedPages("Fuel-reconciliation alert source", (cursor) =>
          transaction.fuelReconciliation.findMany({
            where: {
              ...scope,
              status: { in: ["in_review", "approved", "locked"] },
            },
            select: {
              id: true,
              storeId: true,
              reconciliationNumber: true,
              varianceGallons: true,
              toleranceGallons: true,
            },
            ...page(cursor),
          }),
        ),
        boundedPages("Stock alert source", (cursor) =>
          transaction.stockLevel.findMany({
            where: { ...scope, reorderPoint: { gt: "0" } },
            include: { variant: { select: { title: true, sku: true } } },
            ...page(cursor),
          }),
        ),
        boundedPages("Inventory-lot alert source", (cursor) =>
          transaction.inventoryLot.findMany({
            where: {
              ...scope,
              status: "active",
              expiresAt: { lte: expiryCutoff },
            },
            include: { variant: { select: { title: true, sku: true } } },
            ...page(cursor),
          }),
        ),
        boundedPages("Lottery-settlement alert source", (cursor) =>
          transaction.lotterySettlement.findMany({
            where: { ...scope, status: "in_review", varianceCents: { not: 0 } },
            select: {
              id: true,
              storeId: true,
              settlementNumber: true,
              varianceCents: true,
            },
            ...page(cursor),
          }),
        ),
        boundedPages("Money-service alert source", (cursor) =>
          transaction.moneyServiceSettlement.findMany({
            where: { ...scope, status: "in_review", varianceCents: { not: 0 } },
            select: {
              id: true,
              storeId: true,
              settlementNumber: true,
              varianceCents: true,
            },
            ...page(cursor),
          }),
        ),
        boundedPages("Payment-reconciliation alert source", (cursor) =>
          transaction.paymentReconciliation.findMany({
            where: { ...scope, status: "in_review", varianceCents: { not: 0 } },
            select: {
              id: true,
              storeId: true,
              reconciliationNumber: true,
              varianceCents: true,
            },
            ...page(cursor),
          }),
        ),
        boundedPages("Outbox dead-letter alert source", (cursor) =>
          transaction.outboxEvent.findMany({
            where: {
              businessId: args.input.businessId,
              ...(args.input.storeId
                ? { OR: [{ storeId: args.input.storeId }, { storeId: null }] }
                : {}),
              status: "dead_letter",
            },
            select: {
              id: true,
              storeId: true,
              eventKey: true,
              lastError: true,
            },
            ...page(cursor),
          }),
        ),
      ]);

      const candidates: Candidate[] = [];
      for (const day of storeDays) {
        if (
          absolute(day.cashOverShortCents) <=
          args.input.cashVarianceThresholdCents
        )
          continue;
        candidates.push({
          storeId: day.storeId,
          type: "cash_variance",
          severity:
            absolute(day.cashOverShortCents) >=
            args.input.cashVarianceThresholdCents * 5
              ? "critical"
              : "warning",
          title: `Cash variance on ${day.tradingDate}`,
          message:
            "Store-day counted cash differs from expected cash and requires operator review.",
          resourceType: "StoreDay",
          resourceId: day.id,
          observedValue: String(day.cashOverShortCents),
          thresholdValue: String(args.input.cashVarianceThresholdCents),
        });
      }
      for (const reconciliation of fuelReconciliations) {
        const observed = quantityToScaledInteger(
          reconciliation.varianceGallons.toString(),
        );
        const magnitude = observed < 0n ? -observed : observed;
        const recordTolerance = quantityToScaledInteger(
          reconciliation.toleranceGallons.toString(),
        );
        const threshold =
          recordTolerance > fuelThreshold ? recordTolerance : fuelThreshold;
        if (magnitude <= threshold) continue;
        candidates.push({
          storeId: reconciliation.storeId,
          type: "fuel_variance",
          severity: magnitude >= threshold * 5n ? "critical" : "warning",
          title: `Fuel variance ${reconciliation.reconciliationNumber}`,
          message:
            "Measured closing fuel differs from opening plus deliveries minus dispenses beyond the configured tolerance.",
          resourceType: "FuelReconciliation",
          resourceId: reconciliation.id,
          observedValue: reconciliation.varianceGallons.toString(),
          thresholdValue: scaledIntegerToQuantity(threshold),
        });
      }
      for (const stock of stockLevels) {
        if (
          compareQuantities(
            stock.onHandQuantity.toString(),
            stock.reorderPoint.toString(),
          ) > 0
        )
          continue;
        candidates.push({
          storeId: stock.storeId,
          type: "low_inventory",
          severity:
            compareQuantities(stock.onHandQuantity.toString(), "0") <= 0
              ? "critical"
              : "warning",
          title: `Low inventory · ${stock.variant?.title ?? stock.variantId}`,
          message:
            "On-hand quantity is at or below the configured reorder point.",
          resourceType: "StockLevel",
          resourceId: stock.id,
          observedValue: stock.onHandQuantity.toString(),
          thresholdValue: stock.reorderPoint.toString(),
        });
      }
      for (const lot of lots) {
        candidates.push({
          storeId: lot.storeId,
          type: "expiring_lot",
          severity:
            lot.expiresAt && lot.expiresAt <= new Date()
              ? "critical"
              : "warning",
          title: `Expiring lot · ${lot.variant?.title ?? lot.lotNumber}`,
          message:
            "Active inventory lot reaches its recorded expiry inside the selected review window.",
          resourceType: "InventoryLot",
          resourceId: lot.id,
          observedValue: lot.expiresAt?.toISOString() ?? "",
          thresholdValue: expiryCutoff.toISOString(),
        });
      }
      for (const settlement of lotterySettlements) {
        candidates.push({
          storeId: settlement.storeId,
          type: "lottery_variance",
          severity: "warning",
          title: `Lottery variance · ${settlement.settlementNumber}`,
          message:
            "Recorded lottery settlement differs from the operational expected settlement.",
          resourceType: "LotterySettlement",
          resourceId: settlement.id,
          observedValue: String(settlement.varianceCents),
          thresholdValue: "0",
        });
      }
      for (const settlement of moneySettlements) {
        candidates.push({
          storeId: settlement.storeId,
          type: "money_service_variance",
          severity: "warning",
          title: `Money-service variance · ${settlement.settlementNumber}`,
          message:
            "Externally reported settlement differs from the recorded operational expectation.",
          resourceType: "MoneyServiceSettlement",
          resourceId: settlement.id,
          observedValue: String(settlement.varianceCents),
          thresholdValue: "0",
        });
      }
      for (const reconciliation of paymentReconciliations) {
        candidates.push({
          storeId: reconciliation.storeId,
          type: "payment_variance",
          severity: "warning",
          title: `Payment variance · ${reconciliation.reconciliationNumber}`,
          message:
            "Provider-reported settlement differs from captured tenders less refunds and reported fees.",
          resourceType: "PaymentReconciliation",
          resourceId: reconciliation.id,
          observedValue: String(reconciliation.varianceCents),
          thresholdValue: "0",
        });
      }
      for (const event of deadLetters) {
        candidates.push({
          storeId: event.storeId,
          type: "integration_failure",
          severity: "critical",
          title: `Outbox dead letter · ${event.eventKey}`,
          message:
            event.lastError ||
            "Durable event delivery exhausted its retry policy.",
          resourceType: "OutboxEvent",
          resourceId: event.id,
          observedValue: "dead_letter",
          thresholdValue: "delivered",
        });
      }

      if (candidates.length > 10_000) {
        throw new Error(
          "Operational alert candidates exceed the 10,000-record evaluation write bound",
        );
      }

      const evaluation = await transaction.alertEvaluation.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId ?? null,
          evaluationNumber: `ALEV-${randomUUID()}`,
          status: "completed",
          evaluatedAt: new Date(),
          createdCount: 0,
          existingCount: 0,
          idempotencyId,
          metadata: {
            cashVarianceThresholdCents: args.input.cashVarianceThresholdCents,
            fuelVarianceThresholdGallons:
              args.input.fuelVarianceThresholdGallons,
            expiryWindowDays: args.input.expiryWindowDays,
            candidateCount: candidates.length,
          },
        },
      });
      let createdCount = 0;
      let existingCount = 0;
      for (const candidate of candidates) {
        const fingerprint = candidateFingerprint(
          args.input.businessId,
          candidate,
        );
        const existing = await transaction.operationalAlert.findUnique({
          where: { fingerprint },
        });
        if (existing && ["open", "acknowledged"].includes(existing.status)) {
          existingCount += 1;
          continue;
        }
        if (existing) {
          await transaction.operationalAlert.update({
            where: { id: existing.id },
            data: {
              fingerprint: `${existing.fingerprint}:closed:${existing.id}`,
            },
          });
        }
        await transaction.operationalAlert.create({
          data: {
            businessId: args.input.businessId,
            storeId: candidate.storeId,
            alertNumber: `ALRT-${randomUUID()}`,
            fingerprint,
            type: candidate.type,
            severity: candidate.severity,
            status: "open",
            title: candidate.title,
            message: candidate.message,
            resourceType: candidate.resourceType,
            resourceId: candidate.resourceId,
            observedValue: candidate.observedValue,
            thresholdValue: candidate.thresholdValue,
            detectedAt: new Date(),
            evaluationId: evaluation.id,
          },
        });
        createdCount += 1;
      }
      await transaction.alertEvaluation.update({
        where: { id: evaluation.id },
        data: { createdCount, existingCount },
      });
      return {
        id: evaluation.id,
        status: evaluation.status,
        reference: `${createdCount} created / ${existingCount} existing`,
      };
    },
  });
}

export async function transitionOperationalAlert(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      alertId: string;
      employeeId: string;
      nextStatus: "acknowledged" | "resolved" | "dismissed";
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageAlerts",
    scope: "transitionOperationalAlert",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "OperationalAlert",
    action: "alert.transition",
    execute: async (transaction) => {
      const alert = await transaction.operationalAlert.findFirst({
        where: { id: args.input.alertId, businessId: args.input.businessId },
      });
      if (!alert) throw new Error("Operational alert not found");
      if (alert.status === args.input.nextStatus) {
        return {
          id: alert.id,
          status: alert.status,
          reference: alert.alertNumber,
        };
      }
      const allowed: Record<string, string[]> = {
        open: ["acknowledged", "resolved", "dismissed"],
        acknowledged: ["resolved", "dismissed"],
        resolved: [],
        dismissed: [],
      };
      if (!allowed[alert.status]?.includes(args.input.nextStatus)) {
        throw new Error(
          `Cannot transition alert from ${alert.status} to ${args.input.nextStatus}`,
        );
      }
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          ...(alert.storeId ? { stores: { some: { id: alert.storeId } } } : {}),
        },
      });
      if (!employee)
        throw new Error("Alert owner is not an active employee in scope");
      if (
        (args.input.nextStatus === "resolved" ||
          args.input.nextStatus === "dismissed") &&
        !args.input.notes?.trim()
      ) {
        throw new Error(
          "Resolved or dismissed alerts require a disposition note",
        );
      }
      const now = new Date();
      const updated = await transaction.operationalAlert.update({
        where: { id: alert.id },
        data: {
          status: args.input.nextStatus,
          fingerprint:
            args.input.nextStatus === "resolved" ||
            args.input.nextStatus === "dismissed"
              ? `${alert.fingerprint}:closed:${alert.id}`
              : alert.fingerprint,
          acknowledgedAt:
            args.input.nextStatus === "acknowledged"
              ? now
              : alert.acknowledgedAt,
          acknowledgedById:
            args.input.nextStatus === "acknowledged"
              ? employee.id
              : alert.acknowledgedById,
          resolvedAt:
            args.input.nextStatus === "resolved" ||
            args.input.nextStatus === "dismissed"
              ? now
              : alert.resolvedAt,
          resolvedById:
            args.input.nextStatus === "resolved" ||
            args.input.nextStatus === "dismissed"
              ? employee.id
              : alert.resolvedById,
          resolutionNotes: args.input.notes?.trim() || alert.resolutionNotes,
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.alertNumber,
      };
    },
  });
}

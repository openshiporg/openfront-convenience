import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";
import { Prisma } from "@prisma/client";

import type { Session } from "../access";
import { retailPaymentContext } from "../../integrations/payment/authority";
import { assertCashLedger, assertRetailRegister, retailRegisterInclude } from "../lib/retailCashBoundary";
import { getPaymentProviderAdapter } from "../utils/paymentProviderAdapter";
import { fingerprintInput } from "../lib/idempotency";
import { planLotConsumption } from "../lib/inventoryLotPolicy";
import {
  admitManagerPinAttempt,
  requireManagerPinAuthority,
} from "../lib/managerAuthority";
import { effectiveTenderRefundedCents } from "../lib/refundAccounting";
import { lockSaleRefundOrVoid } from "../lib/saleRefundVoidLock";
import {
  refundLineAccountingWhere,
  refundOriginalTenderWhere,
  refundTenderAllocationTotalsWhere,
} from "../lib/saleOwnershipScope";
import {
  addQuantities,
  compareQuantities,
  normalizeQuantity,
  quantityToScaledInteger,
  scaledIntegerToQuantity,
} from "../lib/quantity";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

type RefundTenderAllocationInput = {
  tenderId: string;
  amountCents: number;
  providerRefundId?: string | null;
  providerAuthority?: string | null;
};

type RefundLineInput = {
  saleLineId: string;
  quantity: string;
  disposition:
    | "restock"
    | "quarantine"
    | "destroy"
    | "return_to_vendor"
    | "no_inventory_action";
  condition?: "sealed" | "opened" | "damaged" | "expired" | "unknown" | null;
  note?: string | null;
};

function prorateCents(totalCents: number, part: string, whole: string): number {
  const partScaled = quantityToScaledInteger(part);
  const wholeScaled = quantityToScaledInteger(whole);
  if (partScaled <= 0n || wholeScaled <= 0n || partScaled > wholeScaled) {
    throw new Error(
      "Refund quantity must be positive and no greater than sold quantity",
    );
  }
  const numerator = BigInt(totalCents) * partScaled;
  return Number((numerator + wholeScaled / 2n) / wholeScaled);
}

function restoredExpirySlices(
  value: unknown,
  originalPoints: number,
  start: number,
  end: number,
): Array<{ points: number; expiresAt: Date | null }> {
  const raw = Array.isArray(value) ? value : [];
  const allocations = raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const points = (entry as { points?: unknown }).points;
    const expiry = (entry as { expiresAt?: unknown }).expiresAt;
    if (!Number.isSafeInteger(points) || Number(points) <= 0) return [];
    const expiresAt = typeof expiry === "string" ? new Date(expiry) : null;
    if (expiresAt && !Number.isFinite(expiresAt.getTime())) return [];
    return [{ points: Number(points), expiresAt }];
  });
  if (
    allocations.reduce((sum, allocation) => sum + allocation.points, 0) !==
    originalPoints
  ) {
    return [{ points: Math.max(0, end - start), expiresAt: null }];
  }
  const slices: Array<{ points: number; expiresAt: Date | null }> = [];
  let cursor = 0;
  for (const allocation of allocations) {
    const allocationStart = cursor;
    const allocationEnd = cursor + allocation.points;
    const overlap = Math.max(
      0,
      Math.min(end, allocationEnd) - Math.max(start, allocationStart),
    );
    if (overlap > 0)
      slices.push({ points: overlap, expiresAt: allocation.expiresAt });
    cursor = allocationEnd;
  }
  return slices;
}

export async function refundPosSale(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      saleId: string;
      originalTenderId?: string | null;
      tenderAllocations?: RefundTenderAllocationInput[] | null;
      registerSessionId: string;
      employeeId: string;
      reason:
        | "customer_return"
        | "price_correction"
        | "duplicate_charge"
        | "service_recovery"
        | "fraud"
        | "other";
      returnReason?:
        | "unwanted"
        | "defective"
        | "expired"
        | "wrong_item"
        | "recall"
        | "other"
        | null;
      providerRefundId?: string | null;
      providerAuthority?: string | null;
      notes?: string | null;
      overrideNonReturnable?: boolean | null;
      overrideReason?: string | null;
      managerPin?: string | null;
      lines: RefundLineInput[];
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (!args.input.lines.length || args.input.lines.length > 250)
    throw new Error("Refund requires 1-250 line allocations");
  const normalizedLines = args.input.lines.map((line) => ({
    ...line,
    quantity: normalizeQuantity(line.quantity),
  }));
  for (const line of normalizedLines) {
    if (compareQuantities(line.quantity, "0") <= 0) {
      throw new Error("Refund quantities must be greater than zero");
    }
  }
  const requestedAllocations =
    args.input.tenderAllocations?.map((allocation) => ({
      ...allocation,
      tenderId: allocation.tenderId.trim(),
      providerRefundId: allocation.providerRefundId?.trim() || "",
      providerAuthority: allocation.providerAuthority?.trim() || "",
    })) ?? [];
  if (requestedAllocations.length && args.input.originalTenderId) {
    throw new Error(
      "Use either explicit tender allocations or the legacy original tender, not both",
    );
  }
  if (!requestedAllocations.length && !args.input.originalTenderId) {
    throw new Error("At least one original tender allocation is required");
  }
  if (
    new Set(requestedAllocations.map((allocation) => allocation.tenderId))
      .size !== requestedAllocations.length
  ) {
    throw new Error("A tender may appear only once in a refund allocation");
  }
  for (const allocation of requestedAllocations) {
    if (
      !allocation.tenderId ||
      !Number.isSafeInteger(allocation.amountCents) ||
      allocation.amountCents <= 0
    ) {
      throw new Error(
        "Refund tender allocations require a tender and a positive integer cent amount",
      );
    }
  }
  if (args.input.overrideNonReturnable) {
    await admitManagerPinAttempt(
      context.prisma,
      context.session as Session | undefined,
      args.input,
      "a non-returnable product override",
      "canManagePayments",
    );
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePayments",
    scope: "refundPosSale",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, lines: normalizedLines },
    resourceType: "Refund",
    action: "sale.refund",
    execute: async (transaction, idempotencyId) => {
      await lockSaleRefundOrVoid(transaction, args.input);
      const sale = await transaction.sale.findFirst({
        where: {
          id: args.input.saleId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: { in: ["completed", "partially_refunded"] },
        },
        include: {
          store: true,
          lines: {
            where: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
            },
            include: {
              product: { select: { returnable: true } },
              inventoryEntries: true,
              returnLines: {
                include: { restockLedgerEntries: true },
              },
            },
          },
          loyaltyAccount: true,
          loyaltyEntries: { where: { type: "earned" } },
        },
      });
      if (!sale || !sale.store) throw new Error("Refundable sale not found");
      const ownershipScope = {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        saleId: sale.id,
      };
      if (
        (await transaction.fuelTransaction.count({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            saleId: sale.id,
            status: "completed",
          },
        })) > 0
      ) {
        throw new Error(
          "A completed fuel dispense cannot be refunded through the merchandise sale workflow",
        );
      }
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

      const registerSession = await transaction.registerSession.findFirst({
        where: {
          id: args.input.registerSessionId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "open",
        },
        include: retailRegisterInclude,
      });
      assertRetailRegister(registerSession, args.input.businessId, args.input.storeId, sale.currencyCode);
      if (!registerSession)
        throw new Error("Open register session not found for refund");

      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!employee)
        throw new Error(
          "Active refunding employee is not assigned to this store",
        );
      if (args.input.overrideNonReturnable) {
        await requireManagerPinAuthority(
          transaction,
          args.input,
          "a non-returnable product override",
        );
      }

      const requestedByLine = new Map(
        normalizedLines.map((line) => [line.saleLineId, line]),
      );
      if (requestedByLine.size !== normalizedLines.length) {
        throw new Error("A sale line may appear only once per refund");
      }

      const calculatedLines: Array<{
        input: (typeof normalizedLines)[number];
        saleLine: (typeof sale.lines)[number];
        subtotalCents: number;
        taxCents: number;
        totalCents: number;
      }> = [];

      for (const lineInput of normalizedLines) {
        const saleLine = sale.lines.find(
          (line) => line.id === lineInput.saleLineId,
        );
        if (!saleLine)
          throw new Error("Refund line does not belong to this sale");
        const productSnapshot =
          saleLine.productSnapshot &&
          typeof saleLine.productSnapshot === "object" &&
          !Array.isArray(saleLine.productSnapshot)
            ? (saleLine.productSnapshot as Record<string, unknown>)
            : {};
        const returnable =
          saleLine.product?.returnable ?? productSnapshot.returnable !== false;
        if (
          !returnable &&
          (!args.input.overrideNonReturnable ||
            !args.input.overrideReason?.trim())
        ) {
          throw new Error(
            "Non-returnable products require an explicit manager override reason",
          );
        }

        const alreadyRefunded = await transaction.refundLine.aggregate({
          where: refundLineAccountingWhere(ownershipScope, saleLine.id),
          _sum: {
            quantity: true,
            subtotalCents: true,
            taxCents: true,
            totalCents: true,
          },
        });
        const priorQuantity =
          alreadyRefunded._sum.quantity?.toString() ?? "0.0000";
        const remaining = addQuantities(
          saleLine.quantity.toString(),
          `-${priorQuantity}`,
        );
        if (compareQuantities(lineInput.quantity, remaining) > 0) {
          throw new Error(
            `Refund quantity exceeds remaining quantity for line ${saleLine.lineNumber}`,
          );
        }

        const cumulativeQuantity = addQuantities(
          priorQuantity,
          lineInput.quantity,
        );
        const targetTotalCents = prorateCents(
          saleLine.totalCents,
          cumulativeQuantity,
          saleLine.quantity.toString(),
        );
        const targetTaxCents = prorateCents(
          saleLine.taxCents,
          cumulativeQuantity,
          saleLine.quantity.toString(),
        );
        const totalCents =
          targetTotalCents - (alreadyRefunded._sum.totalCents ?? 0);
        const taxCents = targetTaxCents - (alreadyRefunded._sum.taxCents ?? 0);
        const subtotalCents = totalCents - taxCents;
        if (totalCents < 0 || taxCents < 0 || subtotalCents < 0) {
          throw new Error(
            "Cumulative refund allocation cannot reduce previously posted line amounts",
          );
        }
        calculatedLines.push({
          input: lineInput,
          saleLine,
          subtotalCents,
          taxCents,
          totalCents,
        });
      }

      const amountCents = calculatedLines.reduce(
        (sum, line) => sum + line.totalCents,
        0,
      );
      if (!Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > sale.totalCents - sale.refundedCents)
        throw new Error("Calculated refund must be positive and within the remaining sale total");
      const allocationInputs = requestedAllocations.length
        ? requestedAllocations
        : [
            {
              tenderId: args.input.originalTenderId!,
              amountCents,
              providerRefundId: args.input.providerRefundId?.trim() || "",
              providerAuthority: args.input.providerAuthority?.trim() || "",
            },
          ];
      const allocationTotal = allocationInputs.reduce(
        (sum, allocation) => sum + allocation.amountCents,
        0,
      );
      if (
        !Number.isSafeInteger(allocationTotal) ||
        allocationTotal !== amountCents
      ) {
        throw new Error(
          "Refund tender allocations must exactly equal the calculated line refund total",
        );
      }
      const tenders = await transaction.tender.findMany({
        where: refundOriginalTenderWhere(
          ownershipScope,
          allocationInputs.map((allocation) => allocation.tenderId),
        ),
        include: { paymentProvider: true },
      });
      if (tenders.length !== allocationInputs.length)
        throw new Error(
          "One or more refundable original tenders were not found",
        );
      const refundedByTender = new Map<string, number>();
      for (const tender of tenders) {
        const completedAllocations =
          await transaction.refundTenderAllocation.aggregate({
            where: refundTenderAllocationTotalsWhere(
              ownershipScope,
              tender.id,
            ),
            _sum: { amountCents: true },
          });
        refundedByTender.set(
          tender.id,
          effectiveTenderRefundedCents(
            tender.amountCents,
            tender.refundedCents,
            completedAllocations._sum.amountCents ?? 0,
          ),
        );
      }
      const plannedAllocations = allocationInputs.map((allocation) => {
        const tender = tenders.find(
          (candidate) => candidate.id === allocation.tenderId,
        )!;
        if (tender.currencyCode !== sale.currencyCode) throw new Error("Original tender currency does not match sale");
        const refundedBeforeCents = refundedByTender.get(tender.id)!;
        if (
          allocation.amountCents >
          tender.amountCents - refundedBeforeCents
        ) {
          throw new Error(
            "Refund exceeds the remaining amount on an allocated tender",
          );
        }
        if (tender.method === "cash" || tender.method === "loyalty") {
          if (allocation.providerRefundId || allocation.providerAuthority) {
            throw new Error(
              `${tender.method} refunds cannot carry payment-provider authority`,
            );
          }
          if (tender.method === "loyalty" && !loyaltyAccount) {
            throw new Error("Loyalty tender has no sale loyalty account");
          }
          return {
            tender,
            allocation,
            refundedBeforeCents,
            providerLookupKey: null,
            confirmationContext: null,
          };
        }
        if (
          !tender.paymentProvider ||
          tender.paymentProvider.businessId !== args.input.businessId ||
          tender.paymentProvider.status !== "active" ||
          !allocation.providerRefundId ||
          !allocation.providerAuthority
        ) {
          throw new Error(
            "Every non-cash allocation requires a provider refund reference and signed authority",
          );
        }
        const confirmationContext = retailPaymentContext({
          ...args.input, scope: "refundPosSale", command: { ...args.input, lines: normalizedLines },
          provider: tender.paymentProvider, subjectId: sale.id, subjectRevision: sale.updatedAt.toISOString(),
          originalTenderId: tender.id, originalProviderPaymentId: tender.providerPaymentId,
          originalTenderEvidenceDigest: fingerprintInput({
            id: tender.id, businessId: tender.businessId, storeId: tender.storeId,
            paymentProviderId: tender.paymentProviderId, providerPaymentId: tender.providerPaymentId,
            amountCents: tender.amountCents, currencyCode: tender.currencyCode,
            processedAt: tender.processedAt?.toISOString() ?? null, metadata: tender.metadata,
          }),
        });
        const reference = getPaymentProviderAdapter(
          tender.paymentProvider.adapterKey,
        ).validateExternalRefund({
          providerPaymentId: allocation.providerRefundId,
          amountCents: allocation.amountCents,
          currencyCode: sale.currencyCode,
          authorityProof: allocation.providerAuthority,
          credentialReference: tender.paymentProvider.credentialReference,
          purpose: "refund",
          context: confirmationContext,
        });
        return {
          tender,
          allocation: {
            ...allocation,
            providerRefundId: reference.providerPaymentId,
          },
          refundedBeforeCents,
          providerLookupKey: `${tender.paymentProvider.id}:${reference.providerPaymentId}`,
          confirmationContext,
        };
      });
      const refundReferences = new Set<string>();
      for (const planned of plannedAllocations) {
        if (!planned.providerLookupKey) continue;
        if (refundReferences.has(planned.providerLookupKey)) {
          throw new Error("External refund reference was repeated in this request");
        }
        refundReferences.add(planned.providerLookupKey);
        const duplicate = await transaction.refundTenderAllocation.findUnique({
          where: { providerLookupKey: planned.providerLookupKey },
          select: { id: true },
        });
        if (duplicate)
          throw new Error("Provider refund reference was already recorded");
      }

      const cashRefundCents = plannedAllocations
        .filter((planned) => planned.tender.method === "cash")
        .reduce((sum, planned) => sum + planned.allocation.amountCents, 0);
      if (cashRefundCents > 0) await assertCashLedger(transaction, registerSession);

      const now = new Date();
      const refund = await transaction.refund.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          saleId: sale.id,
          originalTenderId: plannedAllocations[0].tender.id,
          refundNumber: `REF-${randomUUID()}`,
          status: "completed",
          reason: args.input.reason,
          amountCents,
          currencyCode: sale.currencyCode,
          providerRefundId:
            plannedAllocations.length === 1
              ? plannedAllocations[0].allocation.providerRefundId
              : "",
          providerLookupKey: null,
          requestedById: employee.id,
          approvedById: employee.id,
          processedById: employee.id,
          requestedAt: now,
          processedAt: now,
          notes: args.input.notes?.trim() || "",
          idempotencyId,
          metadata: { registerSessionId: registerSession.id },
        },
      });

      for (const planned of plannedAllocations) {
        await transaction.refundTenderAllocation.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            refundId: refund.id,
            tenderId: planned.tender.id,
            method: planned.tender.method,
            amountCents: planned.allocation.amountCents,
            currencyCode: sale.currencyCode,
            status: "completed",
            providerRefundId: planned.allocation.providerRefundId ?? "",
            providerLookupKey: planned.providerLookupKey ?? undefined,
            metadata: {
              authorityValidated: planned.confirmationContext !== null,
              confirmationContractVersion: planned.confirmationContext ? 2 : null,
              confirmationContext: planned.confirmationContext,
            },
          },
        });
      }

      const returnRecord = await transaction.return.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          saleId: sale.id,
          refundId: refund.id,
          returnNumber: `RET-${randomUUID()}`,
          status: "completed",
          reason: args.input.returnReason ?? "unwanted",
          requestedById: employee.id,
          approvedById: employee.id,
          receivedById: employee.id,
          requestedAt: now,
          receivedAt: now,
          completedAt: now,
          notes: args.input.notes?.trim() || "",
          idempotencyId,
        },
      });

      const locationId = sale.store.primaryInventoryLocationId;
      for (const line of calculatedLines) {
        const returnLine = await transaction.returnLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            returnId: returnRecord.id,
            saleLineId: line.saleLine.id,
            quantity: line.input.quantity,
            disposition: line.input.disposition,
            condition: line.input.condition ?? "unknown",
            note: line.input.note?.trim() || "",
          },
        });

        await transaction.refundLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            refundId: refund.id,
            saleLineId: line.saleLine.id,
            returnLineId: returnLine.id,
            quantity: line.input.quantity,
            subtotalCents: line.subtotalCents,
            taxCents: line.taxCents,
            totalCents: line.totalCents,
            reason: "returned",
            note: line.input.note?.trim() || "",
          },
        });

        if (line.input.disposition === "restock") {
          if (!locationId || !line.saleLine.variantId) {
            throw new Error(
              "Restocked return requires a primary location and live variant",
            );
          }
          const lookupKey = `${locationId}:${line.saleLine.variantId}`;
          const stockLevel = await transaction.stockLevel.findUnique({
            where: { lookupKey },
          });
          const balanceAfter = addQuantities(
            stockLevel?.onHandQuantity.toString() ?? "0.0000",
            line.input.quantity,
          );
          const updatedStock = stockLevel
            ? await transaction.stockLevel.update({
                where: { id: stockLevel.id },
                data: { onHandQuantity: balanceAfter },
              })
            : await transaction.stockLevel.create({
                data: {
                  businessId: args.input.businessId,
                  storeId: args.input.storeId,
                  locationId,
                  variantId: line.saleLine.variantId,
                  lookupKey,
                  onHandQuantity: balanceAfter,
                  reservedQuantity: "0.0000",
                  parQuantity: "0.0000",
                  reorderPoint: "0.0000",
                  reorderQuantity: "0.0000",
                },
              });

          const soldByLot = new Map<string, bigint>();
          for (const entry of line.saleLine.inventoryEntries) {
            if (!entry.lotId || entry.type !== "sale") continue;
            const sold = -quantityToScaledInteger(
              entry.quantityDelta.toString(),
            );
            if (sold > 0n) {
              soldByLot.set(
                entry.lotId,
                (soldByLot.get(entry.lotId) ?? 0n) + sold,
              );
            }
          }
          const restoredByLot = new Map<string, bigint>();
          for (const previousReturn of line.saleLine.returnLines) {
            for (const entry of previousReturn.restockLedgerEntries) {
              if (!entry.lotId || entry.type !== "return") continue;
              const restored = quantityToScaledInteger(
                entry.quantityDelta.toString(),
              );
              if (restored > 0n) {
                restoredByLot.set(
                  entry.lotId,
                  (restoredByLot.get(entry.lotId) ?? 0n) + restored,
                );
              }
            }
          }
          const plan = planLotConsumption(
            line.input.quantity,
            Array.from(soldByLot, ([id, sold]) => ({
              id,
              quantityRemaining: scaledIntegerToQuantity(
                sold - (restoredByLot.get(id) ?? 0n),
              ),
            })).filter(
              (entry) => compareQuantities(entry.quantityRemaining, "0") > 0,
            ),
          );
          const segments = [
            ...plan.allocations.map((allocation) => ({
              lotId: allocation.lotId as string | null,
              quantity: allocation.quantity,
            })),
            ...(compareQuantities(plan.unallocatedQuantity, "0") > 0
              ? [{ lotId: null, quantity: plan.unallocatedQuantity }]
              : []),
          ];

          for (const segment of segments) {
            if (!segment.lotId) continue;
            const lot = await transaction.inventoryLot.findFirst({
              where: {
                id: segment.lotId,
                businessId: args.input.businessId,
                storeId: args.input.storeId,
                locationId,
                variantId: line.saleLine.variantId,
                status: { in: ["active", "consumed"] },
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
            });
            if (!lot)
              throw new Error("Original sale lot cannot be safely restocked");
            await transaction.inventoryLot.update({
              where: { id: lot.id },
              data: {
                quantityRemaining: addQuantities(
                  lot.quantityRemaining.toString(),
                  segment.quantity,
                ),
                status: "active",
              },
            });
          }

          let runningBalance =
            stockLevel?.onHandQuantity.toString() ?? "0.0000";
          for (const segment of segments) {
            runningBalance = addQuantities(runningBalance, segment.quantity);
            await transaction.inventoryLedgerEntry.create({
              data: {
                businessId: args.input.businessId,
                storeId: args.input.storeId,
                stockLevelId: updatedStock.id,
                locationId,
                variantId: line.saleLine.variantId,
                lotId: segment.lotId,
                type: "return",
                quantityDelta: segment.quantity,
                balanceAfter: runningBalance,
                reason: `Return ${returnRecord.returnNumber}`,
                sourceType: "Return",
                sourceId: returnRecord.id,
                returnLineId: returnLine.id,
                actorId: employee.id,
                idempotencyId,
                occurredAt: now,
              },
            });
          }
          if (runningBalance !== balanceAfter) {
            throw new Error(
              "Return lot allocation did not reconcile to stock balance",
            );
          }
        }
      }

      let restoredLoyaltyPoints = 0;
      const restoredAllocations: Array<{
        points: number;
        expiresAt: Date | null;
      }> = [];
      let loyaltyBalance = loyaltyAccount?.pointsBalance ?? 0;
      for (const planned of plannedAllocations) {
        // Tender economics are immutable after capture. RefundTenderAllocation
        // is the period-dated adjustment ledger; updating the original Tender
        // would rewrite a previously closed store-day/payment period.
        const tenderRefundedCents =
          planned.refundedBeforeCents + planned.allocation.amountCents;
        if (planned.tender.method === "loyalty") {
          const metadata =
            planned.tender.metadata &&
            typeof planned.tender.metadata === "object" &&
            !Array.isArray(planned.tender.metadata)
              ? (planned.tender.metadata as Record<string, unknown>)
              : {};
          const originalPoints = metadata.loyaltyPoints;
          if (
            !Number.isSafeInteger(originalPoints) ||
            Number(originalPoints) <= 0 ||
            planned.tender.amountCents <= 0
          ) {
            throw new Error(
              "Loyalty tender is missing its immutable point snapshot",
            );
          }
          const priorTarget = Math.floor(
            (Number(originalPoints) * planned.refundedBeforeCents) /
              planned.tender.amountCents,
          );
          const nextTarget =
            tenderRefundedCents === planned.tender.amountCents
              ? Number(originalPoints)
              : Math.floor(
                  (Number(originalPoints) * tenderRefundedCents) /
                    planned.tender.amountCents,
                );
          const restored = nextTarget - priorTarget;
          restoredLoyaltyPoints += restored;
          restoredAllocations.push(
            ...restoredExpirySlices(
              metadata.expiryAllocations,
              Number(originalPoints),
              priorTarget,
              nextTarget,
            ),
          );
        }
      }

      if (restoredLoyaltyPoints > 0 && loyaltyAccount) {
        if (
          restoredAllocations.reduce(
            (sum, allocation) => sum + allocation.points,
            0,
          ) !== restoredLoyaltyPoints
        ) {
          throw new Error(
            "Loyalty restoration did not match the refunded point allocation",
          );
        }
        const finalBalance = loyaltyBalance + restoredLoyaltyPoints;
        await transaction.loyaltyAccount.update({
          where: { id: loyaltyAccount.id },
          data: { pointsBalance: finalBalance },
        });
        for (const allocation of restoredAllocations) {
          loyaltyBalance += allocation.points;
          await transaction.loyaltyLedgerEntry.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              accountId: loyaltyAccount.id,
              type: allocation.expiresAt ? "earned" : "bonus",
              pointsDelta: allocation.points,
              balanceAfter: loyaltyBalance,
              description: `Redeemed points restored for ${refund.refundNumber}`,
              refundId: refund.id,
              actorId: employee.id,
              expiresAt: allocation.expiresAt,
              occurredAt: now,
              idempotencyId,
              metadata: {
                reason: "loyalty_tender_refund",
                originalExpiryPreserved: Boolean(allocation.expiresAt),
              },
            },
          });
        }
      }

      if (cashRefundCents > 0) {
        if (registerSession.expectedCashCents < cashRefundCents) {
          throw new Error("Refund would make expected register cash negative");
        }
        await transaction.cashMovement.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            registerSessionId: registerSession.id,
            employeeId: employee.id,
            type: "refund",
            direction: "out",
            amountCents: cashRefundCents,
            reason: `Cash portion of refund ${refund.refundNumber}`,
            saleId: sale.id,
            refundId: refund.id,
            occurredAt: now,
            idempotencyId,
          },
        });
        await transaction.registerSession.update({
          where: { id: registerSession.id },
          data: {
            expectedCashCents:
              registerSession.expectedCashCents - cashRefundCents,
          },
        });
      }

      const saleRefundedCents = sale.refundedCents + amountCents;
      const saleStatus =
        saleRefundedCents >= sale.totalCents
          ? "refunded"
          : "partially_refunded";
      await transaction.sale.update({
        where: { id: sale.id },
        data: { refundedCents: saleRefundedCents, status: saleStatus },
      });

      if (loyaltyAccount && sale.totalCents > 0) {
        const earnedPoints = sale.loyaltyEntries.reduce(
          (sum, entry) => sum + Math.max(0, entry.pointsDelta),
          0,
        );
        const previousReversals =
          await transaction.loyaltyLedgerEntry.aggregate({
            where: {
              accountId: loyaltyAccount.id,
              type: "refund_reversal",
              refund: { saleId: sale.id, status: "completed" },
            },
            _sum: { pointsDelta: true },
          });
        const alreadyReversed = Math.max(
          0,
          -(previousReversals._sum.pointsDelta ?? 0),
        );
        const targetReversal =
          saleRefundedCents >= sale.totalCents
            ? earnedPoints
            : Math.floor((earnedPoints * saleRefundedCents) / sale.totalCents);
        const pointsToReverse = Math.max(
          0,
          Math.min(
            earnedPoints - alreadyReversed,
            targetReversal - alreadyReversed,
          ),
        );
        if (pointsToReverse > 0) {
          const balanceAfter = loyaltyBalance - pointsToReverse;
          // A reviewed refund must not be blocked because points earned by the
          // original sale were later spent or expired. Negative balances are a
          // bounded loyalty liability and prevent further redemption.
          loyaltyBalance = balanceAfter;
          await transaction.loyaltyAccount.update({
            where: { id: loyaltyAccount.id },
            data: { pointsBalance: balanceAfter },
          });
          await transaction.loyaltyLedgerEntry.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              accountId: loyaltyAccount.id,
              type: "refund_reversal",
              pointsDelta: -pointsToReverse,
              balanceAfter,
              description: `Points reversed for ${refund.refundNumber}`,
              refundId: refund.id,
              actorId: employee.id,
              occurredAt: now,
              idempotencyId,
            },
          });
        }
      }

      return {
        id: refund.id,
        status: refund.status,
        reference: refund.refundNumber,
      };
    },
  });
}

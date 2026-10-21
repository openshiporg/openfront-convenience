import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";
import { Prisma } from "@prisma/client";

import {
  addQuantities,
  compareQuantities,
  normalizeQuantity,
  quantityToScaledInteger,
} from "../lib/quantity";
import { getPaymentProviderAdapter } from "../utils/paymentProviderAdapter";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

function fuelTotalCents(
  priceMillsPerGallon: number,
  volumeGallons: string,
): number {
  if (!Number.isSafeInteger(priceMillsPerGallon) || priceMillsPerGallon < 0) {
    throw new Error("Fuel price must be non-negative integer mills per gallon");
  }
  const numerator =
    BigInt(priceMillsPerGallon) * quantityToScaledInteger(volumeGallons);
  const denominator = 10n * 10_000n;
  return Number((numerator + denominator / 2n) / denominator);
}

export async function recordFuelDelivery(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      siteId: string;
      tankId: string;
      vendorId?: string | null;
      employeeId: string;
      billOfLadingNumber?: string | null;
      grossVolumeGallons: string;
      netVolumeGallons: string;
      beforeVolumeGallons?: string | null;
      afterVolumeGallons?: string | null;
      unitCostMillsPerGallon?: number | null;
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const grossVolume = normalizeQuantity(args.input.grossVolumeGallons);
  const netVolume = normalizeQuantity(args.input.netVolumeGallons);
  const beforeVolume = args.input.beforeVolumeGallons
    ? normalizeQuantity(args.input.beforeVolumeGallons)
    : null;
  const afterVolume = args.input.afterVolumeGallons
    ? normalizeQuantity(args.input.afterVolumeGallons)
    : null;
  if (
    compareQuantities(grossVolume, "0") <= 0 ||
    compareQuantities(netVolume, "0") <= 0
  ) {
    throw new Error("Fuel delivery volumes must be positive");
  }
  if (
    args.input.unitCostMillsPerGallon != null &&
    (!Number.isSafeInteger(args.input.unitCostMillsPerGallon) ||
      args.input.unitCostMillsPerGallon < 0)
  ) {
    throw new Error(
      "Fuel unit cost must be non-negative integer mills per gallon",
    );
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageFuel",
    scope: "recordFuelDelivery",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, grossVolume, netVolume, beforeVolume, afterVolume },
    resourceType: "FuelDelivery",
    action: "fuel.delivery.record",
    execute: async (transaction, idempotencyId) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`fuel-tank:${args.input.tankId}`}))::text AS "locked"`,
      );
      const site = await transaction.fuelSite.findFirst({
        where: {
          id: args.input.siteId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          enabled: true,
        },
      });
      const tank = await transaction.fuelTank.findFirst({
        where: {
          id: args.input.tankId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: args.input.siteId,
          status: { not: "out_of_service" },
        },
      });
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!site || !tank || !employee)
        throw new Error("Fuel site, tank, or receiving employee is invalid");
      if (args.input.vendorId) {
        const vendor = await transaction.vendor.findFirst({
          where: { id: args.input.vendorId, businessId: args.input.businessId },
        });
        if (!vendor) throw new Error("Fuel vendor not found for this business");
      }

      const measuredBefore =
        beforeVolume ?? tank.currentVolumeGallons.toString();
      const expectedAfter = addQuantities(measuredBefore, netVolume);
      const measuredAfter = afterVolume ?? expectedAfter;
      if (
        compareQuantities(measuredAfter, tank.capacityGallons.toString()) > 0
      ) {
        throw new Error("Fuel delivery would exceed tank capacity");
      }
      const variance = addQuantities(measuredAfter, `-${expectedAfter}`);
      const unitCost = args.input.unitCostMillsPerGallon ?? null;
      const totalCostCents =
        unitCost == null ? 0 : fuelTotalCents(unitCost, netVolume);
      const now = new Date();

      const delivery = await transaction.fuelDelivery.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: site.id,
          tankId: tank.id,
          vendorId: args.input.vendorId ?? null,
          deliveryNumber: `FDEL-${randomUUID()}`,
          billOfLadingNumber: args.input.billOfLadingNumber?.trim() || "",
          status: "reconciled",
          grossVolumeGallons: grossVolume,
          netVolumeGallons: netVolume,
          beforeVolumeGallons: measuredBefore,
          afterVolumeGallons: measuredAfter,
          varianceGallons: variance,
          unitCostMillsPerGallon: unitCost,
          totalCostCents,
          deliveredAt: now,
          receivedById: employee.id,
          notes: args.input.notes?.trim() || "",
          metadata: { idempotencyId },
        },
      });
      const ullageGallons = addQuantities(
        tank.capacityGallons.toString(),
        `-${measuredAfter}`,
      );
      await transaction.fuelTankReading.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: site.id,
          tankId: tank.id,
          readingNumber: `FREAD-${randomUUID()}`,
          source: "delivery",
          volumeGallons: measuredAfter,
          waterVolumeGallons: tank.waterVolumeGallons,
          ullageGallons,
          measuredAt: now,
          recordedById: employee.id,
          idempotencyId,
          metadata: { deliveryId: delivery.id },
        },
      });
      await transaction.fuelTank.update({
        where: { id: tank.id },
        data: {
          currentVolumeGallons: measuredAfter,
          ullageGallons,
          lastReadingAt: now,
          status: "active",
        },
      });
      return {
        id: delivery.id,
        status: delivery.status,
        reference: delivery.deliveryNumber,
      };
    },
  });
}

type FuelPaymentMethod =
  "cash" | "credit_card" | "debit_card" | "fleet_card" | "mobile_wallet";

export async function authorizeFuelPayment(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      siteId: string;
      registerSessionId: string;
      employeeId: string;
      method: FuelPaymentMethod;
      priceTier: "cash" | "credit" | "fleet";
      amountCents: number;
      paymentProviderId?: string | null;
      providerPaymentId?: string | null;
      providerAuthority?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (
    !Number.isSafeInteger(args.input.amountCents) ||
    args.input.amountCents <= 0
  )
    throw new Error("Fuel payment must be a positive integer number of cents");
  const allowedMethods = new Set<FuelPaymentMethod>([
    "cash",
    "credit_card",
    "debit_card",
    "fleet_card",
    "mobile_wallet",
  ]);
  if (!allowedMethods.has(args.input.method))
    throw new Error("Fuel payment method is not supported");
  const requiredPriceTier =
    args.input.method === "cash"
      ? "cash"
      : args.input.method === "fleet_card"
        ? "fleet"
        : "credit";
  if (args.input.priceTier !== requiredPriceTier) {
    throw new Error(
      `Fuel ${args.input.method} payments require the ${requiredPriceTier} price tier`,
    );
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageFuel",
    scope: "authorizeFuelPayment",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "Sale",
    action: "fuel.payment.authorize",
    execute: async (transaction, idempotencyId) => {
      const [site, registerSession, employee] = await Promise.all([
        transaction.fuelSite.findFirst({
          where: {
            id: args.input.siteId,
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            enabled: true,
            status: "online",
          },
          include: { store: true },
        }),
        transaction.registerSession.findFirst({
          where: {
            id: args.input.registerSessionId,
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            status: "open",
          },
        }),
        transaction.employee.findFirst({
          where: {
            id: args.input.employeeId,
            businessId: args.input.businessId,
            status: "active",
            stores: { some: { id: args.input.storeId } },
          },
        }),
      ]);
      if (!site?.store || !registerSession || !employee)
        throw new Error(
          "Online fuel site, open register session, or employee not found",
        );

      let paymentProviderId: string | null = null;
      let providerPaymentId = "";
      if (args.input.method === "cash") {
        if (
          args.input.paymentProviderId ||
          args.input.providerPaymentId?.trim() ||
          args.input.providerAuthority?.trim()
        ) {
          throw new Error("Cash fuel payment cannot carry provider evidence");
        }
      } else {
        if (
          !args.input.paymentProviderId ||
          !args.input.providerPaymentId?.trim() ||
          !args.input.providerAuthority?.trim()
        ) {
          throw new Error(
            "Non-cash fuel payment requires provider reference and signed authority",
          );
        }
        const provider = await transaction.paymentProvider.findFirst({
          where: {
            id: args.input.paymentProviderId,
            businessId: args.input.businessId,
            status: "active",
          },
        });
        if (!provider)
          throw new Error("Active fuel payment provider not found");
        const confirmation = getPaymentProviderAdapter(
          provider.adapterKey,
        ).validateExternalConfirmation({
          providerPaymentId: args.input.providerPaymentId,
          amountCents: args.input.amountCents,
          currencyCode: site.store.currencyCode,
          authorityProof: args.input.providerAuthority,
          credentialReference: provider.credentialReference,
          purpose: "payment",
        });
        const prior = await transaction.tender.findFirst({
          where: {
            businessId: args.input.businessId,
            paymentProviderId: provider.id,
            providerPaymentId: confirmation.providerPaymentId,
          },
          select: { id: true },
        });
        if (prior)
          throw new Error("Provider payment reference was already recorded");
        paymentProviderId = provider.id;
        providerPaymentId = confirmation.providerPaymentId;
      }

      const now = new Date();
      const sale = await transaction.sale.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          receiptNumber: `FSALE-${randomUUID()}`,
          source: "api",
          status: "completed",
          currencyCode: site.store.currencyCode,
          subtotalCents: args.input.amountCents,
          totalCents: args.input.amountCents,
          registerSessionId: registerSession.id,
          cashierId: employee.id,
          completedAt: now,
          idempotencyId,
          metadata: {
            purpose: "fuel_authorization",
            fuelSiteId: site.id,
            priceTier: args.input.priceTier,
          },
        },
      });
      const tender = await transaction.tender.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          saleId: sale.id,
          paymentProviderId,
          method: args.input.method,
          status: "captured",
          amountCents: args.input.amountCents,
          tenderedCents:
            args.input.method === "cash" ? args.input.amountCents : null,
          refundedCents: 0,
          currencyCode: site.store.currencyCode,
          providerPaymentId,
          providerLookupKey:
            paymentProviderId && providerPaymentId
              ? `${paymentProviderId}:${providerPaymentId}`
              : null,
          processedAt: now,
          processedById: employee.id,
          idempotencyId,
          metadata: {
            purpose: "fuel_authorization",
            fuelSiteId: site.id,
            priceTier: args.input.priceTier,
          },
        },
      });
      if (args.input.method === "cash") {
        await transaction.cashMovement.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            registerSessionId: registerSession.id,
            employeeId: employee.id,
            type: "sale_payment",
            direction: "in",
            amountCents: args.input.amountCents,
            reason: `Fuel payment ${sale.receiptNumber}`,
            saleId: sale.id,
            tenderId: tender.id,
            occurredAt: now,
            idempotencyId,
          },
        });
        await transaction.registerSession.update({
          where: { id: registerSession.id },
          data: { expectedCashCents: { increment: args.input.amountCents } },
        });
      }
      return {
        id: sale.id,
        status: sale.status,
        reference: sale.receiptNumber,
      };
    },
  });
}

export async function cancelFuelPaymentAuthorization(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      saleId: string;
      employeeId: string;
      reason: string;
      providerRefundId?: string | null;
      providerAuthority?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const reason = args.input.reason.trim();
  if (reason.length < 3 || reason.length > 500)
    throw new Error(
      "Fuel payment cancellation reason must be 3-500 characters",
    );

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageFuel",
    scope: "cancelFuelPaymentAuthorization",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, reason },
    resourceType: "Refund",
    action: "fuel.payment.cancel",
    execute: async (transaction, idempotencyId) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`fuel-payment:${args.input.saleId}`}))::text AS "locked"`,
      );
      const sale = await transaction.sale.findFirst({
        where: {
          id: args.input.saleId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "completed",
        },
        include: {
          registerSession: true,
          tenders: { include: { paymentProvider: true } },
          _count: { select: { lines: true } },
        },
      });
      const linkedFuelTransaction = sale
        ? await transaction.fuelTransaction.findFirst({
            where: { saleId: sale.id },
            select: { id: true },
          })
        : null;
      const metadata =
        sale?.metadata &&
        typeof sale.metadata === "object" &&
        !Array.isArray(sale.metadata)
          ? (sale.metadata as Record<string, unknown>)
          : {};
      if (
        !sale ||
        metadata.purpose !== "fuel_authorization" ||
        sale._count.lines !== 0 ||
        linkedFuelTransaction ||
        sale.tenders.length !== 1
      ) {
        throw new Error(
          "Only an unused dedicated fuel-payment authorization can be cancelled",
        );
      }
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!employee) throw new Error("Active fuel employee not found");
      const tender = sale.tenders[0];
      if (
        tender.status !== "captured" ||
        tender.amountCents !== sale.totalCents ||
        tender.refundedCents !== 0
      ) {
        throw new Error("Fuel payment tender is not fully cancellable");
      }

      const now = new Date();
      let providerRefundId = "";
      let providerLookupKey: string | null = null;
      if (tender.method === "cash") {
        if (
          args.input.providerRefundId?.trim() ||
          args.input.providerAuthority?.trim()
        ) {
          throw new Error(
            "Cash fuel cancellation cannot carry provider evidence",
          );
        }
        if (!sale.registerSession || sale.registerSession.status !== "open")
          throw new Error(
            "Cash fuel cancellation requires the original open register session",
          );
        if (sale.registerSession.expectedCashCents < tender.amountCents)
          throw new Error(
            "Fuel payment cancellation would make expected register cash negative",
          );
      } else {
        if (
          !tender.paymentProvider ||
          !args.input.providerRefundId?.trim() ||
          !args.input.providerAuthority?.trim()
        ) {
          throw new Error(
            "Non-cash fuel cancellation requires provider refund reference and signed authority",
          );
        }
        const confirmation = getPaymentProviderAdapter(
          tender.paymentProvider.adapterKey,
        ).validateExternalRefund({
          providerPaymentId: args.input.providerRefundId,
          amountCents: tender.amountCents,
          currencyCode: sale.currencyCode,
          authorityProof: args.input.providerAuthority,
          credentialReference: tender.paymentProvider.credentialReference,
          purpose: "refund",
        });
        providerRefundId = confirmation.providerPaymentId;
        providerLookupKey = `${tender.paymentProvider.id}:${providerRefundId}`;
        const [priorRefund, priorAllocation] = await Promise.all([
          transaction.refund.findFirst({ where: { providerLookupKey } }),
          transaction.refundTenderAllocation.findFirst({
            where: { providerLookupKey },
          }),
        ]);
        if (priorRefund || priorAllocation)
          throw new Error("Provider refund reference was already recorded");
      }

      const refund = await transaction.refund.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          saleId: sale.id,
          originalTenderId: tender.id,
          refundNumber: `FREF-${randomUUID()}`,
          status: "completed",
          reason: "service_recovery",
          amountCents: tender.amountCents,
          currencyCode: sale.currencyCode,
          providerRefundId,
          providerLookupKey,
          requestedById: employee.id,
          approvedById: employee.id,
          processedById: employee.id,
          requestedAt: now,
          processedAt: now,
          notes: reason,
          idempotencyId,
          metadata: { purpose: "unused_fuel_authorization_cancellation" },
        },
      });
      await transaction.refundTenderAllocation.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          refundId: refund.id,
          tenderId: tender.id,
          method: tender.method,
          amountCents: tender.amountCents,
          currencyCode: sale.currencyCode,
          status: "completed",
          providerRefundId,
          providerLookupKey,
          metadata: { purpose: "unused_fuel_authorization_cancellation" },
        },
      });
      if (tender.method === "cash") {
        await transaction.cashMovement.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            registerSessionId: sale.registerSession!.id,
            employeeId: employee.id,
            type: "refund",
            direction: "out",
            amountCents: tender.amountCents,
            reason: `Unused fuel payment cancellation ${refund.refundNumber}`,
            saleId: sale.id,
            refundId: refund.id,
            occurredAt: now,
            idempotencyId,
          },
        });
        await transaction.registerSession.update({
          where: { id: sale.registerSession!.id },
          data: {
            expectedCashCents:
              sale.registerSession!.expectedCashCents - tender.amountCents,
          },
        });
      }
      await transaction.tender.update({
        where: { id: tender.id },
        data: { status: "refunded", refundedCents: tender.amountCents },
      });
      await transaction.sale.update({
        where: { id: sale.id },
        data: { status: "refunded", refundedCents: sale.totalCents },
      });
      return {
        id: refund.id,
        status: refund.status,
        reference: refund.refundNumber,
      };
    },
  });
}

export async function completeFuelTransaction(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      siteId: string;
      pumpId: string;
      nozzleId: string;
      gradeId: string;
      controllerTransactionId: string;
      priceTier: "cash" | "credit" | "fleet" | "loyalty";
      volumeGallons: string;
      saleId: string;
      tenderId: string;
      providerRefundId?: string | null;
      providerAuthority?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const volume = normalizeQuantity(args.input.volumeGallons);
  if (compareQuantities(volume, "0") <= 0)
    throw new Error("Fuel transaction volume must be positive");
  if (!args.input.saleId || !args.input.tenderId) {
    throw new Error(
      "Completed fuel dispenses require a dedicated completed sale and captured tender",
    );
  }
  const controllerTransactionId = args.input.controllerTransactionId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(controllerTransactionId)) {
    throw new Error(
      "Controller transaction reference contains unsupported characters",
    );
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageFuel",
    scope: "completeFuelTransaction",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, volume, controllerTransactionId },
    resourceType: "FuelTransaction",
    action: "fuel.transaction.complete",
    execute: async (transaction, idempotencyId) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`fuel-nozzle:${args.input.nozzleId}`}))::text AS "locked"`,
      );
      const now = new Date();
      const duplicate = await transaction.fuelTransaction.findFirst({
        where: {
          businessId: args.input.businessId,
          OR: [
            { siteId: args.input.siteId, controllerTransactionId },
            { tenderId: args.input.tenderId },
          ],
        },
        select: { id: true },
      });
      if (duplicate)
        throw new Error(
          "Controller transaction reference or fuel tender was already recorded",
        );
      const nozzle = await transaction.fuelNozzle.findFirst({
        where: {
          id: args.input.nozzleId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          pumpId: args.input.pumpId,
          gradeId: args.input.gradeId,
          pump: { siteId: args.input.siteId },
          status: { in: ["available", "lifted", "dispensing"] },
        },
        include: { tank: true, pump: true },
      });
      if (!nozzle?.tank || !nozzle.pump)
        throw new Error("Available fuel nozzle, pump, and tank not found");
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`fuel-tank:${nozzle.tank.id}`}))::text AS "locked"`,
      );
      if (
        nozzle.tank.businessId !== args.input.businessId ||
        nozzle.tank.storeId !== args.input.storeId ||
        nozzle.tank.siteId !== args.input.siteId ||
        nozzle.tank.gradeId !== args.input.gradeId ||
        nozzle.pump.businessId !== args.input.businessId ||
        nozzle.pump.storeId !== args.input.storeId ||
        nozzle.pump.siteId !== args.input.siteId
      ) {
        throw new Error(
          "Fuel nozzle relationships do not resolve to one business, store, site, and grade",
        );
      }
      const site = await transaction.fuelSite.findFirst({
        where: {
          id: args.input.siteId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          enabled: true,
          status: "online",
        },
        include: { store: true },
      });
      if (!site?.store)
        throw new Error("Fuel site is not online or has no store");

      await transaction.fuelPrice.updateMany({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: site.id,
          gradeId: args.input.gradeId,
          priceTier: args.input.priceTier,
          status: "scheduled",
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        data: { status: "active" },
      });
      const price = await transaction.fuelPrice.findFirst({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: site.id,
          gradeId: args.input.gradeId,
          priceTier: args.input.priceTier,
          status: "active",
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        orderBy: { startsAt: "desc" },
      });
      if (!price)
        throw new Error("No active fuel price found for this grade and tier");

      const totalCents = fuelTotalCents(price.priceMillsPerGallon, volume);
      const sale = await transaction.sale.findFirst({
        where: {
          id: args.input.saleId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "completed",
        },
        include: {
          registerSession: true,
          _count: { select: { lines: true, tenders: true } },
        },
      });
      const saleMetadata =
        sale?.metadata &&
        typeof sale.metadata === "object" &&
        !Array.isArray(sale.metadata)
          ? (sale.metadata as Record<string, unknown>)
          : {};
      if (
        !sale ||
        saleMetadata.purpose !== "fuel_authorization" ||
        saleMetadata.fuelSiteId !== site.id ||
        saleMetadata.priceTier !== args.input.priceTier ||
        sale._count.lines !== 0 ||
        sale._count.tenders !== 1
      ) {
        throw new Error(
          "Fuel dispense requires a dedicated fuel-payment sale for the exact fuel amount",
        );
      }
      const tender = await transaction.tender.findFirst({
        where: {
          id: args.input.tenderId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          saleId: sale.id,
          status: "captured",
          refundedCents: 0,
        },
        include: { paymentProvider: true },
      });
      const tenderMetadata =
        tender?.metadata &&
        typeof tender.metadata === "object" &&
        !Array.isArray(tender.metadata)
          ? (tender.metadata as Record<string, unknown>)
          : {};
      if (
        !tender ||
        tenderMetadata.purpose !== "fuel_authorization" ||
        tenderMetadata.fuelSiteId !== site.id ||
        tenderMetadata.priceTier !== args.input.priceTier
      )
        throw new Error(
          "Fuel dispense requires one unused captured tender for the exact fuel amount and dedicated fuel evidence",
        );
      if (tender.currencyCode !== site.store.currencyCode)
        throw new Error("Linked fuel tender currency does not match the store");
      if (
        sale.totalCents !== tender.amountCents ||
        totalCents > tender.amountCents
      ) {
        throw new Error(
          "Fuel dispense total cannot exceed or disagree with its captured authorization",
        );
      }
      const unusedAuthorizationCents = tender.amountCents - totalCents;
      let providerRefundId = "";
      let providerLookupKey: string | null = null;
      if (unusedAuthorizationCents === 0) {
        if (
          args.input.providerRefundId?.trim() ||
          args.input.providerAuthority?.trim()
        ) {
          throw new Error(
            "Exact fuel completion cannot carry unused-authorization refund evidence",
          );
        }
      } else if (tender.method === "cash") {
        if (
          args.input.providerRefundId?.trim() ||
          args.input.providerAuthority?.trim()
        ) {
          throw new Error(
            "Cash fuel completion cannot carry provider refund evidence",
          );
        }
        if (!sale.registerSession || sale.registerSession.status !== "open") {
          throw new Error(
            "Partial cash fuel completion requires the original open register session",
          );
        }
        if (sale.registerSession.expectedCashCents < unusedAuthorizationCents) {
          throw new Error(
            "Partial fuel completion would make expected register cash negative",
          );
        }
      } else {
        if (
          !tender.paymentProvider ||
          !args.input.providerRefundId?.trim() ||
          !args.input.providerAuthority?.trim()
        ) {
          throw new Error(
            "Partial non-cash fuel completion requires a provider release/refund reference and signed authority",
          );
        }
        const confirmation = getPaymentProviderAdapter(
          tender.paymentProvider.adapterKey,
        ).validateExternalRefund({
          providerPaymentId: args.input.providerRefundId,
          amountCents: unusedAuthorizationCents,
          currencyCode: sale.currencyCode,
          authorityProof: args.input.providerAuthority,
          credentialReference: tender.paymentProvider.credentialReference,
          purpose: "refund",
        });
        providerRefundId = confirmation.providerPaymentId;
        providerLookupKey = `${tender.paymentProvider.id}:${providerRefundId}`;
        const [priorRefund, priorAllocation] = await Promise.all([
          transaction.refund.findFirst({ where: { providerLookupKey } }),
          transaction.refundTenderAllocation.findFirst({
            where: { providerLookupKey },
          }),
        ]);
        if (priorRefund || priorAllocation)
          throw new Error("Provider refund reference was already recorded");
      }

      const remainingVolume = addQuantities(
        nozzle.tank.currentVolumeGallons.toString(),
        `-${volume}`,
      );
      if (compareQuantities(remainingVolume, "0") < 0) {
        throw new Error("Fuel transaction exceeds tank inventory");
      }
      const fuelTransaction = await transaction.fuelTransaction.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: site.id,
          pumpId: nozzle.pump.id,
          nozzleId: nozzle.id,
          gradeId: args.input.gradeId,
          transactionNumber: `FTXN-${randomUUID()}`,
          controllerTransactionId,
          status: "completed",
          volumeGallons: volume,
          unitPriceMillsPerGallon: price.priceMillsPerGallon,
          totalCents,
          authorizedCents: tender.amountCents,
          currencyCode: site.store.currencyCode,
          saleId: sale.id,
          tenderId: tender.id,
          requestedAt: now,
          authorizedAt: now,
          dispensingStartedAt: now,
          completedAt: now,
          idempotencyId,
          metadata: { fuelPriceId: price.id },
        },
      });
      if (unusedAuthorizationCents > 0) {
        if (!sale.cashierId)
          throw new Error("Fuel authorization is missing its cashier evidence");
        const refund = await transaction.refund.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            saleId: sale.id,
            originalTenderId: tender.id,
            refundNumber: `FREF-${randomUUID()}`,
            status: "completed",
            reason: "service_recovery",
            amountCents: unusedAuthorizationCents,
            currencyCode: sale.currencyCode,
            providerRefundId,
            providerLookupKey,
            requestedById: sale.cashierId,
            approvedById: sale.cashierId,
            processedById: sale.cashierId,
            requestedAt: now,
            processedAt: now,
            notes: "Unused fuel preauthorization released after dispense",
            idempotencyId,
            metadata: {
              purpose: "partial_fuel_authorization_release",
              fuelTransactionId: fuelTransaction.id,
            },
          },
        });
        await transaction.refundTenderAllocation.create({
          data: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            refundId: refund.id,
            tenderId: tender.id,
            method: tender.method,
            amountCents: unusedAuthorizationCents,
            currencyCode: sale.currencyCode,
            status: "completed",
            providerRefundId,
            providerLookupKey,
            metadata: {
              purpose: "partial_fuel_authorization_release",
              fuelTransactionId: fuelTransaction.id,
            },
          },
        });
        if (tender.method === "cash") {
          await transaction.cashMovement.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              registerSessionId: sale.registerSession!.id,
              employeeId: sale.cashierId,
              type: "refund",
              direction: "out",
              amountCents: unusedAuthorizationCents,
              reason: `Unused fuel authorization released for ${sale.receiptNumber}`,
              saleId: sale.id,
              refundId: refund.id,
              occurredAt: now,
              idempotencyId,
            },
          });
          await transaction.registerSession.update({
            where: { id: sale.registerSession!.id },
            data: {
              expectedCashCents:
                sale.registerSession!.expectedCashCents -
                unusedAuthorizationCents,
            },
          });
        }
        await transaction.tender.update({
          where: { id: tender.id },
          data: {
            status: "partially_refunded",
            refundedCents: unusedAuthorizationCents,
          },
        });
        await transaction.sale.update({
          where: { id: sale.id },
          data: {
            status: "partially_refunded",
            refundedCents: unusedAuthorizationCents,
          },
        });
      }
      await transaction.fuelTank.update({
        where: { id: nozzle.tank.id },
        data: {
          currentVolumeGallons: remainingVolume,
          ullageGallons: addQuantities(
            nozzle.tank.capacityGallons.toString(),
            `-${remainingVolume}`,
          ),
          lastReadingAt: now,
          status:
            compareQuantities(remainingVolume, "100.0000") < 0
              ? "low"
              : "active",
        },
      });
      await transaction.fuelPump.update({
        where: { id: nozzle.pump.id },
        data: { status: "available", lastCommunicationAt: now },
      });
      await transaction.fuelNozzle.update({
        where: { id: nozzle.id },
        data: { status: "available" },
      });
      return {
        id: fuelTransaction.id,
        status: fuelTransaction.status,
        reference: fuelTransaction.transactionNumber,
      };
    },
  });
}

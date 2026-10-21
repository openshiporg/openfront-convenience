import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";
import { Prisma } from "@prisma/client";

import { calculateFuelVariance } from "../lib/reconciliation";
import { assertSettlementDoesNotOverlapLockedDay } from "../lib/settlementPeriodPolicy";
import {
  FUEL_RECONCILIATION_TRANSITIONS,
  evaluateTransition,
} from "../lib/transitionPolicy";
import {
  addQuantities,
  compareQuantities,
  normalizeQuantity,
  quantityToScaledInteger,
} from "../lib/quantity";
import {
  metadataSourceSetDigest,
  sourceSetDigest,
} from "../lib/sourceSetDigest";
import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

function slug(value: string, label: string): string {
  const result = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(result))
    throw new Error(`${label} must be a lowercase slug`);
  return result;
}

export async function configureFuelTopology(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      siteName: string;
      siteCode: string;
      gradeName: string;
      gradeCode: string;
      octaneRating?: number | null;
      tankNumber: string;
      tankCapacityGallons: string;
      initialVolumeGallons?: string | null;
      pumpNumber: string;
      nozzleNumber: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const siteName = args.input.siteName.trim();
  const siteCode = slug(args.input.siteCode, "Fuel site code");
  const gradeName = args.input.gradeName.trim();
  const gradeCode = slug(args.input.gradeCode, "Fuel grade code");
  const tankNumber = args.input.tankNumber.trim();
  const pumpNumber = args.input.pumpNumber.trim();
  const nozzleNumber = args.input.nozzleNumber.trim();
  const capacity = normalizeQuantity(args.input.tankCapacityGallons);
  const initial = normalizeQuantity(args.input.initialVolumeGallons ?? "0");
  if (!siteName || !gradeName || !tankNumber || !pumpNumber || !nozzleNumber)
    throw new Error("Fuel topology labels and numbers are required");
  if (
    compareQuantities(capacity, "0") <= 0 ||
    compareQuantities(initial, capacity) > 0
  )
    throw new Error(
      "Fuel tank capacity must be positive and initial volume cannot exceed it",
    );
  if (
    args.input.octaneRating != null &&
    (!Number.isSafeInteger(args.input.octaneRating) ||
      args.input.octaneRating < 0 ||
      args.input.octaneRating > 120)
  ) {
    throw new Error("Octane rating must be an integer from 0 to 120");
  }
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageFuel",
    scope: "configureFuelTopology",
    idempotencyKey: args.input.idempotencyKey,
    input: {
      ...args.input,
      siteName,
      siteCode,
      gradeName,
      gradeCode,
      tankNumber,
      pumpNumber,
      nozzleNumber,
      capacity,
      initial,
    },
    resourceType: "FuelNozzle",
    action: "fuel_topology.configure",
    execute: async (transaction) => {
      const store = await transaction.store.findFirst({
        where: {
          id: args.input.storeId,
          businessId: args.input.businessId,
          status: "active",
        },
      });
      if (!store) throw new Error("Active fuel store not found");
      if (!store.fuelEnabled) {
        await transaction.store.update({
          where: { id: store.id },
          data: { fuelEnabled: true },
        });
      }
      const site = await transaction.fuelSite.upsert({
        where: { lookupKey: `${store.id}:${siteCode}` },
        update: { name: siteName, enabled: true, status: "online" },
        create: {
          businessId: args.input.businessId,
          storeId: store.id,
          name: siteName,
          siteCode,
          lookupKey: `${store.id}:${siteCode}`,
          enabled: true,
          status: "online",
          controllerAdapterKey: "manual_external",
          configuration: {
            boundary:
              "operator recorded until a controller adapter is configured",
          },
        },
      });
      const grade = await transaction.fuelGrade.upsert({
        where: { lookupKey: `${site.id}:grade:${gradeCode}` },
        update: {
          name: gradeName,
          octaneRating: args.input.octaneRating ?? null,
          status: "active",
        },
        create: {
          businessId: args.input.businessId,
          storeId: store.id,
          siteId: site.id,
          name: gradeName,
          code: gradeCode,
          lookupKey: `${site.id}:grade:${gradeCode}`,
          octaneRating: args.input.octaneRating ?? null,
          productCode: gradeCode,
          status: "active",
        },
      });
      const tankLookupKey = `${site.id}:tank:${tankNumber}`;
      const existingTank = await transaction.fuelTank.findUnique({
        where: { lookupKey: tankLookupKey },
      });
      if (
        existingTank &&
        compareQuantities(
          existingTank.currentVolumeGallons.toString(),
          capacity,
        ) > 0
      ) {
        throw new Error(
          "Fuel tank capacity cannot be reduced below its current volume",
        );
      }
      const tank = await transaction.fuelTank.upsert({
        where: { lookupKey: tankLookupKey },
        update: { gradeId: grade.id, capacityGallons: capacity },
        create: {
          businessId: args.input.businessId,
          storeId: store.id,
          siteId: site.id,
          gradeId: grade.id,
          tankNumber,
          lookupKey: tankLookupKey,
          status: "active",
          capacityGallons: capacity,
          currentVolumeGallons: initial,
          waterVolumeGallons: "0.0000",
          ullageGallons: addQuantities(capacity, `-${initial}`),
        },
      });
      const pump = await transaction.fuelPump.upsert({
        where: { lookupKey: `${site.id}:pump:${pumpNumber}` },
        update: { status: "available" },
        create: {
          businessId: args.input.businessId,
          storeId: store.id,
          siteId: site.id,
          pumpNumber,
          lookupKey: `${site.id}:pump:${pumpNumber}`,
          status: "available",
        },
      });
      const nozzle = await transaction.fuelNozzle.upsert({
        where: { lookupKey: `${pump.id}:nozzle:${nozzleNumber}` },
        update: { tankId: tank.id, gradeId: grade.id, status: "available" },
        create: {
          businessId: args.input.businessId,
          storeId: store.id,
          pumpId: pump.id,
          tankId: tank.id,
          gradeId: grade.id,
          nozzleNumber,
          lookupKey: `${pump.id}:nozzle:${nozzleNumber}`,
          status: "available",
        },
      });
      return {
        id: nozzle.id,
        status: "configured",
        reference: `${siteCode}:${pumpNumber}:${nozzleNumber}`,
      };
    },
  });
}

function parseTimestamp(value: string, label: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()))
    throw new Error(`${label} must be a valid ISO timestamp`);
  return parsed;
}

function assertPeriod(start: Date, end: Date): void {
  if (end <= start)
    throw new Error("Fuel reconciliation period end must be after its start");
  if (end.getTime() - start.getTime() > 45 * 24 * 60 * 60 * 1000) {
    throw new Error("Fuel reconciliation period cannot exceed 45 days");
  }
}

export async function setFuelPrice(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      siteId: string;
      gradeId: string;
      employeeId: string;
      priceTier: "cash" | "credit" | "fleet" | "loyalty";
      priceMillsPerGallon: number;
      effectiveAt: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (
    !Number.isSafeInteger(args.input.priceMillsPerGallon) ||
    args.input.priceMillsPerGallon <= 0
  ) {
    throw new Error(
      "Fuel price must be a positive integer number of mills per gallon",
    );
  }
  const effectiveAt = parseTimestamp(
    args.input.effectiveAt,
    "Fuel price effective time",
  );

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageFuel",
    scope: "setFuelPrice",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, effectiveAt },
    resourceType: "FuelPrice",
    action: "fuel.price.set",
    execute: async (transaction, idempotencyId) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`fuel-price:${args.input.siteId}:${args.input.gradeId}:${args.input.priceTier}`}))::text AS "locked"`,
      );
      const site = await transaction.fuelSite.findFirst({
        where: {
          id: args.input.siteId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          enabled: true,
        },
      });
      const grade = await transaction.fuelGrade.findFirst({
        where: {
          id: args.input.gradeId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: args.input.siteId,
          status: "active",
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
      if (!site || !grade || !employee) {
        throw new Error("Fuel site, grade, or authorizing employee is invalid");
      }

      await transaction.fuelPrice.updateMany({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: site.id,
          gradeId: grade.id,
          priceTier: args.input.priceTier,
          status: { in: ["active", "scheduled"] },
          startsAt: { gte: effectiveAt },
        },
        data: { status: "cancelled" },
      });
      await transaction.fuelPrice.updateMany({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: site.id,
          gradeId: grade.id,
          priceTier: args.input.priceTier,
          status: { in: ["active", "scheduled"] },
          startsAt: { lt: effectiveAt },
          OR: [{ endsAt: null }, { endsAt: { gt: effectiveAt } }],
        },
        data: { endsAt: effectiveAt },
      });

      const price = await transaction.fuelPrice.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: site.id,
          gradeId: grade.id,
          lookupKey: `${site.id}:${grade.id}:${args.input.priceTier}:${effectiveAt.toISOString()}:${randomUUID()}`,
          priceTier: args.input.priceTier,
          priceMillsPerGallon: args.input.priceMillsPerGallon,
          status: effectiveAt <= new Date() ? "active" : "scheduled",
          startsAt: effectiveAt,
          authorizedById: employee.id,
          metadata: { idempotencyId },
        },
      });
      return {
        id: price.id,
        status: price.status,
        reference: `${grade.name} ${args.input.priceTier}`,
      };
    },
  });
}

export async function recordFuelTankReading(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      siteId: string;
      tankId: string;
      employeeId: string;
      source: "manual_stick" | "atg" | "controller" | "delivery" | "import";
      volumeGallons: string;
      waterVolumeGallons?: string | null;
      temperatureFahrenheit?: string | null;
      measuredAt: string;
      externalReference?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const volume = normalizeQuantity(args.input.volumeGallons);
  const water = normalizeQuantity(args.input.waterVolumeGallons ?? "0");
  const temperature =
    args.input.temperatureFahrenheit == null
      ? null
      : normalizeQuantity(args.input.temperatureFahrenheit);
  const measuredAt = parseTimestamp(args.input.measuredAt, "Tank reading time");
  if (measuredAt.getTime() > Date.now() + 5 * 60 * 1000) {
    throw new Error(
      "Tank reading time cannot be more than five minutes in the future",
    );
  }
  if (compareQuantities(water, volume) > 0) {
    throw new Error("Water volume cannot exceed measured tank volume");
  }

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageFuel",
    scope: "recordFuelTankReading",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, volume, water, temperature, measuredAt },
    resourceType: "FuelTankReading",
    action: "fuel.tank_reading.record",
    execute: async (transaction, idempotencyId) => {
      const tank = await transaction.fuelTank.findFirst({
        where: {
          id: args.input.tankId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: args.input.siteId,
          status: { not: "out_of_service" },
        },
      });
      const site = await transaction.fuelSite.findFirst({
        where: {
          id: args.input.siteId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          enabled: true,
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
      if (!tank || !site || !employee)
        throw new Error("Fuel tank, site, or recorder is invalid");
      if (compareQuantities(volume, tank.capacityGallons.toString()) > 0) {
        throw new Error("Measured volume exceeds tank capacity");
      }
      if (tank.lastReadingAt && measuredAt < tank.lastReadingAt) {
        throw new Error(
          "A new operational tank reading cannot predate the latest reading",
        );
      }

      const ullage = addQuantities(
        tank.capacityGallons.toString(),
        `-${volume}`,
      );
      const reading = await transaction.fuelTankReading.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          siteId: site.id,
          tankId: tank.id,
          readingNumber: `FREAD-${randomUUID()}`,
          source: args.input.source,
          volumeGallons: volume,
          waterVolumeGallons: water,
          ullageGallons: ullage,
          temperatureFahrenheit: temperature,
          externalReference: args.input.externalReference?.trim() || "",
          measuredAt,
          recordedById: employee.id,
          idempotencyId,
        },
      });
      await transaction.fuelTank.update({
        where: { id: tank.id },
        data: {
          currentVolumeGallons: volume,
          waterVolumeGallons: water,
          ullageGallons: ullage,
          lastReadingAt: measuredAt,
          status: compareQuantities(volume, "100.0000") < 0 ? "low" : "active",
        },
      });
      return {
        id: reading.id,
        status: reading.source,
        reference: reading.readingNumber,
      };
    },
  });
}

export async function generateFuelReconciliation(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      siteId: string;
      tankId: string;
      openingReadingId: string;
      closingReadingId: string;
      employeeId: string;
      periodStartedAt: string;
      periodEndedAt: string;
      toleranceGallons: string;
      notes?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const periodStartedAt = parseTimestamp(
    args.input.periodStartedAt,
    "Fuel period start",
  );
  const periodEndedAt = parseTimestamp(
    args.input.periodEndedAt,
    "Fuel period end",
  );
  assertPeriod(periodStartedAt, periodEndedAt);
  const tolerance = normalizeQuantity(args.input.toleranceGallons);
  if (compareQuantities(tolerance, "0") < 0)
    throw new Error("Fuel tolerance cannot be negative");

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageFuel",
    scope: "generateFuelReconciliation",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, periodStartedAt, periodEndedAt, tolerance },
    resourceType: "FuelReconciliation",
    action: "fuel.reconciliation.generate",
    execute: async (transaction, idempotencyId) => {
      const [opening, closing, employee] = await Promise.all([
        transaction.fuelTankReading.findFirst({
          where: {
            id: args.input.openingReadingId,
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            siteId: args.input.siteId,
            tankId: args.input.tankId,
          },
        }),
        transaction.fuelTankReading.findFirst({
          where: {
            id: args.input.closingReadingId,
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            siteId: args.input.siteId,
            tankId: args.input.tankId,
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
      if (!opening || !closing || !employee) {
        throw new Error(
          "Opening/closing readings or generating employee are invalid",
        );
      }
      if (
        opening.measuredAt.getTime() !== periodStartedAt.getTime() ||
        closing.measuredAt.getTime() !== periodEndedAt.getTime()
      ) {
        throw new Error(
          "Opening and closing readings must match the requested period boundaries",
        );
      }
      if (closing.measuredAt <= opening.measuredAt) {
        throw new Error("Closing reading must be later than opening reading");
      }

      const [deliveries, transactions] = await Promise.all([
        transaction.fuelDelivery.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            siteId: args.input.siteId,
            tankId: args.input.tankId,
            status: "reconciled",
            deliveredAt: { gte: opening.measuredAt, lt: closing.measuredAt },
          },
          select: { id: true, netVolumeGallons: true },
          take: 10_001,
        }),
        transaction.fuelTransaction.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            siteId: args.input.siteId,
            nozzle: { tankId: args.input.tankId },
            status: "completed",
            completedAt: { gte: opening.measuredAt, lt: closing.measuredAt },
          },
          select: { id: true, volumeGallons: true },
          take: 10_001,
        }),
      ]);
      if (deliveries.length > 10_000 || transactions.length > 10_000) {
        throw new Error(
          "Fuel reconciliation exceeds 10,000 records; use a shorter period",
        );
      }
      const totals = calculateFuelVariance({
        openingGallons: opening.volumeGallons.toString(),
        deliveryGallons: deliveries.map((delivery) =>
          delivery.netVolumeGallons.toString(),
        ),
        dispensedGallons: transactions.map((transaction) =>
          transaction.volumeGallons.toString(),
        ),
        closingGallons: closing.volumeGallons.toString(),
      });
      if (compareQuantities(totals.expectedClosingGallons, "0") < 0) {
        throw new Error(
          "Fuel source data produces a negative expected closing balance",
        );
      }

      const lookupKey = `${args.input.tankId}:${opening.id}:${closing.id}`;
      const existing = await transaction.fuelReconciliation.findUnique({
        where: { lookupKey },
      });
      if (existing) {
        evaluateTransition(
          FUEL_RECONCILIATION_TRANSITIONS,
          existing.status,
          "in_review",
        );
      }
      const overlap = await transaction.fuelReconciliation.findFirst({
        where: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          tankId: args.input.tankId,
          ...(existing ? { id: { not: existing.id } } : {}),
          status: { in: ["in_review", "approved", "locked"] },
          periodStartedAt: { lt: periodEndedAt },
          periodEndedAt: { gt: periodStartedAt },
        },
        select: { id: true },
      });
      if (overlap)
        throw new Error(
          "Fuel reconciliation period overlaps an existing reconciliation",
        );
      const now = new Date();
      const data = {
        status: "in_review" as const,
        periodStartedAt,
        periodEndedAt,
        openingReadingId: opening.id,
        closingReadingId: closing.id,
        openingGallons: totals.openingGallons,
        deliveredGallons: totals.deliveredGallons,
        dispensedGallons: totals.dispensedGallons,
        expectedClosingGallons: totals.expectedClosingGallons,
        measuredClosingGallons: totals.measuredClosingGallons,
        varianceGallons: totals.varianceGallons,
        toleranceGallons: tolerance,
        generatedAt: now,
        generatedById: employee.id,
        approvedAt: null,
        approvedById: null,
        notes: args.input.notes?.trim() || "",
        idempotencyId,
        metadata: {
          calculationVersion: 1,
          deliveryCount: deliveries.length,
          transactionCount: transactions.length,
          sourceSetDigest: sourceSetDigest({
            deliveries: deliveries.map((delivery) => delivery.id),
            transactions: transactions.map((transaction) => transaction.id),
          }),
        },
      };
      const reconciliation = existing
        ? await transaction.fuelReconciliation.update({
            where: { id: existing.id },
            data,
          })
        : await transaction.fuelReconciliation.create({
            data: {
              businessId: args.input.businessId,
              storeId: args.input.storeId,
              siteId: args.input.siteId,
              tankId: args.input.tankId,
              reconciliationNumber: `FREC-${randomUUID()}`,
              lookupKey,
              ...data,
            },
          });
      return {
        id: reconciliation.id,
        status: reconciliation.status,
        reference: reconciliation.reconciliationNumber,
      };
    },
  });
}

export async function approveFuelReconciliation(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      reconciliationId: string;
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
    permission: "canManageFuel",
    scope: "approveFuelReconciliation",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "FuelReconciliation",
    action: "fuel.reconciliation.approve",
    execute: async (transaction) => {
      const reconciliation = await transaction.fuelReconciliation.findFirst({
        where: {
          id: args.input.reconciliationId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
      });
      if (!reconciliation) throw new Error("Fuel reconciliation not found");
      const nextStatus = args.input.lock ? "locked" : "approved";
      const transition = evaluateTransition(
        FUEL_RECONCILIATION_TRANSITIONS,
        reconciliation.status,
        nextStatus,
      );
      if (transition.replay) {
        return {
          id: reconciliation.id,
          status: reconciliation.status,
          reference: reconciliation.reconciliationNumber,
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
      await assertSettlementDoesNotOverlapLockedDay(transaction, {
        businessId: args.input.businessId,
        storeId: args.input.storeId,
        periodStartedAt: reconciliation.periodStartedAt,
        periodEndedAt: reconciliation.periodEndedAt,
        label: "Fuel reconciliation approval",
      });
      if (
        !reconciliation.siteId ||
        !reconciliation.tankId ||
        !reconciliation.openingReadingId ||
        !reconciliation.closingReadingId
      ) {
        throw new Error("Fuel reconciliation source references are incomplete");
      }
      const [opening, closing, deliveries, transactions] = await Promise.all([
        transaction.fuelTankReading.findFirst({
          where: {
            id: reconciliation.openingReadingId,
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            siteId: reconciliation.siteId,
            tankId: reconciliation.tankId,
          },
        }),
        transaction.fuelTankReading.findFirst({
          where: {
            id: reconciliation.closingReadingId,
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            siteId: reconciliation.siteId,
            tankId: reconciliation.tankId,
          },
        }),
        transaction.fuelDelivery.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            siteId: reconciliation.siteId,
            tankId: reconciliation.tankId,
            status: "reconciled",
            deliveredAt: {
              gte: reconciliation.periodStartedAt,
              lt: reconciliation.periodEndedAt,
            },
          },
          select: { id: true, netVolumeGallons: true },
          take: 10_001,
        }),
        transaction.fuelTransaction.findMany({
          where: {
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            siteId: reconciliation.siteId,
            nozzle: { tankId: reconciliation.tankId },
            status: "completed",
            completedAt: {
              gte: reconciliation.periodStartedAt,
              lt: reconciliation.periodEndedAt,
            },
          },
          select: { id: true, volumeGallons: true },
          take: 10_001,
        }),
      ]);
      if (
        !opening ||
        !closing ||
        deliveries.length > 10_000 ||
        transactions.length > 10_000
      ) {
        throw new Error(
          "Fuel reconciliation source changed or exceeds the 10,000-record bound",
        );
      }
      const currentTotals = calculateFuelVariance({
        openingGallons: opening.volumeGallons.toString(),
        deliveryGallons: deliveries.map((delivery) =>
          delivery.netVolumeGallons.toString(),
        ),
        dispensedGallons: transactions.map((fuelTransaction) =>
          fuelTransaction.volumeGallons.toString(),
        ),
        closingGallons: closing.volumeGallons.toString(),
      });
      const quantityChanged = [
        [
          currentTotals.openingGallons,
          reconciliation.openingGallons.toString(),
        ],
        [
          currentTotals.deliveredGallons,
          reconciliation.deliveredGallons.toString(),
        ],
        [
          currentTotals.dispensedGallons,
          reconciliation.dispensedGallons.toString(),
        ],
        [
          currentTotals.expectedClosingGallons,
          reconciliation.expectedClosingGallons.toString(),
        ],
        [
          currentTotals.measuredClosingGallons,
          reconciliation.measuredClosingGallons.toString(),
        ],
        [
          currentTotals.varianceGallons,
          reconciliation.varianceGallons.toString(),
        ],
      ].some(
        ([current, generated]) => compareQuantities(current, generated) !== 0,
      );
      if (
        opening.measuredAt.getTime() !==
          reconciliation.periodStartedAt.getTime() ||
        closing.measuredAt.getTime() !==
          reconciliation.periodEndedAt.getTime() ||
        quantityChanged ||
        metadataSourceSetDigest(reconciliation.metadata) !==
          sourceSetDigest({
            deliveries: deliveries.map((delivery) => delivery.id),
            transactions: transactions.map(
              (fuelTransaction) => fuelTransaction.id,
            ),
          })
      ) {
        throw new Error(
          "Fuel reconciliation source changed after generation; regenerate before approval",
        );
      }
      const outsideTolerance =
        (quantityToScaledInteger(reconciliation.varianceGallons.toString()) < 0n
          ? -quantityToScaledInteger(reconciliation.varianceGallons.toString())
          : quantityToScaledInteger(
              reconciliation.varianceGallons.toString(),
            )) >
        quantityToScaledInteger(reconciliation.toleranceGallons.toString());
      if (
        outsideTolerance &&
        !args.input.notes?.trim() &&
        !reconciliation.notes?.trim()
      ) {
        throw new Error(
          "Out-of-tolerance fuel variance requires an approval note",
        );
      }
      const updated = await transaction.fuelReconciliation.update({
        where: { id: reconciliation.id },
        data: {
          status: nextStatus,
          approvedAt: new Date(),
          approvedById: employee.id,
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

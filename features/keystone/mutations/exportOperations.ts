import { createHash, randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import type { Context } from ".keystone/types";

import { assertStorePermission, type Session } from "../access";
import {
  assertNoInlineSecrets,
  assertOpaqueSecretReference,
} from "../lib/secretPolicy";
import { requireSession, runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

function csvCell(value: string | number): string {
  // Merchant-controlled labels are data, never spreadsheet formulas.
  const source =
    typeof value === "string" && /^[\t ]*[=+\-@]/.test(value)
      ? `'${value}`
      : value;
  const text = String(source);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function parseTimestamp(value: string, label: string): Date {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()))
    throw new Error(`${label} must be a valid ISO timestamp`);
  return parsed;
}

const exportSourceDimensions = [
  "merchandise",
  "tax",
  "tender",
  "fuel",
  "lottery",
  "money_service",
] as const;

type ExportSourceDay = {
  id: string;
  storeId: string | null;
  tradingDate: string;
  status: string;
  periodStartedAt: Date;
  periodEndedAt: Date;
  cashTenderCents: number;
  nonCashTenderCents: number;
  netReceiptsCents: number;
  taxCents: number;
  fuelSalesCents: number;
  store: { code: string } | null;
  lines: Array<{
    id: string;
    storeId: string | null;
    storeDayId: string | null;
    lineNumber: number;
    dimension: string;
    dimensionKey: string;
    label: string;
    grossCents: number;
    discountCents: number;
    taxCents: number;
    netCents: number;
    expectedCents: number;
    actualCents: number;
    varianceCents: number;
    quantity: { toString(): string };
    sourceCount: number;
    metadata: Prisma.JsonValue;
  }>;
};

function exportStoreDaySourceDigest(days: ExportSourceDay[]): string {
  const canonical = [...days]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((day) => ({
      id: day.id,
      storeId: day.storeId,
      storeCode: day.store?.code ?? null,
      tradingDate: day.tradingDate,
      status: day.status,
      periodStartedAt: day.periodStartedAt.toISOString(),
      periodEndedAt: day.periodEndedAt.toISOString(),
      cashTenderCents: day.cashTenderCents,
      nonCashTenderCents: day.nonCashTenderCents,
      netReceiptsCents: day.netReceiptsCents,
      taxCents: day.taxCents,
      fuelSalesCents: day.fuelSalesCents,
      lines: [...day.lines]
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((line) => ({
          id: line.id,
          storeId: line.storeId,
          storeDayId: line.storeDayId,
          lineNumber: line.lineNumber,
          dimension: line.dimension,
          dimensionKey: line.dimensionKey,
          label: line.label,
          grossCents: line.grossCents,
          discountCents: line.discountCents,
          taxCents: line.taxCents,
          netCents: line.netCents,
          expectedCents: line.expectedCents,
          actualCents: line.actualCents,
          varianceCents: line.varianceCents,
          quantity: line.quantity.toString(),
          sourceCount: line.sourceCount,
          cogsCents:
            line.metadata &&
            typeof line.metadata === "object" &&
            !Array.isArray(line.metadata) &&
            typeof (line.metadata as Record<string, unknown>).cogsCents ===
              "number"
              ? (line.metadata as Record<string, unknown>).cogsCents
              : 0,
        })),
    }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

function metadataStoreDaySourceDigest(metadata: Record<string, unknown>) {
  const digest = metadata.storeDaySourceDigest;
  return typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest)
    ? digest
    : null;
}

export function assertCompleteStoreDayCoverage(
  days: Array<{
    id: string;
    storeId: string | null;
    periodStartedAt: Date;
    periodEndedAt: Date;
  }>,
  storeIds: string[],
  periodStartedAt: Date,
  periodEndedAt: Date,
): void {
  for (const storeId of storeIds) {
    const storeDays = days
      .filter((day) => day.storeId === storeId)
      .sort(
        (left, right) =>
          left.periodStartedAt.getTime() - right.periodStartedAt.getTime(),
      );
    let expectedStart = periodStartedAt.getTime();
    for (const day of storeDays) {
      if (
        day.periodStartedAt.getTime() !== expectedStart ||
        day.periodEndedAt <= day.periodStartedAt ||
        day.periodEndedAt > periodEndedAt
      ) {
        throw new Error(
          "Accounting export requires continuous locked StoreDay coverage for every selected store",
        );
      }
      expectedStart = day.periodEndedAt.getTime();
    }
    if (!storeDays.length || expectedStart !== periodEndedAt.getTime()) {
      throw new Error(
        "Accounting export requires continuous locked StoreDay coverage for every selected store",
      );
    }
  }
}

export async function configureExportDestination(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      name: string;
      code: string;
      type: "accounting" | "provider" | "data_warehouse";
      adapterKey: string;
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
    throw new Error(
      "Export destination name, slug code, and adapter key are required",
    );
  }
  if (!storeIds.length)
    throw new Error("At least one export store is required");
  assertNoInlineSecrets(args.input.configuration ?? {});
  assertOpaqueSecretReference(args.input.credentialReference);
  const session = requireSession(context) as Session;
  for (const storeId of storeIds)
    assertStorePermission(
      session,
      args.input.businessId,
      storeId,
      "canManageExports",
    );

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageExports",
    scope: "configureExportDestination",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, name, code, adapterKey, storeIds },
    resourceType: "ExportDestination",
    action: "export.destination.configure",
    execute: async (transaction, idempotencyId) => {
      const matchedStores = await transaction.store.count({
        where: {
          businessId: args.input.businessId,
          id: { in: storeIds },
          status: "active",
        },
      });
      if (matchedStores !== storeIds.length)
        throw new Error("One or more export stores are invalid");
      const lookupKey = `${args.input.businessId}:${code}`;
      const existing = await transaction.exportDestination.findUnique({
        where: { lookupKey },
      });
      const data = {
        name,
        code,
        type: args.input.type,
        status: "active" as const,
        adapterKey,
        credentialReference: args.input.credentialReference?.trim() || "",
        configuration: (args.input.configuration ??
          {}) as Prisma.InputJsonValue,
        metadata: { idempotencyId },
      };
      const destination = existing
        ? await transaction.exportDestination.update({
            where: { id: existing.id },
            data: { ...data, stores: { set: storeIds.map((id) => ({ id })) } },
          })
        : await transaction.exportDestination.create({
            data: {
              businessId: args.input.businessId,
              lookupKey,
              ...data,
              stores: { connect: storeIds.map((id) => ({ id })) },
            },
          });
      return {
        id: destination.id,
        status: destination.status,
        reference: destination.code,
      };
    },
  });
}

export async function generateDailyAccountingExport(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      destinationId: string;
      employeeId: string;
      storeIds: string[];
      periodStartedAt: string;
      periodEndedAt: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const storeIds = [...new Set(args.input.storeIds.filter(Boolean))].sort();
  if (!storeIds.length || storeIds.length > 100)
    throw new Error("Export requires 1-100 stores");
  const periodStartedAt = parseTimestamp(
    args.input.periodStartedAt,
    "Export period start",
  );
  const periodEndedAt = parseTimestamp(
    args.input.periodEndedAt,
    "Export period end",
  );
  if (
    periodEndedAt <= periodStartedAt ||
    periodEndedAt.getTime() - periodStartedAt.getTime() > 366 * 86_400_000
  ) {
    throw new Error(
      "Accounting export period must be positive and no longer than 366 days",
    );
  }
  const session = requireSession(context) as Session;
  for (const storeId of storeIds)
    assertStorePermission(
      session,
      args.input.businessId,
      storeId,
      "canManageExports",
    );

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageExports",
    scope: "generateDailyAccountingExport",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, storeIds, periodStartedAt, periodEndedAt },
    resourceType: "ExportBatch",
    action: "export.accounting.generate",
    execute: async (transaction, idempotencyId) => {
      const destination = await transaction.exportDestination.findFirst({
        where: {
          id: args.input.destinationId,
          businessId: args.input.businessId,
          type: "accounting",
          status: "active",
        },
        include: { stores: { select: { id: true } } },
      });
      if (
        !destination ||
        !storeIds.every((storeId) =>
          destination.stores.some((store) => store.id === storeId),
        )
      ) {
        throw new Error(
          "Active accounting destination not found for the selected stores",
        );
      }
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          AND: storeIds.map((id) => ({ stores: { some: { id } } })),
        },
      });
      if (!employee)
        throw new Error("Exporting employee is not active for this business");
      const stores = await transaction.store.findMany({
        where: { businessId: args.input.businessId, id: { in: storeIds } },
        select: { id: true, code: true, currencyCode: true },
      });
      if (stores.length !== storeIds.length)
        throw new Error(
          "One or more export stores do not belong to this business",
        );
      const currencies = new Set(stores.map((store) => store.currencyCode));
      if (currencies.size !== 1)
        throw new Error("One accounting batch cannot mix store currencies");
      const overlappingBatches = await transaction.exportBatch.findMany({
        where: {
          businessId: args.input.businessId,
          destinationId: destination.id,
          type: "daily_sales",
          status: { in: ["ready", "delivering", "delivered"] },
          periodStartedAt: { lt: periodEndedAt },
          periodEndedAt: { gt: periodStartedAt },
        },
        select: { id: true, metadata: true },
        take: 1_001,
      });
      if (overlappingBatches.length > 1_000)
        throw new Error(
          "Accounting export overlap check exceeds 1,000 active batches",
        );
      const overlapsSource = overlappingBatches.some((batch) => {
        const metadata =
          batch.metadata &&
          typeof batch.metadata === "object" &&
          !Array.isArray(batch.metadata)
            ? (batch.metadata as Record<string, unknown>)
            : {};
        const priorStores = Array.isArray(metadata.storeIds)
          ? metadata.storeIds.filter(
              (id): id is string => typeof id === "string",
            )
          : [];
        return priorStores.some((id) => storeIds.includes(id));
      });
      if (overlapsSource)
        throw new Error(
          "An active accounting batch already covers part of this destination, store, and period scope",
        );

      const days = await transaction.storeDay.findMany({
        where: {
          businessId: args.input.businessId,
          storeId: { in: storeIds },
          periodStartedAt: { lt: periodEndedAt },
          periodEndedAt: { gt: periodStartedAt },
          status: "locked",
        },
        include: {
          store: { select: { code: true } },
          lines: {
            where: {
              dimension: { in: [...exportSourceDimensions] },
            },
            orderBy: { lineNumber: "asc" },
          },
        },
        orderBy: [{ tradingDate: "asc" }, { storeId: "asc" }],
        take: 10_001,
      });
      if (!days.length)
        throw new Error("No reconciled store days exist in the export period");
      if (days.length > 10_000)
        throw new Error("Accounting export exceeds 10,000 store days");
      if (
        days.some(
          (day) =>
            day.periodStartedAt < periodStartedAt ||
            day.periodEndedAt > periodEndedAt,
        )
      ) {
        throw new Error(
          "Accounting export boundaries must contain complete locked store-day periods",
        );
      }
      assertCompleteStoreDayCoverage(
        days,
        storeIds,
        periodStartedAt,
        periodEndedAt,
      );

      const lines: Array<{
        storeId: string;
        accountCode: string;
        description: string;
        debitCents: number;
        creditCents: number;
        sourceId: string;
        occurredAt: Date;
        dimensions: Prisma.InputJsonValue;
      }> = [];
      for (const day of days) {
        if (!day.storeId || !day.store)
          throw new Error("Store day is missing its store");
        const clearing = day.cashTenderCents + day.nonCashTenderCents;
        if (
          !Number.isSafeInteger(clearing) ||
          clearing !== day.netReceiptsCents
        ) {
          throw new Error(
            `Store day ${day.tradingDate} is not tender-balanced and cannot export`,
          );
        }
        const dimensions = {
          tradingDate: day.tradingDate,
          storeCode: day.store.code,
          taxCents: day.taxCents,
          fuelSalesCents: day.fuelSalesCents,
          sourceStatus: day.status,
        } as Prisma.InputJsonValue;
        const appendSignedLine = (
          accountCode: string,
          description: string,
          signedCents: number,
          normalSide: "debit" | "credit",
        ) => {
          if (signedCents === 0) return;
          const normal = signedCents > 0;
          const amount = Math.abs(signedCents);
          lines.push({
            storeId: day.storeId!,
            accountCode,
            description,
            debitCents: (normalSide === "debit") === normal ? amount : 0,
            creditCents: (normalSide === "credit") === normal ? amount : 0,
            sourceId: day.id,
            occurredAt: day.periodEndedAt,
            dimensions,
          });
        };
        appendSignedLine(
          "cash_clearing",
          `${day.store.code} ${day.tradingDate} cash receipts`,
          day.cashTenderCents,
          "debit",
        );
        appendSignedLine(
          "noncash_clearing",
          `${day.store.code} ${day.tradingDate} non-cash receipts`,
          day.nonCashTenderCents,
          "debit",
        );
        appendSignedLine(
          "retail_receipts",
          `${day.store.code} ${day.tradingDate} net receipts`,
          day.netReceiptsCents,
          "credit",
        );
      }
      const debitTotalCents = lines.reduce(
        (sum, line) => sum + line.debitCents,
        0,
      );
      const creditTotalCents = lines.reduce(
        (sum, line) => sum + line.creditCents,
        0,
      );
      if (
        !Number.isSafeInteger(debitTotalCents) ||
        debitTotalCents !== creditTotalCents
      ) {
        throw new Error(
          "Accounting export must balance before it can become ready",
        );
      }
      const detailRows = days.flatMap((day) =>
        day.lines.map((line) => {
          const metadata =
            line.metadata &&
            typeof line.metadata === "object" &&
            !Array.isArray(line.metadata)
              ? (line.metadata as Record<string, unknown>)
              : {};
          return [
            "source_detail",
            line.lineNumber,
            line.storeId ?? "",
            line.dimension,
            line.label,
            line.grossCents,
            line.discountCents,
            line.netCents,
            line.storeDayId ?? "",
            day.periodEndedAt.toISOString(),
            line.quantity.toString(),
            typeof metadata.cogsCents === "number" ? metadata.cogsCents : 0,
            line.taxCents,
          ];
        }),
      );
      const artifactRows = [
        [
          "record_type",
          "line_number",
          "store_id",
          "account_or_dimension",
          "description",
          "debit_or_gross_cents",
          "discount_cents",
          "credit_or_net_cents",
          "source_id",
          "occurred_at",
          "quantity",
          "cogs_cents",
          "tax_cents",
        ],
        ...lines.map((line, index) => [
          "accounting",
          index + 1,
          line.storeId,
          line.accountCode,
          line.description,
          line.debitCents,
          0,
          line.creditCents,
          line.sourceId,
          line.occurredAt.toISOString(),
          "0.0000",
          0,
          0,
        ]),
        ...detailRows,
      ];
      const artifactContent = `${artifactRows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
      const artifactSizeBytes = Buffer.byteLength(artifactContent, "utf8");
      if (artifactSizeBytes > 5 * 1024 * 1024)
        throw new Error("Accounting export artifact exceeds 5 MiB");
      const checksum = createHash("sha256")
        .update(artifactContent)
        .digest("hex");
      const artifactFilename = `daily-sales-${periodStartedAt.toISOString().slice(0, 10)}-${checksum.slice(0, 12)}.csv`;
      const batch = await transaction.exportBatch.create({
        data: {
          businessId: args.input.businessId,
          storeId: storeIds.length === 1 ? storeIds[0] : null,
          destinationId: destination.id,
          batchNumber: `EXPB-${randomUUID()}`,
          type: "daily_sales",
          status: "ready",
          periodStartedAt,
          periodEndedAt,
          currencyCode: stores[0]?.currencyCode ?? "USD",
          rowCount: lines.length,
          debitTotalCents,
          creditTotalCents,
          checksum,
          artifactFilename,
          artifactSizeBytes,
          artifactContent,
          objectReference: `database://ExportBatch/${checksum}`,
          generatedAt: new Date(),
          generatedById: employee.id,
          idempotencyId,
          metadata: {
            storeIds,
            storeDayCount: days.length,
            storeDayIds: days.map((day) => day.id).sort(),
            storeDaySourceDigest: exportStoreDaySourceDigest(days),
            detailRowCount: detailRows.length,
            mappingVersion: 3,
            regulatedDimensionsAreSourceDetailOnly: true,
          },
        },
      });
      for (const [index, line] of lines.entries()) {
        await transaction.exportLine.create({
          data: {
            businessId: args.input.businessId,
            storeId: line.storeId,
            batchId: batch.id,
            lineNumber: index + 1,
            accountCode: line.accountCode,
            description: line.description,
            debitCents: line.debitCents,
            creditCents: line.creditCents,
            sourceType: "StoreDay",
            sourceId: line.sourceId,
            occurredAt: line.occurredAt,
            dimensions: line.dimensions,
          },
        });
      }
      return {
        id: batch.id,
        status: batch.status,
        reference: batch.batchNumber,
      };
    },
  });
}

export async function downloadExportArtifact(
  _root: unknown,
  args: { input: { businessId: string; batchId: string } },
  context: Context,
) {
  const session = requireSession(context) as Session;
  const batch = await context.prisma.exportBatch.findFirst({
    where: { id: args.input.batchId, businessId: args.input.businessId },
  });
  if (!batch) throw new Error("Export batch not found");
  const metadata =
    batch.metadata &&
    typeof batch.metadata === "object" &&
    !Array.isArray(batch.metadata)
      ? (batch.metadata as Record<string, unknown>)
      : {};
  const storeIds = Array.isArray(metadata.storeIds)
    ? metadata.storeIds.filter((id): id is string => typeof id === "string")
    : batch.storeId
      ? [batch.storeId]
      : [];
  if (!storeIds.length)
    throw new Error("Export artifact has no authorized store scope");
  for (const storeId of storeIds)
    assertStorePermission(
      session,
      args.input.businessId,
      storeId,
      "canReadExports",
    );
  if (batch.type === "daily_sales") {
    const sourceIds = Array.isArray(metadata.storeDayIds)
      ? [
          ...new Set(
            metadata.storeDayIds.filter(
              (id): id is string => typeof id === "string" && Boolean(id),
            ),
          ),
        ]
      : [];
    const expectedSourceDigest = metadataStoreDaySourceDigest(metadata);
    const sourceDays = sourceIds.length
      ? await context.prisma.storeDay.findMany({
          where: {
            id: { in: sourceIds },
            businessId: args.input.businessId,
            status: "locked",
          },
          include: {
            store: { select: { code: true } },
            lines: {
              where: { dimension: { in: [...exportSourceDimensions] } },
              orderBy: { lineNumber: "asc" },
            },
          },
        })
      : [];
    if (
      !expectedSourceDigest ||
      sourceDays.length !== sourceIds.length ||
      exportStoreDaySourceDigest(sourceDays) !== expectedSourceDigest
    ) {
      throw new Error(
        "Accounting export source evidence changed; regenerate before download",
      );
    }
  }
  if (!batch.artifactContent || !batch.artifactFilename)
    throw new Error("Export artifact is not available");
  if (
    Buffer.byteLength(batch.artifactContent, "utf8") !== batch.artifactSizeBytes
  ) {
    throw new Error("Export artifact size verification failed");
  }
  const checksum = createHash("sha256")
    .update(batch.artifactContent)
    .digest("hex");
  if (checksum !== batch.checksum)
    throw new Error("Export artifact checksum verification failed");
  return {
    filename: batch.artifactFilename,
    contentType: "text/csv; charset=utf-8",
    checksum,
    content: batch.artifactContent,
  };
}

export async function transitionExportBatch(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      batchId: string;
      nextStatus: "ready" | "delivering" | "delivered" | "failed" | "cancelled";
      externalReference?: string | null;
      failureMessage?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const session = requireSession(context) as Session;
  const scopedBatch = await context.prisma.exportBatch.findFirst({
    where: { id: args.input.batchId, businessId: args.input.businessId },
    select: { storeId: true, metadata: true },
  });
  if (!scopedBatch) throw new Error("Export batch not found");
  const metadata =
    scopedBatch.metadata &&
    typeof scopedBatch.metadata === "object" &&
    !Array.isArray(scopedBatch.metadata)
      ? (scopedBatch.metadata as Record<string, unknown>)
      : {};
  const storeIds = Array.isArray(metadata.storeIds)
    ? metadata.storeIds.filter((id): id is string => typeof id === "string")
    : scopedBatch.storeId
      ? [scopedBatch.storeId]
      : [];
  for (const storeId of storeIds)
    assertStorePermission(
      session,
      args.input.businessId,
      storeId,
      "canManageExports",
    );
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageExports",
    scope: "transitionExportBatch",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "ExportBatch",
    action: "export.batch.transition",
    execute: async (transaction) => {
      const batch = await transaction.exportBatch.findFirst({
        where: { id: args.input.batchId, businessId: args.input.businessId },
      });
      if (!batch) throw new Error("Export batch not found");
      if (batch.status === args.input.nextStatus) {
        return {
          id: batch.id,
          status: batch.status,
          reference: batch.batchNumber,
        };
      }
      const allowed: Record<string, string[]> = {
        ready: ["delivering", "cancelled"],
        delivering: ["delivered", "failed"],
        failed: ["ready", "cancelled"],
        delivered: [],
        cancelled: [],
      };
      if (!allowed[batch.status]?.includes(args.input.nextStatus)) {
        throw new Error(
          `Cannot transition export from ${batch.status} to ${args.input.nextStatus}`,
        );
      }
      if (["delivering", "delivered"].includes(args.input.nextStatus)) {
        const batchMetadata =
          batch.metadata &&
          typeof batch.metadata === "object" &&
          !Array.isArray(batch.metadata)
            ? (batch.metadata as Record<string, unknown>)
            : {};
        const sourceStoreDayIds = Array.isArray(batchMetadata.storeDayIds)
          ? batchMetadata.storeDayIds.filter(
              (id): id is string => typeof id === "string" && Boolean(id),
            )
          : [];
        if (batch.type === "daily_sales") {
          const uniqueSourceIds = [...new Set(sourceStoreDayIds)];
          const expectedSourceDigest =
            metadataStoreDaySourceDigest(batchMetadata);
          const sourceDays = uniqueSourceIds.length
            ? await transaction.storeDay.findMany({
                where: {
                  id: { in: uniqueSourceIds },
                  businessId: args.input.businessId,
                  status: "locked",
                },
                include: {
                  store: { select: { code: true } },
                  lines: {
                    where: {
                      dimension: { in: [...exportSourceDimensions] },
                    },
                    orderBy: { lineNumber: "asc" },
                  },
                },
              })
            : [];
          if (
            !expectedSourceDigest ||
            sourceDays.length !== uniqueSourceIds.length ||
            exportStoreDaySourceDigest(sourceDays) !== expectedSourceDigest
          ) {
            throw new Error(
              "Accounting export delivery requires unchanged exact locked StoreDay source evidence; regenerate legacy or mutable batches",
            );
          }
        }
        if (!batch.artifactContent || !batch.artifactFilename)
          throw new Error("Export artifact is missing");
        const checksum = createHash("sha256")
          .update(batch.artifactContent)
          .digest("hex");
        if (
          checksum !== batch.checksum ||
          Buffer.byteLength(batch.artifactContent, "utf8") !==
            batch.artifactSizeBytes
        ) {
          throw new Error("Export artifact integrity check failed");
        }
      }
      if (
        args.input.nextStatus === "delivered" &&
        !args.input.externalReference?.trim()
      ) {
        throw new Error(
          "Delivered export requires an external receipt reference",
        );
      }
      if (
        args.input.nextStatus === "failed" &&
        !args.input.failureMessage?.trim()
      ) {
        throw new Error("Failed export requires a failure message");
      }
      const now = new Date();
      const updated = await transaction.exportBatch.update({
        where: { id: batch.id },
        data: {
          status: args.input.nextStatus,
          externalReference:
            args.input.externalReference?.trim() || batch.externalReference,
          deliveredAt:
            args.input.nextStatus === "delivered" ? now : batch.deliveredAt,
          failedAt:
            args.input.nextStatus === "failed"
              ? now
              : args.input.nextStatus === "ready"
                ? null
                : batch.failedAt,
          failureMessage:
            args.input.failureMessage?.trim() ||
            (args.input.nextStatus === "ready" ? "" : batch.failureMessage),
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.batchNumber,
      };
    },
  });
}

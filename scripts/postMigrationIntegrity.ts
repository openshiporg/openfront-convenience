import { createHash } from "node:crypto";

import { Prisma, PrismaClient } from "@prisma/client";

import { assertRequiredLifecycleTriggers } from "../features/keystone/lib/lifecycleTriggerIntegrity";
import { assertRelationPrimaryKeys } from "../features/keystone/lib/relationPrimaryKeys";
import { redactSensitiveValues } from "../features/keystone/lib/secretPolicy";
import { findStorefrontThemePreset } from "../features/storefront/lib/storefront-theme";

function inputJson(
  value: Prisma.JsonValue,
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

async function redactHistoricalAuditEvidence(
  prisma: PrismaClient,
): Promise<void> {
  let cursor = "";
  for (;;) {
    const events = await prisma.auditEvent.findMany({
      where: { id: { gt: cursor } },
      select: { id: true, changes: true, metadata: true },
      orderBy: { id: "asc" },
      take: 500,
    });
    for (const event of events) {
      const changes = redactSensitiveValues(event.changes) as Prisma.JsonValue;
      const metadata = redactSensitiveValues(
        event.metadata,
      ) as Prisma.JsonValue;
      if (
        JSON.stringify(changes) !== JSON.stringify(event.changes) ||
        JSON.stringify(metadata) !== JSON.stringify(event.metadata)
      ) {
        await prisma.auditEvent.update({
          where: { id: event.id },
          data: {
            changes: inputJson(changes),
            metadata: inputJson(metadata),
          },
        });
      }
    }
    if (events.length < 500) return;
    cursor = events.at(-1)!.id;
  }
}

async function backfillPromotionRevisionEvidence(
  prisma: PrismaClient,
): Promise<void> {
  let cursor = "";
  for (;;) {
    const promotions = await prisma.promotion.findMany({
      where: { id: { gt: cursor } },
      select: { id: true, updatedAt: true, metadata: true },
      orderBy: { id: "asc" },
      take: 500,
    });
    for (const promotion of promotions) {
      const metadata =
        promotion.metadata &&
        typeof promotion.metadata === "object" &&
        !Array.isArray(promotion.metadata)
          ? (promotion.metadata as Record<string, Prisma.JsonValue>)
          : {};
      if (typeof metadata.revision === "string" && metadata.revision) continue;
      const revision = `integrity-${createHash("sha256")
        .update(`${promotion.id}:${promotion.updatedAt.toISOString()}`)
        .digest("hex")}`;
      await prisma.promotion.update({
        where: { id: promotion.id },
        data: {
          metadata: { ...metadata, revision } as Prisma.InputJsonValue,
        },
      });
    }
    if (promotions.length < 500) return;
    cursor = promotions.at(-1)!.id;
  }
}

async function assertSettlementTradingDates(
  prisma: PrismaClient,
): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT (
      SELECT COUNT(*) FROM "StoreDay" AS day
      WHERE day."periodEndedAt" <= day."periodStartedAt"
        OR day."tradingDate" IS DISTINCT FROM
          to_char((day."periodStartedAt" AT TIME ZONE 'UTC') AT TIME ZONE day."timezoneSnapshot", 'YYYY-MM-DD')
        OR day."tradingDate" IS DISTINCT FROM
          to_char(((day."periodEndedAt" - interval '1 millisecond') AT TIME ZONE 'UTC') AT TIME ZONE day."timezoneSnapshot", 'YYYY-MM-DD')
    ) + (
      SELECT COUNT(*) FROM "LotterySettlement" AS settlement
      JOIN "Store" AS store ON store.id = settlement.store
      WHERE settlement."tradingDate" IS DISTINCT FROM
        to_char((settlement."periodStartedAt" AT TIME ZONE 'UTC') AT TIME ZONE store.timezone, 'YYYY-MM-DD')
        OR settlement."tradingDate" IS DISTINCT FROM
        to_char(((settlement."periodEndedAt" - interval '1 millisecond') AT TIME ZONE 'UTC') AT TIME ZONE store.timezone, 'YYYY-MM-DD')
        OR (
          settlement.status IN ('approved', 'exported')
          AND NOT EXISTS (
            SELECT 1 FROM "StoreDay" AS day
            WHERE day.business = settlement.business
              AND day.store = settlement.store
              AND day."tradingDate" = settlement."tradingDate"
              AND day."periodStartedAt" = settlement."periodStartedAt"
              AND day."periodEndedAt" = settlement."periodEndedAt"
          )
        )
    ) + (
      SELECT COUNT(*) FROM "MoneyServiceSettlement" AS settlement
      JOIN "Store" AS store ON store.id = settlement.store
      WHERE settlement."tradingDate" IS DISTINCT FROM
        to_char((settlement."periodStartedAt" AT TIME ZONE 'UTC') AT TIME ZONE store.timezone, 'YYYY-MM-DD')
        OR settlement."tradingDate" IS DISTINCT FROM
        to_char(((settlement."periodEndedAt" - interval '1 millisecond') AT TIME ZONE 'UTC') AT TIME ZONE store.timezone, 'YYYY-MM-DD')
        OR (
          settlement.status IN ('approved', 'exported')
          AND NOT EXISTS (
            SELECT 1 FROM "StoreDay" AS day
            WHERE day.business = settlement.business
              AND day.store = settlement.store
              AND day."tradingDate" = settlement."tradingDate"
              AND day."periodStartedAt" = settlement."periodStartedAt"
              AND day."periodEndedAt" = settlement."periodEndedAt"
          )
        )
    ) AS count
  `;
  if ((rows[0]?.count ?? 0n) > 0n) {
    throw new Error(
      "StoreDay or settlement trading-date integrity is incomplete; owner review is required",
    );
  }
}

async function assertStoreDayDepositAccounting(
  prisma: PrismaClient,
): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    WITH posted AS (
      SELECT
        "storeDay" AS store_day_id,
        COALESCE(
          SUM("amountCents") FILTER (WHERE status IN ('deposited', 'verified')),
          0
        )::integer AS amount
      FROM "BankDeposit"
      GROUP BY "storeDay"
    )
    SELECT COUNT(*)::bigint AS count
    FROM "StoreDay" AS day
    JOIN posted ON posted.store_day_id = day.id
    WHERE day."depositedCashCents" <> posted.amount
      OR day."undepositedCashCents" <> GREATEST(
        0,
        day."countedCashCents" - day."openingCashCents" - posted.amount
      )
  `;
  if ((rows[0]?.count ?? 0n) > 0n) {
    throw new Error(
      "StoreDay deposit accounting is not normalized; run the owner-approved preflight reconciliation before migration",
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL is required for post-migration integrity checks",
    );
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async (transaction) => {
      // The legacy preflight intentionally leaves a durable User.role write
      // fence across the process boundary into Prisma migrate deploy. Once the
      // reviewed migration has removed that column, retire the now-no-op fence.
      await transaction.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS "openfront_block_legacy_user_role_write" ON "User"',
      );
      await transaction.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS "openfront_block_legacy_role_write" ON "Role"',
      );
      await transaction.$executeRawUnsafe(
        "DROP FUNCTION IF EXISTS openfront_legacy_archive.block_legacy_write()",
      );
    });

    await assertRequiredLifecycleTriggers(prisma);
    await assertRelationPrimaryKeys(prisma);
    await redactHistoricalAuditEvidence(prisma);
    await backfillPromotionRevisionEvidence(prisma);
    await assertSettlementTradingDates(prisma);
    await assertStoreDayDepositAccounting(prisma);

    const [storefrontColumn] = await prisma.$queryRaw<
      Array<{ exists: boolean }>
    >`
      SELECT (
        SELECT count(*) = 3
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Business'
          AND column_name IN (
            'storefrontStatus',
            'storefrontMode',
            'storefrontStore'
          )
      ) AS "exists"
    `;
    if (storefrontColumn?.exists) {
      const [publicationIndex] = await prisma.$queryRaw<
        Array<{ exists: boolean }>
      >`
        SELECT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = 'Business_single_published_storefront_key'
        ) AS "exists"
      `;
      if (!publicationIndex?.exists) {
        throw new Error("Published storefront uniqueness index is missing");
      }
      const publishedStorefronts = await prisma.business.findMany({
        where: { storefrontStatus: "published" },
        select: {
          brandName: true,
          brandMark: true,
          brandPrimaryColor: true,
          brandAccentColor: true,
          storefrontMode: true,
          storefrontStoreId: true,
        },
        take: 2,
      });
      if (publishedStorefronts.length > 1) {
        throw new Error("Only one business may own the published storefront");
      }
      const invalidPublishedStorefront = publishedStorefronts.some(
        (storefront) =>
          !storefront.brandName.trim() ||
          !storefront.storefrontStoreId ||
          !(["demo", "live"] as const).includes(storefront.storefrontMode) ||
          !/^[A-Z0-9]{1,4}$/.test(storefront.brandMark) ||
          !findStorefrontThemePreset(
            storefront.brandPrimaryColor,
            storefront.brandAccentColor,
          ),
      );
      if (invalidPublishedStorefront) {
        throw new Error(
          "Published storefront settings are incomplete or invalid",
        );
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Post-migration integrity check failed",
  );
  process.exitCode = 1;
});

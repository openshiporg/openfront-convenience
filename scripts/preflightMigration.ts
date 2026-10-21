import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";

const LEGACY_TABLES = [
  "Todo",
  "TodoImage",
  "_Todo_todoImages",
  "Role",
] as const;
type LegacyTable = (typeof LEGACY_TABLES)[number];
type Database = PrismaClient | Prisma.TransactionClient;

async function tableExists(prisma: Database, table: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
    `SELECT to_regclass('"${table}"') IS NOT NULL AS present`,
  );
  return Boolean(rows[0]?.present);
}

async function columnExists(
  prisma: Database,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ present: boolean }>>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = ${table} AND column_name = ${column}
    ) AS present
  `;
  return Boolean(rows[0]?.present);
}

async function tableCount(prisma: Database, table: string): Promise<bigint> {
  if (!(await tableExists(prisma, table))) return 0n;
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM "${table}"`,
  );
  return rows[0]?.count ?? 0n;
}

async function archiveLegacyTable(
  prisma: Database,
  table: LegacyTable,
): Promise<void> {
  const keyExpression =
    table === "_Todo_todoImages"
      ? "md5(to_jsonb(source_row)::text)"
      : "source_row.id::text";
  await prisma.$executeRawUnsafe(`
    INSERT INTO openfront_legacy_archive.records (source_table, source_key, payload)
    SELECT '${table}', ${keyExpression}, to_jsonb(source_row)
    FROM "${table}" AS source_row
    ON CONFLICT (source_table, source_key) DO UPDATE SET payload = EXCLUDED.payload
  `);
  const sourceCount = await tableCount(prisma, table);
  const archived = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM openfront_legacy_archive.records WHERE source_table = '${table}'`,
  );
  if ((archived[0]?.count ?? 0n) < sourceCount)
    throw new Error(`Legacy ${table} archive row count did not verify`);
}

async function archiveRoleAssignments(
  prisma: Database,
  roleBearingUsers: bigint,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    INSERT INTO openfront_legacy_archive.records (source_table, source_key, payload)
    SELECT 'User.role', source_row.id::text,
           jsonb_build_object('id', source_row.id, 'role', source_row.role)
    FROM "User" AS source_row
    WHERE source_row.role IS NOT NULL
    ON CONFLICT (source_table, source_key) DO UPDATE SET payload = EXCLUDED.payload
  `);
  const archived = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM openfront_legacy_archive.records WHERE source_table = 'User.role'`,
  );
  if ((archived[0]?.count ?? 0n) < roleBearingUsers)
    throw new Error("Legacy User.role archive row count did not verify");
}

async function installLegacyWriteFence(
  prisma: Database,
  legacyTables: LegacyTable[],
  hasUserRole: boolean,
): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION openfront_legacy_archive.block_legacy_write()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF TG_TABLE_NAME = 'User' THEN
        IF TG_OP = 'INSERT' AND (to_jsonb(NEW) ->> 'role') IS NOT NULL THEN
          RAISE EXCEPTION 'legacy User.role writes are fenced for the reviewed migration';
        ELSIF TG_OP = 'UPDATE' AND (to_jsonb(NEW) -> 'role') IS DISTINCT FROM (to_jsonb(OLD) -> 'role') THEN
          RAISE EXCEPTION 'legacy User.role writes are fenced for the reviewed migration';
        ELSIF TG_OP = 'DELETE' AND (to_jsonb(OLD) ->> 'role') IS NOT NULL THEN
          RAISE EXCEPTION 'legacy User.role writes are fenced for the reviewed migration';
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'legacy table % is fenced for the reviewed migration', TG_TABLE_NAME;
    END
    $$
  `);
  for (const table of legacyTables) {
    const triggerName = `openfront_block_legacy_${table.replaceAll("_", "").toLowerCase()}_write`;
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS "${triggerName}" ON "${table}"`,
    );
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${triggerName}"
      BEFORE INSERT OR UPDATE OR DELETE ON "${table}"
      FOR EACH ROW EXECUTE FUNCTION openfront_legacy_archive.block_legacy_write()
    `);
  }
  if (hasUserRole) {
    await prisma.$executeRawUnsafe(
      'DROP TRIGGER IF EXISTS "openfront_block_legacy_user_role_write" ON "User"',
    );
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "openfront_block_legacy_user_role_write"
      BEFORE INSERT OR UPDATE OR DELETE ON "User"
      FOR EACH ROW EXECUTE FUNCTION openfront_legacy_archive.block_legacy_write()
    `);
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function priorUnwrappedMigration(sql: string): string | null {
  const prefix = "BEGIN;\n\n";
  const suffix = "\nCOMMIT;\n";
  return sql.startsWith(prefix) && sql.endsWith(suffix)
    ? sql.slice(prefix.length, -suffix.length)
    : null;
}

async function reconcileAtomicMigrationChecksums(
  prisma: PrismaClient,
): Promise<void> {
  if (!(await tableExists(prisma, "_prisma_migrations"))) return;
  const unresolved = await prisma.$queryRaw<Array<{ migration_name: string }>>`
    SELECT migration_name
    FROM "_prisma_migrations"
    WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ORDER BY started_at
  `;
  if (unresolved.length) {
    throw new Error(
      "An unfinished migration requires owner-reviewed recovery before deployment",
    );
  }
  const applied = await prisma.$queryRaw<
    Array<{ migration_name: string; checksum: string }>
  >`
    SELECT migration_name, checksum
    FROM "_prisma_migrations"
    WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ORDER BY migration_name
  `;
  const updates: Array<{
    migrationName: string;
    priorChecksum: string;
    atomicChecksum: string;
  }> = [];
  for (const row of applied) {
    if (!/^[0-9]{14}_[a-z0-9_]+$/.test(row.migration_name)) {
      throw new Error("Applied migration history contains an invalid name");
    }
    let sql: string;
    try {
      sql = await readFile(
        path.join(
          process.cwd(),
          "migrations",
          row.migration_name,
          "migration.sql",
        ),
        "utf8",
      );
    } catch {
      throw new Error(
        `Applied migration ${row.migration_name} is missing from source`,
      );
    }
    const atomicChecksum = sha256(sql);
    if (atomicChecksum === row.checksum) continue;
    const priorSql = priorUnwrappedMigration(sql);
    if (!priorSql || sha256(priorSql) !== row.checksum) {
      throw new Error(
        `Applied migration ${row.migration_name} changed by more than the reviewed atomic transaction wrapper`,
      );
    }
    updates.push({
      migrationName: row.migration_name,
      priorChecksum: row.checksum,
      atomicChecksum,
    });
  }
  if (!updates.length) return;
  if (process.env.ALLOW_ATOMIC_MIGRATION_CHECKSUM_RECONCILIATION !== "true") {
    throw new Error(
      "Applied migrations need one-time owner-approved atomic-wrapper checksum reconciliation; verify a backup, inspect that only BEGIN/COMMIT changed, then set ALLOW_ATOMIC_MIGRATION_CHECKSUM_RECONCILIATION=true for this migration run",
    );
  }
  await prisma.$transaction(
    async (transaction) => {
      for (const update of updates) {
        const changed = await transaction.$executeRaw`
          UPDATE "_prisma_migrations"
          SET checksum = ${update.atomicChecksum}
          WHERE migration_name = ${update.migrationName}
            AND checksum = ${update.priorChecksum}
            AND finished_at IS NOT NULL
            AND rolled_back_at IS NULL
        `;
        if (changed !== 1) {
          throw new Error(
            `Atomic-wrapper checksum lease changed for ${update.migrationName}`,
          );
        }
      }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  console.log(
    `Reconciled reviewed transaction-only checksums for ${updates.length} applied migration(s)`,
  );
}

async function assertSettlementTradingDateReadiness(
  prisma: PrismaClient,
): Promise<void> {
  if (!(await tableExists(prisma, "Store"))) return;
  const checks: Array<Promise<Array<{ count: bigint }>>> = [];
  if (
    (await tableExists(prisma, "StoreDay")) &&
    (await columnExists(prisma, "StoreDay", "periodStartedAt"))
  ) {
    checks.push(
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "StoreDay" AS day
        WHERE day."periodEndedAt" <= day."periodStartedAt"
          OR day."tradingDate" IS DISTINCT FROM
            to_char(day."periodStartedAt" AT TIME ZONE day."timezoneSnapshot", 'YYYY-MM-DD')
          OR day."tradingDate" IS DISTINCT FROM
            to_char((day."periodEndedAt" - interval '1 millisecond') AT TIME ZONE day."timezoneSnapshot", 'YYYY-MM-DD')
      `,
    );
  }
  if (
    (await tableExists(prisma, "LotterySettlement")) &&
    (await columnExists(prisma, "LotterySettlement", "periodStartedAt"))
  ) {
    checks.push(
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "LotterySettlement" AS settlement
        JOIN "Store" AS store ON store.id = settlement.store
        WHERE settlement."tradingDate" IS DISTINCT FROM
          to_char(settlement."periodStartedAt" AT TIME ZONE store.timezone, 'YYYY-MM-DD')
          OR settlement."tradingDate" IS DISTINCT FROM
          to_char((settlement."periodEndedAt" - interval '1 millisecond') AT TIME ZONE store.timezone, 'YYYY-MM-DD')
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
      `,
    );
  }
  if (
    (await tableExists(prisma, "MoneyServiceSettlement")) &&
    (await columnExists(prisma, "MoneyServiceSettlement", "periodStartedAt"))
  ) {
    checks.push(
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM "MoneyServiceSettlement" AS settlement
        JOIN "Store" AS store ON store.id = settlement.store
        WHERE settlement."tradingDate" IS DISTINCT FROM
          to_char(settlement."periodStartedAt" AT TIME ZONE store.timezone, 'YYYY-MM-DD')
          OR settlement."tradingDate" IS DISTINCT FROM
          to_char((settlement."periodEndedAt" - interval '1 millisecond') AT TIME ZONE store.timezone, 'YYYY-MM-DD')
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
      `,
    );
  }
  const mismatches = (await Promise.all(checks)).reduce(
    (sum, rows) => sum + (rows[0]?.count ?? 0n),
    0n,
  );
  if (mismatches > 0n) {
    throw new Error(
      "StoreDay, lottery, or money-service settlement periods do not remain within their labeled trading date, or approved settlements do not exactly match StoreDay evidence; owner review is required before migration so approved accounting evidence is not silently relabeled",
    );
  }
}

async function reconcileStoreDayDepositAccounting(
  prisma: PrismaClient,
): Promise<void> {
  if (
    !(await tableExists(prisma, "StoreDay")) ||
    !(await tableExists(prisma, "BankDeposit")) ||
    !(await columnExists(prisma, "StoreDay", "depositedCashCents"))
  ) {
    return;
  }
  await prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRawUnsafe(
        'LOCK TABLE "StoreDay", "BankDeposit" IN SHARE ROW EXCLUSIVE MODE',
      );
      const rows = await transaction.$queryRaw<
        Array<{ count: bigint; locked: bigint }>
      >`
        WITH posted AS (
          SELECT
            "storeDay" AS store_day_id,
            COALESCE(
              SUM("amountCents") FILTER (WHERE status IN ('deposited', 'verified')),
              0
            )::integer AS amount
          FROM "BankDeposit"
          GROUP BY "storeDay"
        ), mismatched AS (
          SELECT day.status
          FROM "StoreDay" AS day
          JOIN posted ON posted.store_day_id = day.id
          WHERE day."depositedCashCents" <> posted.amount
            OR day."undepositedCashCents" <> GREATEST(
              0,
              day."countedCashCents" - day."openingCashCents" - posted.amount
            )
        )
        SELECT
          COUNT(*)::bigint AS count,
          COUNT(*) FILTER (WHERE status = 'locked')::bigint AS locked
        FROM mismatched
      `;
      const mismatchCount = rows[0]?.count ?? 0n;
      if (mismatchCount === 0n) return;
      const triggerRows = await transaction.$queryRaw<
        Array<{ installed: boolean }>
      >`
        SELECT EXISTS (
          SELECT 1
          FROM pg_trigger AS trigger
          JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
          WHERE NOT trigger.tgisinternal
            AND trigger.tgname = 'ofc_locked_store_day_evidence_fence'
            AND relation.relname = 'StoreDay'
        ) AS installed
      `;
      const lockedFenceInstalled = triggerRows[0]?.installed === true;
      if (lockedFenceInstalled && (rows[0]?.locked ?? 0n) > 0n) {
        throw new Error(
          "Locked StoreDay deposit accounting differs from posted deposits after the immutable-evidence fence; owner review is required and preflight will not bypass the trigger",
        );
      }
      if (process.env.ALLOW_STORE_DAY_DEPOSIT_RECONCILIATION !== "true") {
        throw new Error(
          "StoreDay deposit accounting requires owner-approved pre-migration reconciliation after a verified backup; set ALLOW_STORE_DAY_DEPOSIT_RECONCILIATION=true for this reviewed migration run",
        );
      }
      const mutablePredicate = lockedFenceInstalled
        ? "AND day.status <> 'locked'"
        : "";
      const updated = await transaction.$executeRawUnsafe(`
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
        UPDATE "StoreDay" AS day
        SET
          "depositedCashCents" = posted.amount,
          "undepositedCashCents" = GREATEST(
            0,
            day."countedCashCents" - day."openingCashCents" - posted.amount
          ),
          "updatedAt" = CURRENT_TIMESTAMP
        FROM posted
        WHERE day.id = posted.store_day_id
          ${mutablePredicate}
          AND (
            day."depositedCashCents" <> posted.amount
            OR day."undepositedCashCents" <> GREATEST(
              0,
              day."countedCashCents" - day."openingCashCents" - posted.amount
            )
          )
      `);
      if (BigInt(updated) !== mismatchCount) {
        throw new Error(
          "StoreDay deposit reconciliation did not update the complete reviewed set",
        );
      }
      console.log(
        `Reconciled ${updated} StoreDay deposit row(s) before immutable evidence fences`,
      );
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}

async function assertAdditiveConstraintReadiness(
  prisma: PrismaClient,
): Promise<void> {
  await assertSettlementTradingDateReadiness(prisma);
  if (
    (await tableExists(prisma, "ApiKey")) &&
    (await columnExists(prisma, "ApiKey", "keyPrefix"))
  ) {
    const duplicateApiKeyPrefixes = await prisma.$queryRaw<
      Array<{ keyPrefix: string; count: bigint }>
    >`
      SELECT "keyPrefix", COUNT(*)::bigint AS count
      FROM "ApiKey"
      GROUP BY "keyPrefix"
      HAVING COUNT(*) > 1
      ORDER BY "keyPrefix"
      LIMIT 11
    `;
    if (duplicateApiKeyPrefixes.length) {
      throw new Error(
        "Duplicate ApiKey key prefixes must be owner-reviewed before the additive uniqueness migration: after a verified backup, retain one key per prefix and revoke/rotate the others without deleting their rows",
      );
    }
  }
  if (await tableExists(prisma, "Employee")) {
    const duplicateEmployees = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT "business", "user" FROM "Employee"
        WHERE "business" IS NOT NULL AND "user" IS NOT NULL
        GROUP BY "business", "user" HAVING COUNT(*) > 1
      ) duplicates
    `;
    if ((duplicateEmployees[0]?.count ?? 0n) > 0n) {
      throw new Error(
        "Duplicate Employee business/user memberships must be reviewed before the additive uniqueness migration",
      );
    }
  }
  if (await tableExists(prisma, "FuelTransaction")) {
    const duplicateFuelEvidence = await prisma.$queryRaw<
      Array<{ count: bigint }>
    >`
      SELECT COUNT(*)::bigint AS count FROM (
        SELECT "site", "controllerTransactionId" FROM "FuelTransaction"
        WHERE "site" IS NOT NULL AND "controllerTransactionId" IS NOT NULL
        GROUP BY "site", "controllerTransactionId" HAVING COUNT(*) > 1
        UNION ALL
        SELECT NULL::text, "tender" FROM "FuelTransaction"
        WHERE "tender" IS NOT NULL
        GROUP BY "tender" HAVING COUNT(*) > 1
      ) duplicates
    `;
    if ((duplicateFuelEvidence[0]?.count ?? 0n) > 0n) {
      throw new Error(
        "Duplicate fuel controller/tender evidence must be reviewed before the additive uniqueness migration",
      );
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error("DATABASE_URL is required for migration preflight");
  const prisma = new PrismaClient();
  try {
    await assertAdditiveConstraintReadiness(prisma);
    await reconcileStoreDayDepositAccounting(prisma);
    await reconcileAtomicMigrationChecksums(prisma);
    if (!(await tableExists(prisma, "User"))) return;
    const hasUserRole = await columnExists(prisma, "User", "role");
    const legacyRoleShape = await columnExists(
      prisma,
      "Role",
      "canCreateTodos",
    );
    const legacyTables = (
      await Promise.all(
        LEGACY_TABLES.map(async (table) => ({
          table,
          present:
            table === "Role"
              ? legacyRoleShape
              : await tableExists(prisma, table),
        })),
      )
    )
      .filter((entry) => entry.present)
      .map((entry) => entry.table);
    if (!legacyTables.length && !hasUserRole) return;

    await prisma.$transaction(
      async (transaction) => {
        for (const table of legacyTables) {
          await transaction.$executeRawUnsafe(
            `LOCK TABLE "${table}" IN ACCESS EXCLUSIVE MODE`,
          );
        }
        if (hasUserRole)
          await transaction.$executeRawUnsafe(
            'LOCK TABLE "User" IN ACCESS EXCLUSIVE MODE',
          );

        await transaction.$executeRawUnsafe(
          "CREATE SCHEMA IF NOT EXISTS openfront_legacy_archive",
        );
        await transaction.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS openfront_legacy_archive.records (
          source_table text NOT NULL,
          source_key text NOT NULL,
          payload jsonb NOT NULL,
          archived_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (source_table, source_key)
        )
      `);
        const counts = await Promise.all(
          legacyTables.map(
            async (table) =>
              [table, await tableCount(transaction, table)] as const,
          ),
        );
        const roleBearingUsers = hasUserRole
          ? ((
              await transaction.$queryRawUnsafe<Array<{ count: bigint }>>(
                'SELECT COUNT(*)::bigint AS count FROM "User" WHERE "role" IS NOT NULL',
              )
            )[0]?.count ?? 0n)
          : 0n;
        const dataBearing = counts.filter(([, count]) => count > 0n);
        const shapes = [
          ...dataBearing.map(([table]) => table),
          ...(roleBearingUsers > 0n ? ["User.role"] : []),
        ];
        if (
          shapes.length &&
          process.env.OPENFRONT_LEGACY_BACKUP_VERIFIED !== "true"
        ) {
          throw new Error(
            `Legacy starter data is present in ${shapes.join(", ")}. Create and verify a restorable backup, then set OPENFRONT_LEGACY_BACKUP_VERIFIED=true for this one migration run.`,
          );
        }
        for (const table of legacyTables)
          await archiveLegacyTable(transaction, table);
        if (hasUserRole)
          await archiveRoleAssignments(transaction, roleBearingUsers);
        await installLegacyWriteFence(transaction, legacyTables, hasUserRole);
        console.log(
          `Archived and write-fenced legacy shapes: ${[...legacyTables, ...(hasUserRole ? ["User.role"] : [])].join(", ")}`,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Migration preflight failed",
  );
  process.exitCode = 1;
});

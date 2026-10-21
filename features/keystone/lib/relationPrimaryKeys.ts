import { Prisma, type PrismaClient } from "@prisma/client";

export const REQUIRED_RELATION_PRIMARY_KEYS = [
  "_ApiKey_stores",
  "_CartLine_promotions",
  "_Cart_promotions",
  "_CompliancePolicy_categories",
  "_CompliancePolicy_products",
  "_CompliancePolicy_stores",
  "_Employee_stores",
  "_ExportDestination_stores",
  "_MoneyServiceProvider_stores",
  "_PriceBook_stores",
  "_Product_categories",
  "_PromotionRule_categories",
  "_PromotionRule_products",
  "_Promotion_stores",
] as const;

type QueryClient = Pick<PrismaClient, "$queryRaw"> | Prisma.TransactionClient;

export async function assertRelationPrimaryKeys(
  client: QueryClient,
): Promise<void> {
  const rows = await client.$queryRaw<
    Array<{ tableName: string; columns: string[] }>
  >(Prisma.sql`
    SELECT
      relation.relname AS "tableName",
      array_agg(attribute.attname ORDER BY key_column.ordinality)::text[] AS columns
    FROM pg_constraint AS con
    JOIN pg_class AS relation ON relation.oid = con.conrelid
    JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS key_column(attnum, ordinality)
      ON true
    JOIN pg_attribute AS attribute
      ON attribute.attrelid = relation.oid
      AND attribute.attnum = key_column.attnum
    WHERE con.contype = 'p'
      AND relation.relname IN (${Prisma.join(REQUIRED_RELATION_PRIMARY_KEYS)})
    GROUP BY relation.relname
    ORDER BY relation.relname
  `);
  const valid = new Set(
    rows
      .filter(
        (row) =>
          row.columns.length === 2 &&
          row.columns[0] === "A" &&
          row.columns[1] === "B",
      )
      .map((row) => row.tableName),
  );
  const missing = REQUIRED_RELATION_PRIMARY_KEYS.filter(
    (table) => !valid.has(table),
  );
  if (missing.length) {
    throw new Error(
      `Relation-table composite primary keys are incomplete: ${missing.join(", ")}`,
    );
  }
}

import { Prisma } from "@prisma/client";

/**
 * Refunds and completed-sale voids share one transaction-scoped lock to order
 * same-sale mutation paths before their eligibility queries. The Serializable
 * runner still must retry if a waiter holds a stale transaction snapshot.
 */
export async function lockSaleRefundOrVoid(
  transaction: Prisma.TransactionClient,
  input: { businessId: string; storeId: string; saleId: string },
): Promise<void> {
  await transaction.$queryRaw(
    Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`pos-sale:${input.businessId}:${input.storeId}:${input.saleId}`}))::text AS "locked"`,
  );
}

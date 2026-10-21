import { Prisma } from "@prisma/client";
import type { Session } from "../access";

/**
 * Adapt the donor publicSubmissionPolicy's lock-then-read pattern to human and
 * machine authorization. Real row locks participate with ALL PostgreSQL UPDATE
 * and DELETE writers, including generic/inverse relationship mutations. These
 * must be acquired on the executing transaction, before its authority read.
 */
export async function lockOperationAuthority(
  transaction: Prisma.TransactionClient,
  session: Session,
  businessId: string,
  storeId?: string | null,
) {
  await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "User" WHERE "id" = ${session.itemId} FOR SHARE`);
  const businesses = await transaction.$queryRaw<{ id: string; status: string }[]>(Prisma.sql`SELECT "id", "status" FROM "Business" WHERE "id" = ${businessId} FOR SHARE`);
  if (businesses.length !== 1 || businesses[0].status !== "active") throw new Error("Active operation business not found");
  if (storeId) await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Store" WHERE "id" = ${storeId} AND "business" = ${businessId} FOR SHARE`);
  await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "Employee" WHERE "user" = ${session.itemId} AND "business" = ${businessId} ORDER BY "id" FOR SHARE`);
  await transaction.$queryRaw(Prisma.sql`SELECT r."id" FROM "Role" r WHERE r."id" IN (SELECT e."role" FROM "Employee" e WHERE e."user" = ${session.itemId} AND e."business" = ${businessId}) ORDER BY r."id" FOR SHARE`);
  await transaction.$queryRaw(Prisma.sql`SELECT membership."A", membership."B" FROM "_Employee_stores" membership JOIN "Employee" e ON e."id" = membership."A" WHERE e."user" = ${session.itemId} AND e."business" = ${businessId} ORDER BY membership."A", membership."B" FOR SHARE OF membership`);
  if (session.apiKeyId) {
    await transaction.$queryRaw(Prisma.sql`SELECT "id" FROM "ApiKey" WHERE "id" = ${session.apiKeyId} AND "business" = ${businessId} FOR SHARE`);
    await transaction.$queryRaw(Prisma.sql`SELECT membership."A", membership."B" FROM "_ApiKey_stores" membership WHERE membership."A" = ${session.apiKeyId} ORDER BY membership."A", membership."B" FOR SHARE`);
  }
}

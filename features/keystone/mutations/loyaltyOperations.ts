import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";
import { Prisma } from "@prisma/client";

import { runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

export type LoyaltyChronologyEntry = {
  type: string;
  pointsDelta: number;
  expiresAt: Date | null;
  occurredAt?: Date | null;
};

type LoyaltyPointBucket = { remaining: number; expiresAt: Date | null };

function remainingPointBuckets(
  entries: LoyaltyChronologyEntry[],
  asOf: Date,
): LoyaltyPointBucket[] {
  const buckets: LoyaltyPointBucket[] = [];
  for (const entry of entries) {
    const occurredAt = entry.occurredAt ?? asOf;
    if (occurredAt > asOf) continue;
    if (entry.pointsDelta > 0) {
      buckets.push({
        remaining: entry.pointsDelta,
        expiresAt: entry.type === "earned" ? entry.expiresAt : null,
      });
      continue;
    }
    let remainingConsumption = -entry.pointsDelta;
    const candidates =
      entry.type === "expired"
        ? buckets.filter(
            (bucket) =>
              bucket.expiresAt != null && bucket.expiresAt <= occurredAt,
          )
        : buckets.filter(
            (bucket) =>
              bucket.expiresAt == null || bucket.expiresAt > occurredAt,
          );
    for (const bucket of candidates) {
      if (remainingConsumption <= 0) break;
      const consumed = Math.min(bucket.remaining, remainingConsumption);
      bucket.remaining -= consumed;
      remainingConsumption -= consumed;
    }
  }
  return buckets;
}

export function remainingExpirablePoints(
  entries: LoyaltyChronologyEntry[],
  asOf: Date,
  pointsBalance: number,
): number {
  const expired = remainingPointBuckets(entries, asOf).reduce(
    (sum, bucket) =>
      sum +
      (bucket.expiresAt && bucket.expiresAt <= asOf ? bucket.remaining : 0),
    0,
  );
  return Math.max(0, Math.min(Math.max(0, pointsBalance), expired));
}

export function availableLoyaltyPoints(
  entries: LoyaltyChronologyEntry[],
  asOf: Date,
  pointsBalance: number,
): number {
  const available = remainingPointBuckets(entries, asOf).reduce(
    (sum, bucket) =>
      sum +
      (!bucket.expiresAt || bucket.expiresAt > asOf ? bucket.remaining : 0),
    0,
  );
  return Math.max(0, Math.min(Math.max(0, pointsBalance), available));
}

export function allocateLoyaltyRedemption(
  entries: LoyaltyChronologyEntry[],
  asOf: Date,
  requestedPoints: number,
): Array<{ points: number; expiresAt: string | null }> {
  if (!Number.isSafeInteger(requestedPoints) || requestedPoints <= 0)
    throw new Error("Loyalty allocation requires positive integer points");
  const allocations: Array<{ points: number; expiresAt: string | null }> = [];
  let remaining = requestedPoints;
  for (const bucket of remainingPointBuckets(entries, asOf)) {
    if (remaining <= 0) break;
    if (bucket.remaining <= 0 || (bucket.expiresAt && bucket.expiresAt <= asOf))
      continue;
    const points = Math.min(bucket.remaining, remaining);
    allocations.push({
      points,
      expiresAt: bucket.expiresAt?.toISOString() ?? null,
    });
    remaining -= points;
  }
  if (remaining > 0)
    throw new Error("Loyalty redemption exceeds unexpired FIFO points");
  return allocations;
}

export async function configureLoyaltyProgram(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      name: string;
      code: string;
      status: "draft" | "active" | "paused";
      pointsPerDollar: number;
      redemptionPoints: number;
      redemptionValueCents: number;
      pointsExpireAfterDays?: number | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (!["draft", "active", "paused"].includes(args.input.status))
    throw new Error(
      "Loyalty status is not configurable through this operation",
    );
  const name = args.input.name.trim();
  const code = args.input.code.trim().toLowerCase();
  if (!name || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(code))
    throw new Error("Loyalty name and slug code are required");
  for (const [label, value, minimum] of [
    ["Points per dollar", args.input.pointsPerDollar, 0],
    ["Redemption points", args.input.redemptionPoints, 1],
    ["Redemption value", args.input.redemptionValueCents, 0],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < minimum)
      throw new Error(`${label} must be an integer of at least ${minimum}`);
  }
  if (
    args.input.pointsExpireAfterDays != null &&
    (!Number.isSafeInteger(args.input.pointsExpireAfterDays) ||
      args.input.pointsExpireAfterDays < 1)
  ) {
    throw new Error("Point expiry must be a positive number of days");
  }
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageLoyalty",
    scope: "configureLoyaltyProgram",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, name, code },
    resourceType: "LoyaltyProgram",
    action: "loyalty_program.configure",
    execute: async (transaction) => {
      const lookupKey = `${args.input.businessId}:loyalty:${code}`;
      const program = await transaction.loyaltyProgram.upsert({
        where: { lookupKey },
        update: {
          name,
          status: args.input.status,
          pointsPerDollar: args.input.pointsPerDollar,
          redemptionPoints: args.input.redemptionPoints,
          redemptionValueCents: args.input.redemptionValueCents,
          pointsExpireAfterDays: args.input.pointsExpireAfterDays ?? null,
        },
        create: {
          businessId: args.input.businessId,
          name,
          code,
          lookupKey,
          status: args.input.status,
          pointsPerDollar: args.input.pointsPerDollar,
          redemptionPoints: args.input.redemptionPoints,
          redemptionValueCents: args.input.redemptionValueCents,
          pointsExpireAfterDays: args.input.pointsExpireAfterDays ?? null,
        },
      });
      return {
        id: program.id,
        status: program.status,
        reference: program.code,
      };
    },
  });
}

export async function enrollLoyaltyAccount(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      programId: string;
      userId?: string | null;
      email?: string | null;
      phone?: string | null;
      marketingOptIn?: boolean | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const email = args.input.email?.trim().toLowerCase() || "";
  const phone = args.input.phone?.trim() || "";
  if (!args.input.userId && !email && !phone) {
    throw new Error(
      "Loyalty enrollment requires a user, email, or phone lookup identity",
    );
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Loyalty email is invalid");
  }
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageLoyalty",
    scope: "enrollLoyaltyAccount",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, email, phone },
    resourceType: "LoyaltyAccount",
    action: "loyalty.account.enroll",
    execute: async (transaction, idempotencyId) => {
      const program = await transaction.loyaltyProgram.findFirst({
        where: {
          id: args.input.programId,
          businessId: args.input.businessId,
          status: "active",
        },
      });
      if (!program) throw new Error("Active loyalty program not found");
      if (args.input.userId) {
        const user = await transaction.user.findUnique({
          where: { id: args.input.userId },
        });
        if (!user) throw new Error("Loyalty user not found");
      }
      const identity = args.input.userId
        ? `user:${args.input.userId}`
        : email
          ? `email:${email}`
          : `phone:${phone}`;
      const lookupKey = `${args.input.businessId}:${program.id}:${identity}`;
      const existing = await transaction.loyaltyAccount.findUnique({
        where: { lookupKey },
      });
      if (existing) {
        return {
          id: existing.id,
          status: existing.status,
          reference: existing.accountNumber,
        };
      }
      const account = await transaction.loyaltyAccount.create({
        data: {
          businessId: args.input.businessId,
          programId: program.id,
          userId: args.input.userId ?? null,
          accountNumber: `LOY-${randomUUID()}`,
          lookupKey,
          email,
          phone,
          status: "active",
          tier: "standard",
          pointsBalance: 0,
          lifetimePoints: 0,
          marketingOptIn: args.input.marketingOptIn ?? false,
          metadata: {
            idempotencyId,
            consentCaptured: args.input.marketingOptIn ?? false,
          },
        },
      });
      return {
        id: account.id,
        status: account.status,
        reference: account.accountNumber,
      };
    },
  });
}

export async function applyLoyaltyRedemptionToCart(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      cartId: string;
      points: number;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (!Number.isSafeInteger(args.input.points) || args.input.points <= 0) {
    throw new Error("Loyalty redemption points must be a positive integer");
  }
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageLoyalty",
    scope: "applyLoyaltyRedemptionToCart",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "Cart",
    action: "loyalty.redemption.apply",
    execute: async (transaction) => {
      const cart = await transaction.cart.findFirst({
        where: {
          id: args.input.cartId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "open",
        },
        include: { loyaltyAccount: { include: { program: true } } },
      });
      const account = cart?.loyaltyAccount;
      const program = account?.program;
      if (
        !cart ||
        !account ||
        account.status !== "active" ||
        !program ||
        program.status !== "active"
      ) {
        throw new Error(
          "Open cart with an active loyalty account and program is required",
        );
      }
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`loyalty:${account.id}`}))::text AS "locked"`,
      );
      const entries = await transaction.loyaltyLedgerEntry.findMany({
        where: { accountId: account.id },
        select: {
          type: true,
          pointsDelta: true,
          expiresAt: true,
          occurredAt: true,
        },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
        take: 10_001,
      });
      if (entries.length > 10_000)
        throw new Error(
          "Loyalty account ledger exceeds the bounded redemption limit",
        );
      const pointsBalance = account.pointsBalance ?? 0;
      const spendablePoints = availableLoyaltyPoints(
        entries,
        new Date(),
        pointsBalance,
      );
      const redemptionPoints = program.redemptionPoints ?? 0;
      const redemptionValueCents = program.redemptionValueCents ?? 0;
      if (
        redemptionPoints <= 0 ||
        args.input.points > spendablePoints ||
        args.input.points % redemptionPoints !== 0
      ) {
        throw new Error(
          `Redemption must use unexpired points in increments of ${redemptionPoints}`,
        );
      }
      const redemptionCents =
        (args.input.points / redemptionPoints) * redemptionValueCents;
      if (
        !Number.isSafeInteger(redemptionCents) ||
        redemptionCents <= 0 ||
        redemptionCents > cart.totalCents
      ) {
        throw new Error(
          "Loyalty redemption value must be positive and cannot exceed the cart total",
        );
      }
      const updated = await transaction.cart.update({
        where: { id: cart.id },
        data: {
          loyaltyPointsToRedeem: args.input.points,
          loyaltyRedemptionCents: redemptionCents,
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: `${args.input.points}:${redemptionCents}`,
      };
    },
  });
}

export async function expireLoyaltyPoints(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      accountId: string;
      asOf: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const asOf = new Date(args.input.asOf);
  if (
    !Number.isFinite(asOf.getTime()) ||
    asOf.getTime() > Date.now() + 60_000
  ) {
    throw new Error(
      "Loyalty expiry as-of time must be valid and not in the future",
    );
  }
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageLoyalty",
    scope: "expireLoyaltyPoints",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, asOf: asOf.toISOString() },
    resourceType: "LoyaltyLedgerEntry",
    action: "loyalty.points.expire",
    execute: async (transaction, idempotencyId) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`loyalty:${args.input.accountId}`}))::text AS "locked"`,
      );
      const account = await transaction.loyaltyAccount.findFirst({
        where: {
          id: args.input.accountId,
          businessId: args.input.businessId,
          status: "active",
        },
      });
      if (!account) throw new Error("Active loyalty account not found");
      const entries = await transaction.loyaltyLedgerEntry.findMany({
        where: { accountId: account.id },
        select: {
          id: true,
          type: true,
          pointsDelta: true,
          expiresAt: true,
          occurredAt: true,
        },
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
        take: 10_001,
      });
      if (entries.length > 10_000)
        throw new Error(
          "Loyalty account ledger exceeds 10,000 entries; archive or process it in bounded operational batches",
        );
      const pointsBalance = account.pointsBalance ?? 0;
      const expirable = remainingExpirablePoints(entries, asOf, pointsBalance);
      if (expirable <= 0)
        return {
          id: account.id,
          status: "no_points_due",
          reference: account.accountNumber,
        };
      const balanceAfter = pointsBalance - expirable;
      await transaction.loyaltyAccount.update({
        where: { id: account.id },
        data: { pointsBalance: balanceAfter },
      });
      const entry = await transaction.loyaltyLedgerEntry.create({
        data: {
          businessId: args.input.businessId,
          accountId: account.id,
          type: "expired",
          pointsDelta: -expirable,
          balanceAfter,
          description: `Points expired through ${asOf.toISOString()}`,
          occurredAt: asOf,
          idempotencyId,
        },
      });
      return { id: entry.id, status: "expired", reference: String(expirable) };
    },
  });
}

export async function adjustLoyaltyPoints(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId?: string | null;
      accountId: string;
      employeeId: string;
      pointsDelta: number;
      description: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const input = args.input;
  if (!Number.isSafeInteger(input.pointsDelta) || input.pointsDelta === 0) {
    throw new Error("Points adjustment must be a non-zero safe integer");
  }
  if (!input.description.trim())
    throw new Error("Adjustment description is required");

  return runIdempotentOperation({
    context,
    businessId: input.businessId,
    storeId: input.storeId,
    permission: "canManageLoyalty",
    scope: "adjustLoyaltyPoints",
    idempotencyKey: input.idempotencyKey,
    input,
    resourceType: "LoyaltyLedgerEntry",
    action: "loyalty.adjust",
    execute: async (transaction, idempotencyId) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`loyalty:${input.accountId}`}))::text AS "locked"`,
      );
      const account = await transaction.loyaltyAccount.findFirst({
        where: {
          id: input.accountId,
          businessId: input.businessId,
          status: "active",
        },
      });
      if (!account)
        throw new Error("Active loyalty account not found for this business");

      const employee = await transaction.employee.findFirst({
        where: {
          id: input.employeeId,
          businessId: input.businessId,
          status: "active",
          ...(input.storeId ? { stores: { some: { id: input.storeId } } } : {}),
        },
      });
      if (!employee)
        throw new Error("Active employee not found for this business");

      const balanceAfter = (account.pointsBalance ?? 0) + input.pointsDelta;
      if (balanceAfter < 0)
        throw new Error(
          "Loyalty adjustment would make points balance negative",
        );

      await transaction.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: balanceAfter,
          lifetimePoints:
            input.pointsDelta > 0
              ? (account.lifetimePoints ?? 0) + input.pointsDelta
              : account.lifetimePoints,
        },
      });

      const entry = await transaction.loyaltyLedgerEntry.create({
        data: {
          businessId: input.businessId,
          storeId: input.storeId ?? null,
          accountId: account.id,
          type: "manual_adjustment",
          pointsDelta: input.pointsDelta,
          balanceAfter,
          description: input.description.trim(),
          actorId: employee.id,
          occurredAt: new Date(),
          idempotencyId,
        },
      });

      return {
        id: entry.id,
        status: "posted",
        reference: account.accountNumber,
      };
    },
  });
}

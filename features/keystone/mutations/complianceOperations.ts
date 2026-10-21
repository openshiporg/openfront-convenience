import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";
import { Prisma } from "@prisma/client";

import { assertStorePermission, type Session } from "../access";
import {
  admitManagerPinAttempt,
  requireManagerPinAuthority,
} from "../lib/managerAuthority";
import { requireSession, runIdempotentOperation } from "./operationRunner";
import type { OperationResult } from "./cashOperations";

export async function configureAgeRestrictionPolicy(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeIds: string[];
      name: string;
      code: string;
      jurisdiction: string;
      status: "draft" | "active" | "inactive";
      minimumAge: number;
      idCheckThresholdAge?: number | null;
      managerOverrideAllowed?: boolean | null;
      scanRequired?: boolean | null;
      productIds?: string[] | null;
      categoryIds?: string[] | null;
      startsAt?: string | null;
      endsAt?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (!["draft", "active", "inactive"].includes(args.input.status))
    throw new Error("Policy status is not configurable through this operation");
  const name = args.input.name.trim();
  const code = args.input.code.trim().toLowerCase();
  const jurisdiction = args.input.jurisdiction.trim();
  const storeIds = Array.from(new Set(args.input.storeIds)).sort();
  if (!name || !jurisdiction || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(code))
    throw new Error(
      "Policy name, slug code, and jurisdiction label are required",
    );
  if (!storeIds.length)
    throw new Error("Age policy requires at least one assigned store");
  for (const [label, value] of [
    ["Minimum age", args.input.minimumAge],
    ["ID check threshold", args.input.idCheckThresholdAge],
  ] as const) {
    if (
      value != null &&
      (!Number.isSafeInteger(value) ||
        value < (label === "Minimum age" ? 1 : 0) ||
        value > 120)
    )
      throw new Error(`${label} must be an integer in the allowed range`);
  }
  const startsAt = args.input.startsAt ? new Date(args.input.startsAt) : null;
  const endsAt = args.input.endsAt ? new Date(args.input.endsAt) : null;
  if (
    (startsAt && !Number.isFinite(startsAt.getTime())) ||
    (endsAt && !Number.isFinite(endsAt.getTime()))
  )
    throw new Error("Policy dates must be ISO timestamps");
  if (startsAt && endsAt && endsAt <= startsAt)
    throw new Error("Policy end must follow its start");
  const session = requireSession(context) as Session;
  for (const storeId of storeIds)
    assertStorePermission(
      session,
      args.input.businessId,
      storeId,
      "canManageCompliance",
    );
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    permission: "canManageCompliance",
    scope: "configureAgeRestrictionPolicy",
    idempotencyKey: args.input.idempotencyKey,
    input: {
      ...args.input,
      name,
      code,
      jurisdiction,
      storeIds,
      startsAt: startsAt?.toISOString() ?? null,
      endsAt: endsAt?.toISOString() ?? null,
    },
    resourceType: "CompliancePolicy",
    action: "compliance_policy.configure",
    execute: async (transaction) => {
      await transaction.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`checkout-policy:${args.input.businessId}`}))::text AS "locked"`,
      );
      const stores = await transaction.store.findMany({
        where: {
          businessId: args.input.businessId,
          id: { in: storeIds },
          status: "active",
        },
        select: { id: true },
      });
      const products = await transaction.product.findMany({
        where: {
          businessId: args.input.businessId,
          id: { in: args.input.productIds ?? [] },
        },
        select: { id: true },
      });
      const categories = await transaction.productCategory.findMany({
        where: {
          businessId: args.input.businessId,
          id: { in: args.input.categoryIds ?? [] },
        },
        select: { id: true },
      });
      if (
        stores.length !== storeIds.length ||
        products.length !== new Set(args.input.productIds ?? []).size ||
        categories.length !== new Set(args.input.categoryIds ?? []).size
      )
        throw new Error("Policy relationships must belong to this business");
      const lookupKey = `${args.input.businessId}:compliance:${code}`;
      const existing = await transaction.compliancePolicy.findUnique({
        where: { lookupKey },
      });
      const data = {
        name,
        code,
        policyType: "age_restriction" as const,
        status: args.input.status,
        jurisdiction,
        minimumAge: args.input.minimumAge,
        idCheckThresholdAge: args.input.idCheckThresholdAge ?? null,
        managerOverrideAllowed: args.input.managerOverrideAllowed ?? false,
        scanRequired: args.input.scanRequired ?? false,
        startsAt,
        endsAt,
      };
      const policy = existing
        ? await transaction.compliancePolicy.update({
            where: { id: existing.id },
            data: {
              ...data,
              stores: { set: stores.map(({ id }) => ({ id })) },
              products: { set: products.map(({ id }) => ({ id })) },
              categories: { set: categories.map(({ id }) => ({ id })) },
            },
          })
        : await transaction.compliancePolicy.create({
            data: {
              businessId: args.input.businessId,
              lookupKey,
              ...data,
              stores: { connect: stores.map(({ id }) => ({ id })) },
              products: { connect: products.map(({ id }) => ({ id })) },
              categories: { connect: categories.map(({ id }) => ({ id })) },
            },
          });
      return { id: policy.id, status: policy.status, reference: policy.code };
    },
  });
}

export async function transitionComplianceIncident(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      incidentId: string;
      employeeId: string;
      nextStatus: "investigating" | "reported" | "resolved" | "closed";
      resolution: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (
    !new Set(["investigating", "reported", "resolved", "closed"]).has(
      args.input.nextStatus,
    )
  ) {
    throw new Error("Unsupported compliance incident transition target");
  }
  const resolution = args.input.resolution.trim();
  if (resolution.length < 4 || resolution.length > 2_000) {
    throw new Error(
      "Compliance incident disposition must contain 4-2,000 characters",
    );
  }
  const allowed: Record<string, string[]> = {
    open: ["investigating", "reported", "resolved"],
    investigating: ["reported", "resolved"],
    reported: ["resolved", "closed"],
    resolved: ["closed"],
    closed: [],
  };
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageCompliance",
    scope: "transitionComplianceIncident",
    idempotencyKey: args.input.idempotencyKey,
    input: { ...args.input, resolution },
    resourceType: "ComplianceIncident",
    action: "compliance_incident.transition",
    execute: async (transaction) => {
      const incident = await transaction.complianceIncident.findFirst({
        where: {
          id: args.input.incidentId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
      });
      if (!incident) throw new Error("Compliance incident not found");
      if (incident.status === args.input.nextStatus) {
        return {
          id: incident.id,
          status: incident.status,
          reference: incident.incidentNumber,
        };
      }
      if (!allowed[incident.status]?.includes(args.input.nextStatus)) {
        throw new Error(
          `Compliance incident cannot move from ${incident.status} to ${args.input.nextStatus}`,
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
      if (!employee)
        throw new Error(
          "Compliance incident resolver is not active at this store",
        );
      const now = new Date();
      const terminal =
        args.input.nextStatus === "resolved" ||
        args.input.nextStatus === "closed";
      const updated = await transaction.complianceIncident.update({
        where: { id: incident.id },
        data: {
          status: args.input.nextStatus,
          resolution,
          resolvedById: terminal ? employee.id : incident.resolvedById,
          resolvedAt: terminal ? now : incident.resolvedAt,
          metadata: {
            ...(incident.metadata &&
            typeof incident.metadata === "object" &&
            !Array.isArray(incident.metadata)
              ? incident.metadata
              : {}),
            latestDisposition: {
              status: args.input.nextStatus,
              employeeId: employee.id,
              occurredAt: now.toISOString(),
            },
          },
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.incidentNumber,
      };
    },
  });
}

export async function verifyRestrictedSaleAge(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      policyId: string;
      cartId?: string | null;
      saleId?: string | null;
      employeeId: string;
      outcome: "passed" | "failed" | "overridden" | "declined";
      method:
        "id_scan" | "visual_check" | "known_customer" | "manager_override";
      ageAtVerification: number;
      documentType?: string | null;
      documentFingerprint?: string | null;
      overrideReason?: string | null;
      managerPin?: string | null;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const input = args.input;
  if (!input.cartId && !input.saleId) {
    throw new Error("Age verification must reference a cart or sale");
  }
  if (
    !Number.isSafeInteger(input.ageAtVerification) ||
    input.ageAtVerification < 0 ||
    input.ageAtVerification > 120
  ) {
    throw new Error("Age at verification must be an integer between 0 and 120");
  }
  const fingerprint = input.documentFingerprint?.trim() || "";
  if (fingerprint && !/^[a-f0-9]{64}$/i.test(fingerprint)) {
    throw new Error(
      "Document fingerprint must be a SHA-256 hex digest, never a raw ID number",
    );
  }
  if (input.outcome === "overridden") {
    await admitManagerPinAttempt(
      context.prisma,
      context.session as Session | undefined,
      input,
      "an age-policy override",
      "canManageCompliance",
    );
  }

  return runIdempotentOperation({
    context,
    businessId: input.businessId,
    storeId: input.storeId,
    permission: "canManageCompliance",
    scope: "verifyRestrictedSaleAge",
    idempotencyKey: input.idempotencyKey,
    input,
    resourceType: "AgeVerification",
    action: "compliance.age.verify",
    execute: async (transaction, idempotencyId) => {
      const now = new Date();
      const policy = await transaction.compliancePolicy.findFirst({
        where: {
          id: input.policyId,
          businessId: input.businessId,
          status: "active",
          policyType: "age_restriction",
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
            {
              OR: [
                { stores: { none: {} } },
                { stores: { some: { id: input.storeId } } },
              ],
            },
          ],
        },
      });
      if (!policy)
        throw new Error("Active age policy not found for this store");

      const employee = await transaction.employee.findFirst({
        where: {
          id: input.employeeId,
          businessId: input.businessId,
          status: "active",
          stores: { some: { id: input.storeId } },
        },
      });
      if (!employee)
        throw new Error("Active verifier is not assigned to this store");

      let cartRevision: string | null = null;
      if (input.cartId) {
        const cart = await transaction.cart.findFirst({
          where: {
            id: input.cartId,
            businessId: input.businessId,
            storeId: input.storeId,
            status: { in: ["open", "held"] },
          },
        });
        if (!cart) throw new Error("Open cart not found for age verification");
        cartRevision = cart.updatedAt.toISOString();
      }
      if (input.saleId) {
        const sale = await transaction.sale.findFirst({
          where: {
            id: input.saleId,
            businessId: input.businessId,
            storeId: input.storeId,
          },
        });
        if (!sale) throw new Error("Sale not found for age verification");
      }

      const minimumAge = policy.minimumAge ?? 0;
      if (input.outcome === "passed" && input.ageAtVerification < minimumAge) {
        throw new Error(`A passing verification requires age ${minimumAge}+`);
      }
      if (input.outcome === "overridden") {
        if (!policy.managerOverrideAllowed)
          throw new Error("Policy does not allow manager override");
        if (input.method !== "manager_override") {
          throw new Error(
            "Overridden outcomes require manager_override method",
          );
        }
        if (!input.overrideReason?.trim())
          throw new Error("Manager override reason is required");
        await requireManagerPinAuthority(
          transaction,
          input,
          "an age-policy override",
        );
      }
      if (
        policy.scanRequired &&
        input.outcome === "passed" &&
        input.method !== "id_scan"
      ) {
        throw new Error("Policy requires an ID scan for a passing result");
      }
      if (input.method === "id_scan" && !fingerprint) {
        throw new Error(
          "ID scan verification requires a non-reversible document fingerprint",
        );
      }

      const verification = await transaction.ageVerification.create({
        data: {
          businessId: input.businessId,
          storeId: input.storeId,
          verificationNumber: `AGE-${randomUUID()}`,
          policyId: policy.id,
          cartId: input.cartId ?? null,
          saleId: input.saleId ?? null,
          verifiedById: employee.id,
          outcome: input.outcome,
          method: input.method,
          ageAtVerification: input.ageAtVerification,
          documentType: input.documentType?.trim() || "",
          documentFingerprint: fingerprint,
          overrideReason: input.overrideReason?.trim() || "",
          verifiedAt: now,
          expiresAt: input.cartId
            ? new Date(now.getTime() + 24 * 60 * 60 * 1000)
            : null,
          metadata: {
            idempotencyId,
            policyRevision: policy.updatedAt.toISOString(),
            cartRevision,
          },
        },
      });

      if (input.outcome !== "passed") {
        await transaction.complianceIncident.create({
          data: {
            businessId: input.businessId,
            storeId: input.storeId,
            incidentNumber: `INC-${randomUUID()}`,
            incidentType:
              input.outcome === "overridden"
                ? "override"
                : "failed_verification",
            severity: input.outcome === "overridden" ? "medium" : "low",
            status: "open",
            policyId: policy.id,
            ageVerificationId: verification.id,
            saleId: input.saleId ?? null,
            reportedById: employee.id,
            description:
              input.outcome === "overridden"
                ? `Age policy overridden: ${input.overrideReason?.trim()}`
                : `Age verification outcome: ${input.outcome}`,
            reportedAt: now,
            metadata: { idempotencyId },
          },
        });
      }

      return {
        id: verification.id,
        status: verification.outcome,
        reference: verification.verificationNumber,
      };
    },
  });
}

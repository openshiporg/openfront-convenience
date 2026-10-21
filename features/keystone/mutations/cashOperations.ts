import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";

import {
  evaluateTransition,
  REGISTER_SESSION_TRANSITIONS,
} from "../lib/transitionPolicy";
import { runIdempotentOperation } from "./operationRunner";
import { assertCashLedger, assertRetailRegister, assertSameRegisterClose, retailRegisterInclude } from "../lib/retailCashBoundary";

export type OperationResult = {
  id: string;
  status: string;
  replayed: boolean;
  reference: string | null;
};

type BaseInput = {
  businessId: string;
  storeId: string;
  idempotencyKey: string;
};

function assertCents(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer number of cents`);
  }
}

export async function openEmployeeShift(
  _root: unknown,
  args: {
    input: BaseInput & {
      employeeId: string;
      startsAt: string;
      endsAt: string;
      roleSnapshot?: string | null;
    };
  },
  context: Context,
): Promise<OperationResult> {
  const startsAt = new Date(args.input.startsAt);
  const endsAt = new Date(args.input.endsAt);
  if (
    !Number.isFinite(startsAt.getTime()) ||
    !Number.isFinite(endsAt.getTime())
  ) {
    throw new Error("Shift timestamps must be valid ISO timestamps");
  }
  if (endsAt <= startsAt) throw new Error("Shift end must be after its start");

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePeople",
    scope: "openEmployeeShift",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "Shift",
    action: "shift.open",
    execute: async (transaction, idempotencyId) => {
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
        include: { role: { select: { name: true } } },
      });
      if (!employee)
        throw new Error("Active employee is not assigned to this store");

      const existing = await transaction.shift.findFirst({
        where: {
          businessId: args.input.businessId,
          employeeId: employee.id,
          status: { in: ["clocked_in", "on_break"] },
        },
      });
      if (existing) throw new Error("Employee already has an open shift");

      const shift = await transaction.shift.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          employeeId: employee.id,
          shiftNumber: `SHIFT-${randomUUID()}`,
          roleSnapshot:
            args.input.roleSnapshot?.trim() ||
            employee.role?.name ||
            "Employee",
          status: "clocked_in",
          startsAt,
          endsAt,
          clockedInAt: new Date(),
          metadata: { idempotencyId },
        },
      });

      return {
        id: shift.id,
        status: shift.status,
        reference: shift.shiftNumber,
      };
    },
  });
}

export async function closeEmployeeShift(
  _root: unknown,
  args: { input: BaseInput & { shiftId: string; notes?: string | null } },
  context: Context,
): Promise<OperationResult> {
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManagePeople",
    scope: "closeEmployeeShift",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "Shift",
    action: "shift.close",
    execute: async (transaction) => {
      const shift = await transaction.shift.findFirst({
        where: {
          id: args.input.shiftId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
      });
      if (!shift)
        throw new Error("Shift not found for this business and store");
      if (shift.status === "completed") {
        return {
          id: shift.id,
          status: shift.status,
          reference: shift.shiftNumber,
        };
      }
      if (!(["clocked_in", "on_break"] as string[]).includes(shift.status)) {
        throw new Error(`Cannot close a shift in ${shift.status} status`);
      }

      if (await transaction.registerSession.findFirst({
        where: { businessId: args.input.businessId, storeId: args.input.storeId, shiftId: shift.id, status: { in: ["open", "closing", "suspended"] } }, select: { id: true },
      })) throw new Error("Close all linked registers before completing this shift");

      const updated = await transaction.shift.update({
        where: { id: shift.id },
        data: {
          status: "completed",
          clockedOutAt: new Date(),
          notes: args.input.notes?.trim() || shift.notes,
        },
      });
      return {
        id: updated.id,
        status: updated.status,
        reference: updated.shiftNumber,
      };
    },
  });
}

export async function openRegisterSession(
  _root: unknown,
  args: {
    input: BaseInput & {
      registerId: string;
      employeeId: string;
      shiftId?: string | null;
      openingCashCents: number;
    };
  },
  context: Context,
): Promise<OperationResult> {
  assertCents(args.input.openingCashCents, "Opening cash");

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageCash",
    scope: "openRegisterSession",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "RegisterSession",
    action: "register_session.open",
    execute: async (transaction, idempotencyId) => {
      const register = await transaction.register.findFirst({
        where: {
          id: args.input.registerId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "active",
        },
      });
      if (!register)
        throw new Error("Active register not found for this store");

      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!employee)
        throw new Error("Active employee is not assigned to this store");

      if (args.input.shiftId) {
        const shift = await transaction.shift.findFirst({
          where: {
            id: args.input.shiftId,
            businessId: args.input.businessId,
            storeId: args.input.storeId,
            employeeId: employee.id,
            status: { in: ["clocked_in", "on_break"] },
          },
        });
        if (!shift)
          throw new Error("Open shift not found for this employee and store");
      }

      const existing = await transaction.registerSession.findFirst({
        where: {
          registerId: register.id,
          status: { in: ["open", "closing", "suspended"] },
        },
      });
      if (existing) throw new Error("Register already has an active session");

      const registerSession = await transaction.registerSession.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          registerId: register.id,
          employeeId: employee.id,
          shiftId: args.input.shiftId ?? null,
          sessionNumber: `REG-${randomUUID()}`,
          status: "open",
          openingCashCents: args.input.openingCashCents,
          expectedCashCents: args.input.openingCashCents,
          openedAt: new Date(),
          metadata: { idempotencyId },
        },
      });

      await transaction.cashMovement.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          registerSessionId: registerSession.id,
          employeeId: employee.id,
          type: "opening_float",
          direction: "in",
          amountCents: args.input.openingCashCents,
          reason: "Opening float",
          occurredAt: new Date(),
          idempotencyId,
        },
      });

      return {
        id: registerSession.id,
        status: registerSession.status,
        reference: registerSession.sessionNumber,
      };
    },
  });
}

export async function recordCashMovement(
  _root: unknown,
  args: {
    input: BaseInput & {
      registerSessionId: string;
      employeeId: string;
      type: "paid_in" | "paid_out" | "safe_drop" | "correction";
      direction?: "in" | "out" | null;
      amountCents: number;
      reason: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  assertCents(args.input.amountCents, "Cash movement amount");
  if (!args.input.reason.trim())
    throw new Error("Cash movement reason is required");

  const allowedTypes = new Set([
    "paid_in",
    "paid_out",
    "safe_drop",
    "correction",
  ]);
  if (!allowedTypes.has(args.input.type)) {
    throw new Error(
      "Only paid-in, paid-out, safe-drop, and correction movements are accepted here",
    );
  }
  const fixedDirections: Record<string, "in" | "out"> = {
    paid_in: "in",
    paid_out: "out",
    safe_drop: "out",
  };
  const direction =
    fixedDirections[args.input.type] ?? args.input.direction ?? null;
  if (!direction) throw new Error("Correction movements require a direction");

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageCash",
    scope: "recordCashMovement",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "CashMovement",
    action: "cash_movement.record",
    execute: async (transaction, idempotencyId) => {
      const registerSession = await transaction.registerSession.findFirst({
        where: {
          id: args.input.registerSessionId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          status: "open",
        },
        include: retailRegisterInclude,
      });
      if (!registerSession) throw new Error("Open register session not found");
      assertRetailRegister(registerSession, args.input.businessId, args.input.storeId);
      await assertCashLedger(transaction, registerSession);

      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
        },
      });
      if (!employee)
        throw new Error("Active employee not found for this business");

      const movement = await transaction.cashMovement.create({
        data: {
          businessId: args.input.businessId,
          storeId: args.input.storeId,
          registerSessionId: registerSession.id,
          employeeId: employee.id,
          type: args.input.type,
          direction,
          amountCents: args.input.amountCents,
          reason: args.input.reason.trim(),
          occurredAt: new Date(),
          idempotencyId,
        },
      });

      const delta =
        direction === "in" ? args.input.amountCents : -args.input.amountCents;
      const expectedCashCents = registerSession.expectedCashCents + delta;
      if (expectedCashCents < 0)
        throw new Error("Cash movement would make expected cash negative");

      await transaction.registerSession.update({
        where: { id: registerSession.id },
        data: { expectedCashCents },
      });

      return {
        id: movement.id,
        status: direction,
        reference: registerSession.sessionNumber,
      };
    },
  });
}

export async function closeRegisterSession(
  _root: unknown,
  args: {
    input: BaseInput & {
      registerSessionId: string;
      countedCashCents: number;
      notes?: string | null;
      originalScope?: unknown;
    };
  },
  context: Context,
): Promise<OperationResult> {
  assertCents(args.input.countedCashCents, "Counted cash");

  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canManageCash",
    scope: "closeRegisterSession",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "RegisterSession",
    action: "register_session.close",
    execute: async (transaction) => {
      const registerSession = await transaction.registerSession.findFirst({
        where: {
          id: args.input.registerSessionId,
          businessId: args.input.businessId,
          storeId: args.input.storeId,
        },
      });
      if (!registerSession) throw new Error("Register session not found");
      await assertCashLedger(transaction, registerSession);
      if (registerSession.status === "closed") {
        assertSameRegisterClose(registerSession, args.input);
        return {
          id: registerSession.id,
          status: registerSession.status,
          reference: registerSession.sessionNumber,
        };
      }
      const unresolvedCashFuelAuthorization = await transaction.sale.findFirst({
        where: {
          registerSessionId: registerSession.id,
          status: "completed",
          metadata: {
            path: ["purpose"],
            equals: "fuel_authorization",
          },
          tenders: {
            some: {
              method: "cash",
              status: "captured",
              refundedCents: 0,
            },
          },
          from_FuelTransaction_sale: { none: {} },
        },
        select: { id: true },
      });
      if (unresolvedCashFuelAuthorization) {
        throw new Error(
          "Register session cannot close while a cash fuel authorization remains unresolved",
        );
      }

      if (registerSession.status === "open") {
        evaluateTransition(REGISTER_SESSION_TRANSITIONS, "open", "closing");
      } else if (registerSession.status === "suspended") {
        evaluateTransition(REGISTER_SESSION_TRANSITIONS, "suspended", "closed");
      } else if (registerSession.status !== "closing") {
        throw new Error(
          `Cannot close a register session in ${registerSession.status} status`,
        );
      }
      if (registerSession.status !== "suspended") {
        evaluateTransition(REGISTER_SESSION_TRANSITIONS, "closing", "closed");
      }

      const closedAt = new Date();
      const updated = await transaction.registerSession.update({
        where: { id: registerSession.id },
        data: {
          status: "closed",
          closingStartedAt: registerSession.closingStartedAt ?? closedAt,
          closedAt,
          countedCashCents: args.input.countedCashCents,
          overShortCents:
            args.input.countedCashCents - registerSession.expectedCashCents,
          closingNotes: args.input.notes?.trim() || "",
        },
      });

      return {
        id: updated.id,
        status: updated.status,
        reference: updated.sessionNumber,
      };
    },
  });
}

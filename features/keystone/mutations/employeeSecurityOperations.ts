import type { Context } from ".keystone/types";
import bcrypt from "bcryptjs";

import type { OperationResult } from "./cashOperations";
import type { Session } from "../access";
import { requireSession, runIdempotentOperation } from "./operationRunner";

export async function setOwnPosPin(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      storeId: string;
      employeeId: string;
      newPin: string;
      idempotencyKey: string;
    };
  },
  context: Context,
): Promise<OperationResult> {
  if (!/^\d{6,12}$/.test(args.input.newPin))
    throw new Error("POS PIN must contain 6-12 digits");
  const session = requireSession(context) as Session;
  if (session.apiKeyId)
    throw new Error("Machine sessions cannot set a human POS PIN");
  return runIdempotentOperation({
    context,
    businessId: args.input.businessId,
    storeId: args.input.storeId,
    permission: "canAccessDashboard",
    scope: "setOwnPosPin",
    idempotencyKey: args.input.idempotencyKey,
    input: args.input,
    resourceType: "Employee",
    action: "employee.pos_pin.set",
    emitOutbox: false,
    execute: async (transaction) => {
      const employee = await transaction.employee.findFirst({
        where: {
          id: args.input.employeeId,
          businessId: args.input.businessId,
          status: "active",
          stores: { some: { id: args.input.storeId } },
          userId: session.itemId,
        },
      });
      if (!employee)
        throw new Error(
          "POS PIN may be set only for the authenticated user's active employee record",
        );
      await transaction.employee.update({
        where: { id: employee.id },
        data: { posPin: await bcrypt.hash(args.input.newPin, 12) },
      });
      return {
        id: employee.id,
        status: "pin_set",
        reference: employee.employeeNumber,
      };
    },
  });
}

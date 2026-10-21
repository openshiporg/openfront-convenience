import { randomUUID } from "node:crypto";

import type { Context } from ".keystone/types";

import type { Session } from "../access";
import { requireSession } from "./operationRunner";

/** Invalidates every stateless cookie issued at the current session version. */
export async function revokeCurrentUserSessions(
  _root: unknown,
  _args: unknown,
  context: Context,
): Promise<boolean> {
  const session = requireSession(context) as Session;
  if (session.apiKeyId) throw new Error("Machine sessions cannot revoke human sessions");
  await context.prisma.$transaction(async (transaction) => {
    const user = await transaction.user.update({
      where: { id: session.itemId },
      data: { sessionVersion: { increment: 1 } },
      select: { id: true, employees: { select: { businessId: true, stores: { select: { id: true }, take: 1 } }, take: 1 } },
    });
    const employee = user.employees[0];
    if (employee?.businessId) {
      await transaction.auditEvent.create({
        data: {
          businessId: employee.businessId,
          storeId: employee.stores[0]?.id ?? null,
          eventNumber: randomUUID(),
          action: "session.revoke_current_user",
          resourceType: "User",
          resourceId: user.id,
          result: "succeeded",
          actorType: "user",
          actorUserId: user.id,
          changes: { allPriorCookiesInvalidated: true },
          occurredAt: new Date(),
          metadata: {},
        },
      });
    }
  });
  return true;
}

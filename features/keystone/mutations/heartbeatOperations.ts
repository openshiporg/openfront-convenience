import type { Context } from ".keystone/types";
import type { Prisma } from "@prisma/client";

import { assertBusinessPermission, type Session } from "../access";
import { assertNoInlineSecrets } from "../lib/secretPolicy";
import { requireSession } from "./operationRunner";

export async function recordOperationalHeartbeat(
  _root: unknown,
  args: {
    input: {
      businessId: string;
      kind: "outbox" | "alerts" | "backup";
      workerId: string;
      status: "healthy" | "failed";
      details?: Record<string, unknown> | null;
    };
  },
  context: Context,
) {
  if (!["outbox", "alerts", "backup"].includes(args.input.kind))
    throw new Error("Heartbeat kind is invalid");
  if (!["healthy", "failed"].includes(args.input.status))
    throw new Error("Heartbeat status is invalid");
  const session = requireSession(context) as Session;
  if (args.input.kind === "backup") {
    throw new Error(
      "Backup health is recorded only by the verified database backup job",
    );
  }
  if (!session.apiKeyId)
    throw new Error(
      "Operational worker health requires a scoped machine session",
    );
  if (!session.apiKeyAllStores)
    throw new Error(
      "Business-wide worker health requires an all-store machine credential",
    );
  assertBusinessPermission(
    session,
    args.input.businessId,
    args.input.kind === "alerts" ? "canManageAlerts" : "canManageIntegrations",
  );
  const workerId = args.input.workerId.trim().slice(0, 128);
  if (!workerId) throw new Error("Heartbeat worker ID is required");
  const details = (args.input.details ?? {}) as Prisma.InputJsonValue;
  if (JSON.stringify(details).length > 4_096)
    throw new Error("Heartbeat details exceed 4 KiB");
  assertNoInlineSecrets(details);
  const heartbeatKey = `${args.input.businessId}:${args.input.kind}`;
  const heartbeat = await context.prisma.operationalHeartbeat.upsert({
    where: { heartbeatKey },
    update: {
      status: args.input.status,
      workerId,
      occurredAt: new Date(),
      details,
    },
    create: {
      businessId: args.input.businessId,
      heartbeatKey,
      kind: args.input.kind,
      status: args.input.status,
      workerId,
      occurredAt: new Date(),
      details,
    },
  });
  return {
    kind: heartbeat.kind,
    status: heartbeat.status,
    occurredAt: heartbeat.occurredAt.toISOString(),
  };
}

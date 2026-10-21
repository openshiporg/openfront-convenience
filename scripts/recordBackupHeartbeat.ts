import { stat } from "node:fs/promises";

import { PrismaClient } from "@prisma/client";

async function main() {
  const artifact = process.argv[2];
  if (!process.env.DATABASE_URL || !artifact) throw new Error("Database and verified backup artifact are required");
  const artifactStat = await stat(artifact);
  if (!artifactStat.isFile() || artifactStat.size <= 0) throw new Error("Verified backup artifact is empty");
  const prisma = new PrismaClient();
  try {
    const heartbeatTable = await prisma.$queryRaw<Array<{ present: boolean }>>`
      SELECT to_regclass('"OperationalHeartbeat"') IS NOT NULL AS present
    `;
    if (!heartbeatTable[0]?.present) {
      console.log("Backup verified; heartbeat table is not available until the operational-depth migration is applied");
      return;
    }
    const businesses = await prisma.business.findMany({ where: { status: "active" }, select: { id: true }, take: 10_001 });
    if (businesses.length > 10_000) throw new Error("Backup heartbeat business bound exceeded");
    const occurredAt = new Date();
    const details = {
      sizeBytes: artifactStat.size,
      offsiteReplicated: process.env.BACKUP_OFFSITE_REPLICATED === "true",
    };
    for (const business of businesses) {
      await prisma.operationalHeartbeat.upsert({
        where: { heartbeatKey: `${business.id}:backup` },
        update: { status: "healthy", workerId: "database-backup", occurredAt, details },
        create: {
          businessId: business.id,
          heartbeatKey: `${business.id}:backup`,
          kind: "backup",
          status: "healthy",
          workerId: "database-backup",
          occurredAt,
          details,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Backup heartbeat failed");
  process.exitCode = 1;
});

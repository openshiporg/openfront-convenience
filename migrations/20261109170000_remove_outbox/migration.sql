-- Remove the invented outbox. Live check: OutboxEvent 79 pending (never delivered), OutboxAttempt 0, OperationalHeartbeat 0.
DROP TABLE "OutboxAttempt";
DROP TABLE "OutboxEvent";
DROP TYPE "OutboxAttemptOutcomeType";
DROP TYPE "OutboxEventStatusType";

-- OperationalHeartbeat has no rows; drop the unused 'outbox' kind.
ALTER TYPE "OperationalHeartbeatKindType" RENAME TO "OperationalHeartbeatKindType_old";
CREATE TYPE "OperationalHeartbeatKindType" AS ENUM ('alerts', 'backup');
ALTER TABLE "OperationalHeartbeat" ALTER COLUMN "kind" TYPE "OperationalHeartbeatKindType" USING ("kind"::text::"OperationalHeartbeatKindType");
DROP TYPE "OperationalHeartbeatKindType_old";

BEGIN;

-- CreateEnum
CREATE TYPE "OutboxEventStatusType" AS ENUM ('pending', 'processing', 'retry', 'delivered', 'dead_letter');

-- CreateEnum
CREATE TYPE "OutboxAttemptOutcomeType" AS ENUM ('processing', 'delivered', 'retry', 'dead_letter', 'abandoned');

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "eventKey" TEXT NOT NULL DEFAULT '',
    "topic" TEXT NOT NULL DEFAULT '',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT NOT NULL DEFAULT '',
    "aggregateId" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "payload" JSONB DEFAULT '{}',
    "payloadHash" TEXT NOT NULL DEFAULT '',
    "status" "OutboxEventStatusType" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "totalAttempts" INTEGER NOT NULL DEFAULT 0,
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockOwner" TEXT NOT NULL DEFAULT '',
    "deliveredAt" TIMESTAMP(3),
    "deadLetteredAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxAttempt" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "event" TEXT,
    "attemptKey" TEXT NOT NULL DEFAULT '',
    "attemptNumber" INTEGER NOT NULL,
    "workerId" TEXT NOT NULL DEFAULT '',
    "outcome" "OutboxAttemptOutcomeType" NOT NULL DEFAULT 'processing',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OutboxEvent_eventKey_key" ON "OutboxEvent"("eventKey");

-- CreateIndex
CREATE INDEX "OutboxEvent_business_idx" ON "OutboxEvent"("business");

-- CreateIndex
CREATE INDEX "OutboxEvent_store_idx" ON "OutboxEvent"("store");

-- CreateIndex
CREATE INDEX "OutboxEvent_topic_idx" ON "OutboxEvent"("topic");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateType_idx" ON "OutboxEvent"("aggregateType");

-- CreateIndex
CREATE INDEX "OutboxEvent_aggregateId_idx" ON "OutboxEvent"("aggregateId");

-- CreateIndex
CREATE INDEX "OutboxEvent_action_idx" ON "OutboxEvent"("action");

-- CreateIndex
CREATE INDEX "OutboxEvent_status_idx" ON "OutboxEvent"("status");

-- CreateIndex
CREATE INDEX "OutboxEvent_availableAt_idx" ON "OutboxEvent"("availableAt");

-- CreateIndex
CREATE INDEX "OutboxEvent_idempotency_idx" ON "OutboxEvent"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "OutboxAttempt_attemptKey_key" ON "OutboxAttempt"("attemptKey");

-- CreateIndex
CREATE INDEX "OutboxAttempt_business_idx" ON "OutboxAttempt"("business");

-- CreateIndex
CREATE INDEX "OutboxAttempt_store_idx" ON "OutboxAttempt"("store");

-- CreateIndex
CREATE INDEX "OutboxAttempt_event_idx" ON "OutboxAttempt"("event");

-- CreateIndex
CREATE INDEX "OutboxAttempt_workerId_idx" ON "OutboxAttempt"("workerId");

-- CreateIndex
CREATE INDEX "OutboxAttempt_outcome_idx" ON "OutboxAttempt"("outcome");

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxAttempt" ADD CONSTRAINT "OutboxAttempt_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxAttempt" ADD CONSTRAINT "OutboxAttempt_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxAttempt" ADD CONSTRAINT "OutboxAttempt_event_fkey" FOREIGN KEY ("event") REFERENCES "OutboxEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

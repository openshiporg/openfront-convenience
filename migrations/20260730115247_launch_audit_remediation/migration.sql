BEGIN;

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "failedAuthCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "failedAuthResetAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LotteryPack" ADD COLUMN     "settlement" TEXT;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canUseAssistant" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "platformAdminApprovedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AuthenticationThrottle" (
    "id" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthenticationThrottle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthenticationThrottle_keyHash_key" ON "AuthenticationThrottle"("keyHash");

-- CreateIndex
CREATE INDEX "AuthenticationThrottle_resetsAt_idx" ON "AuthenticationThrottle"("resetsAt");

-- CreateIndex
CREATE INDEX "LotteryPack_settlement_idx" ON "LotteryPack"("settlement");

-- AddForeignKey
ALTER TABLE "LotteryPack" ADD CONSTRAINT "LotteryPack_settlement_fkey" FOREIGN KEY ("settlement") REFERENCES "LotterySettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

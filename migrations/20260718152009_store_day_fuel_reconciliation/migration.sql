BEGIN;

-- CreateEnum
CREATE TYPE "StoreDayStatusType" AS ENUM ('draft', 'in_review', 'reconciled', 'locked', 'reopened');

-- CreateEnum
CREATE TYPE "StoreDayLineDimensionType" AS ENUM ('register', 'tender', 'tax', 'fuel', 'lottery', 'money_service', 'deposit', 'other');

-- CreateEnum
CREATE TYPE "BankDepositStatusType" AS ENUM ('prepared', 'in_transit', 'deposited', 'verified', 'voided');

-- CreateEnum
CREATE TYPE "FuelTankReadingSourceType" AS ENUM ('manual_stick', 'atg', 'controller', 'delivery', 'import');

-- CreateEnum
CREATE TYPE "FuelReconciliationStatusType" AS ENUM ('draft', 'in_review', 'approved', 'locked', 'disputed');

-- CreateEnum
CREATE TYPE "OperationalAlertTypeType" AS ENUM ('cash_variance', 'fuel_variance', 'low_inventory', 'expiring_lot', 'lottery_variance', 'money_service_variance', 'integration_failure', 'offline_conflict', 'other');

-- CreateEnum
CREATE TYPE "OperationalAlertSeverityType" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "OperationalAlertStatusType" AS ENUM ('open', 'acknowledged', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "AlertEvaluationStatusType" AS ENUM ('completed', 'failed');

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "canManageAlerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageExports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageLottery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageMoneyServices" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageOfflineOperations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageReporting" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadAlerts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadExports" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadLottery" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadMoneyServices" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadOfflineOperations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadReporting" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "StoreDay" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "tradingDate" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "StoreDayStatusType" NOT NULL DEFAULT 'draft',
    "timezoneSnapshot" TEXT NOT NULL DEFAULT '',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "periodStartedAt" TIMESTAMP(3) NOT NULL,
    "periodEndedAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "grossSalesCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalSalesCents" INTEGER NOT NULL DEFAULT 0,
    "refundCents" INTEGER NOT NULL DEFAULT 0,
    "netReceiptsCents" INTEGER NOT NULL DEFAULT 0,
    "cashTenderCents" INTEGER NOT NULL DEFAULT 0,
    "nonCashTenderCents" INTEGER NOT NULL DEFAULT 0,
    "fuelSalesCents" INTEGER NOT NULL DEFAULT 0,
    "lotteryNetCents" INTEGER NOT NULL DEFAULT 0,
    "moneyServiceNetCents" INTEGER NOT NULL DEFAULT 0,
    "openingCashCents" INTEGER NOT NULL DEFAULT 0,
    "expectedCashCents" INTEGER NOT NULL DEFAULT 0,
    "countedCashCents" INTEGER NOT NULL DEFAULT 0,
    "cashOverShortCents" INTEGER NOT NULL DEFAULT 0,
    "depositedCashCents" INTEGER NOT NULL DEFAULT 0,
    "undepositedCashCents" INTEGER NOT NULL DEFAULT 0,
    "saleCount" INTEGER NOT NULL DEFAULT 0,
    "refundCount" INTEGER NOT NULL DEFAULT 0,
    "registerSessionCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreDayLine" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "storeDay" TEXT,
    "lineNumber" INTEGER NOT NULL,
    "dimension" "StoreDayLineDimensionType" NOT NULL,
    "dimensionKey" TEXT NOT NULL DEFAULT '',
    "label" TEXT NOT NULL DEFAULT '',
    "grossCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "netCents" INTEGER NOT NULL DEFAULT 0,
    "expectedCents" INTEGER NOT NULL DEFAULT 0,
    "actualCents" INTEGER NOT NULL DEFAULT 0,
    "varianceCents" INTEGER NOT NULL DEFAULT 0,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "sourceCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreDayLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankDeposit" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "storeDay" TEXT,
    "depositNumber" TEXT NOT NULL DEFAULT '',
    "status" "BankDepositStatusType" NOT NULL DEFAULT 'prepared',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "expectedAmountCents" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "varianceCents" INTEGER NOT NULL DEFAULT 0,
    "bagReference" TEXT NOT NULL DEFAULT '',
    "bankReference" TEXT NOT NULL DEFAULT '',
    "preparedBy" TEXT,
    "verifiedBy" TEXT,
    "preparedAt" TIMESTAMP(3) NOT NULL,
    "depositedAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankDeposit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelTankReading" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "site" TEXT,
    "tank" TEXT,
    "readingNumber" TEXT NOT NULL DEFAULT '',
    "source" "FuelTankReadingSourceType" NOT NULL,
    "volumeGallons" DECIMAL(18,4) NOT NULL,
    "waterVolumeGallons" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "ullageGallons" DECIMAL(18,4) NOT NULL,
    "temperatureFahrenheit" DECIMAL(18,4),
    "externalReference" TEXT NOT NULL DEFAULT '',
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "recordedBy" TEXT,
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelTankReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelReconciliation" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "site" TEXT,
    "tank" TEXT,
    "reconciliationNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "FuelReconciliationStatusType" NOT NULL DEFAULT 'draft',
    "periodStartedAt" TIMESTAMP(3) NOT NULL,
    "periodEndedAt" TIMESTAMP(3) NOT NULL,
    "openingReading" TEXT,
    "closingReading" TEXT,
    "openingGallons" DECIMAL(18,4) NOT NULL,
    "deliveredGallons" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "dispensedGallons" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "expectedClosingGallons" DECIMAL(18,4) NOT NULL,
    "measuredClosingGallons" DECIMAL(18,4) NOT NULL,
    "varianceGallons" DECIMAL(18,4) NOT NULL,
    "toleranceGallons" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "generatedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalAlert" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "alertNumber" TEXT NOT NULL DEFAULT '',
    "fingerprint" TEXT NOT NULL DEFAULT '',
    "type" "OperationalAlertTypeType" NOT NULL,
    "severity" "OperationalAlertSeverityType" NOT NULL DEFAULT 'warning',
    "status" "OperationalAlertStatusType" NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "resourceType" TEXT NOT NULL DEFAULT '',
    "resourceId" TEXT NOT NULL DEFAULT '',
    "observedValue" TEXT NOT NULL DEFAULT '',
    "thresholdValue" TEXT NOT NULL DEFAULT '',
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT NOT NULL DEFAULT '',
    "evaluation" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvaluation" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "evaluationNumber" TEXT NOT NULL DEFAULT '',
    "status" "AlertEvaluationStatusType" NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "existingCount" INTEGER NOT NULL DEFAULT 0,
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreDay_lookupKey_key" ON "StoreDay"("lookupKey");

-- CreateIndex
CREATE INDEX "StoreDay_business_idx" ON "StoreDay"("business");

-- CreateIndex
CREATE INDEX "StoreDay_store_idx" ON "StoreDay"("store");

-- CreateIndex
CREATE INDEX "StoreDay_tradingDate_idx" ON "StoreDay"("tradingDate");

-- CreateIndex
CREATE INDEX "StoreDay_approvedBy_idx" ON "StoreDay"("approvedBy");

-- CreateIndex
CREATE INDEX "StoreDay_idempotency_idx" ON "StoreDay"("idempotency");

-- CreateIndex
CREATE INDEX "StoreDayLine_business_idx" ON "StoreDayLine"("business");

-- CreateIndex
CREATE INDEX "StoreDayLine_store_idx" ON "StoreDayLine"("store");

-- CreateIndex
CREATE INDEX "StoreDayLine_storeDay_idx" ON "StoreDayLine"("storeDay");

-- CreateIndex
CREATE UNIQUE INDEX "BankDeposit_depositNumber_key" ON "BankDeposit"("depositNumber");

-- CreateIndex
CREATE INDEX "BankDeposit_business_idx" ON "BankDeposit"("business");

-- CreateIndex
CREATE INDEX "BankDeposit_store_idx" ON "BankDeposit"("store");

-- CreateIndex
CREATE INDEX "BankDeposit_storeDay_idx" ON "BankDeposit"("storeDay");

-- CreateIndex
CREATE INDEX "BankDeposit_bagReference_idx" ON "BankDeposit"("bagReference");

-- CreateIndex
CREATE INDEX "BankDeposit_bankReference_idx" ON "BankDeposit"("bankReference");

-- CreateIndex
CREATE INDEX "BankDeposit_preparedBy_idx" ON "BankDeposit"("preparedBy");

-- CreateIndex
CREATE INDEX "BankDeposit_verifiedBy_idx" ON "BankDeposit"("verifiedBy");

-- CreateIndex
CREATE INDEX "BankDeposit_idempotency_idx" ON "BankDeposit"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "FuelTankReading_readingNumber_key" ON "FuelTankReading"("readingNumber");

-- CreateIndex
CREATE INDEX "FuelTankReading_business_idx" ON "FuelTankReading"("business");

-- CreateIndex
CREATE INDEX "FuelTankReading_store_idx" ON "FuelTankReading"("store");

-- CreateIndex
CREATE INDEX "FuelTankReading_site_idx" ON "FuelTankReading"("site");

-- CreateIndex
CREATE INDEX "FuelTankReading_tank_idx" ON "FuelTankReading"("tank");

-- CreateIndex
CREATE INDEX "FuelTankReading_externalReference_idx" ON "FuelTankReading"("externalReference");

-- CreateIndex
CREATE INDEX "FuelTankReading_recordedBy_idx" ON "FuelTankReading"("recordedBy");

-- CreateIndex
CREATE INDEX "FuelTankReading_idempotency_idx" ON "FuelTankReading"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "FuelReconciliation_reconciliationNumber_key" ON "FuelReconciliation"("reconciliationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FuelReconciliation_lookupKey_key" ON "FuelReconciliation"("lookupKey");

-- CreateIndex
CREATE INDEX "FuelReconciliation_business_idx" ON "FuelReconciliation"("business");

-- CreateIndex
CREATE INDEX "FuelReconciliation_store_idx" ON "FuelReconciliation"("store");

-- CreateIndex
CREATE INDEX "FuelReconciliation_site_idx" ON "FuelReconciliation"("site");

-- CreateIndex
CREATE INDEX "FuelReconciliation_tank_idx" ON "FuelReconciliation"("tank");

-- CreateIndex
CREATE INDEX "FuelReconciliation_openingReading_idx" ON "FuelReconciliation"("openingReading");

-- CreateIndex
CREATE INDEX "FuelReconciliation_closingReading_idx" ON "FuelReconciliation"("closingReading");

-- CreateIndex
CREATE INDEX "FuelReconciliation_generatedBy_idx" ON "FuelReconciliation"("generatedBy");

-- CreateIndex
CREATE INDEX "FuelReconciliation_approvedBy_idx" ON "FuelReconciliation"("approvedBy");

-- CreateIndex
CREATE INDEX "FuelReconciliation_idempotency_idx" ON "FuelReconciliation"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalAlert_alertNumber_key" ON "OperationalAlert"("alertNumber");

-- CreateIndex
CREATE UNIQUE INDEX "OperationalAlert_fingerprint_key" ON "OperationalAlert"("fingerprint");

-- CreateIndex
CREATE INDEX "OperationalAlert_business_idx" ON "OperationalAlert"("business");

-- CreateIndex
CREATE INDEX "OperationalAlert_store_idx" ON "OperationalAlert"("store");

-- CreateIndex
CREATE INDEX "OperationalAlert_resourceId_idx" ON "OperationalAlert"("resourceId");

-- CreateIndex
CREATE INDEX "OperationalAlert_acknowledgedBy_idx" ON "OperationalAlert"("acknowledgedBy");

-- CreateIndex
CREATE INDEX "OperationalAlert_resolvedBy_idx" ON "OperationalAlert"("resolvedBy");

-- CreateIndex
CREATE INDEX "OperationalAlert_evaluation_idx" ON "OperationalAlert"("evaluation");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvaluation_evaluationNumber_key" ON "AlertEvaluation"("evaluationNumber");

-- CreateIndex
CREATE INDEX "AlertEvaluation_business_idx" ON "AlertEvaluation"("business");

-- CreateIndex
CREATE INDEX "AlertEvaluation_store_idx" ON "AlertEvaluation"("store");

-- CreateIndex
CREATE INDEX "AlertEvaluation_idempotency_idx" ON "AlertEvaluation"("idempotency");

-- AddForeignKey
ALTER TABLE "StoreDay" ADD CONSTRAINT "StoreDay_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDay" ADD CONSTRAINT "StoreDay_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDay" ADD CONSTRAINT "StoreDay_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDay" ADD CONSTRAINT "StoreDay_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDayLine" ADD CONSTRAINT "StoreDayLine_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDayLine" ADD CONSTRAINT "StoreDayLine_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreDayLine" ADD CONSTRAINT "StoreDayLine_storeDay_fkey" FOREIGN KEY ("storeDay") REFERENCES "StoreDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDeposit" ADD CONSTRAINT "BankDeposit_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDeposit" ADD CONSTRAINT "BankDeposit_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDeposit" ADD CONSTRAINT "BankDeposit_storeDay_fkey" FOREIGN KEY ("storeDay") REFERENCES "StoreDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDeposit" ADD CONSTRAINT "BankDeposit_preparedBy_fkey" FOREIGN KEY ("preparedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDeposit" ADD CONSTRAINT "BankDeposit_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDeposit" ADD CONSTRAINT "BankDeposit_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTankReading" ADD CONSTRAINT "FuelTankReading_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTankReading" ADD CONSTRAINT "FuelTankReading_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTankReading" ADD CONSTRAINT "FuelTankReading_site_fkey" FOREIGN KEY ("site") REFERENCES "FuelSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTankReading" ADD CONSTRAINT "FuelTankReading_tank_fkey" FOREIGN KEY ("tank") REFERENCES "FuelTank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTankReading" ADD CONSTRAINT "FuelTankReading_recordedBy_fkey" FOREIGN KEY ("recordedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTankReading" ADD CONSTRAINT "FuelTankReading_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelReconciliation" ADD CONSTRAINT "FuelReconciliation_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelReconciliation" ADD CONSTRAINT "FuelReconciliation_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelReconciliation" ADD CONSTRAINT "FuelReconciliation_site_fkey" FOREIGN KEY ("site") REFERENCES "FuelSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelReconciliation" ADD CONSTRAINT "FuelReconciliation_tank_fkey" FOREIGN KEY ("tank") REFERENCES "FuelTank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelReconciliation" ADD CONSTRAINT "FuelReconciliation_openingReading_fkey" FOREIGN KEY ("openingReading") REFERENCES "FuelTankReading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelReconciliation" ADD CONSTRAINT "FuelReconciliation_closingReading_fkey" FOREIGN KEY ("closingReading") REFERENCES "FuelTankReading"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelReconciliation" ADD CONSTRAINT "FuelReconciliation_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelReconciliation" ADD CONSTRAINT "FuelReconciliation_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelReconciliation" ADD CONSTRAINT "FuelReconciliation_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalAlert" ADD CONSTRAINT "OperationalAlert_evaluation_fkey" FOREIGN KEY ("evaluation") REFERENCES "AlertEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvaluation" ADD CONSTRAINT "AlertEvaluation_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvaluation" ADD CONSTRAINT "AlertEvaluation_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvaluation" ADD CONSTRAINT "AlertEvaluation_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

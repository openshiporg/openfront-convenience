BEGIN;

/*
  Warnings:

  - The primary key for the `_CartLine_promotions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Cart_promotions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_CompliancePolicy_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_CompliancePolicy_products` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_CompliancePolicy_stores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Employee_stores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_PriceBook_stores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Product_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_PromotionRule_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_PromotionRule_products` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Promotion_stores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[keyPrefix]` on the table `ApiKey` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerLookupKey]` on the table `Refund` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerLookupKey]` on the table `Tender` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_CartLine_promotions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Cart_promotions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_CompliancePolicy_categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_CompliancePolicy_products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_CompliancePolicy_stores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Employee_stores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_PriceBook_stores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Product_categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_PromotionRule_categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_PromotionRule_products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Promotion_stores` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LotteryGameStatusType" AS ENUM ('configured', 'active', 'paused', 'closed');

-- CreateEnum
CREATE TYPE "LotteryPackStatusType" AS ENUM ('received', 'activated', 'in_sale', 'closed', 'returned', 'settled');

-- CreateEnum
CREATE TYPE "LotteryPackEventTypeType" AS ENUM ('received', 'activated', 'sale_range', 'void_range', 'returned', 'closed', 'settled', 'adjustment');

-- CreateEnum
CREATE TYPE "LotterySettlementStatusType" AS ENUM ('in_review', 'approved', 'exported', 'disputed');

-- CreateEnum
CREATE TYPE "MoneyServiceProviderServiceTypeType" AS ENUM ('money_order', 'money_transfer', 'bill_payment', 'check_cashing', 'stored_value', 'atm_other');

-- CreateEnum
CREATE TYPE "MoneyServiceProviderStatusType" AS ENUM ('configured', 'active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "MoneyServiceProviderExecutionModeType" AS ENUM ('external_only');

-- CreateEnum
CREATE TYPE "MoneyServiceTransactionServiceTypeType" AS ENUM ('money_order', 'money_transfer', 'bill_payment', 'check_cashing', 'stored_value', 'atm_other');

-- CreateEnum
CREATE TYPE "MoneyServiceTransactionStatusType" AS ENUM ('confirmed', 'voided', 'refunded', 'reconciled');

-- CreateEnum
CREATE TYPE "MoneyServiceTransactionCashDirectionType" AS ENUM ('in', 'out', 'none');

-- CreateEnum
CREATE TYPE "MoneyServiceSettlementStatusType" AS ENUM ('in_review', 'approved', 'exported', 'disputed');

-- CreateEnum
CREATE TYPE "InventoryTransferStatusType" AS ENUM ('draft', 'approved', 'shipped', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentReconciliationStatusType" AS ENUM ('in_review', 'approved', 'exported', 'reopened');

-- CreateEnum
CREATE TYPE "OfflineDeviceStatusType" AS ENUM ('active', 'suspended', 'revoked');

-- CreateEnum
CREATE TYPE "OfflineOperationBatchStatusType" AS ENUM ('completed', 'partial', 'conflict', 'rejected');

-- CreateEnum
CREATE TYPE "OfflineOperationOutcomeType" AS ENUM ('applied', 'replayed', 'conflict', 'rejected');

-- CreateEnum
CREATE TYPE "ExportDestinationTypeType" AS ENUM ('accounting', 'provider', 'data_warehouse');

-- CreateEnum
CREATE TYPE "ExportDestinationStatusType" AS ENUM ('configured', 'active', 'disabled', 'error');

-- CreateEnum
CREATE TYPE "ExportBatchTypeType" AS ENUM ('daily_sales', 'purchasing', 'inventory', 'fuel', 'lottery', 'money_services');

-- CreateEnum
CREATE TYPE "ExportBatchStatusType" AS ENUM ('ready', 'delivering', 'delivered', 'failed', 'cancelled');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CashMovementTypeType" ADD VALUE 'lottery_sale';
ALTER TYPE "CashMovementTypeType" ADD VALUE 'lottery_payout';
ALTER TYPE "CashMovementTypeType" ADD VALUE 'money_service_in';
ALTER TYPE "CashMovementTypeType" ADD VALUE 'money_service_out';

-- AlterEnum
ALTER TYPE "OperationalAlertTypeType" ADD VALUE 'payment_variance';

-- DropIndex
DROP INDEX "ApiKey_keyPrefix_idx";

-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN     "allStores" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "providerLookupKey" TEXT;

-- AlterTable
ALTER TABLE "Tender" ADD COLUMN     "providerLookupKey" TEXT;

-- AlterTable
ALTER TABLE "_CartLine_promotions" DROP CONSTRAINT "_CartLine_promotions_AB_pkey";

-- AlterTable
ALTER TABLE "_Cart_promotions" DROP CONSTRAINT "_Cart_promotions_AB_pkey";

-- AlterTable
ALTER TABLE "_CompliancePolicy_categories" DROP CONSTRAINT "_CompliancePolicy_categories_AB_pkey";

-- AlterTable
ALTER TABLE "_CompliancePolicy_products" DROP CONSTRAINT "_CompliancePolicy_products_AB_pkey";

-- AlterTable
ALTER TABLE "_CompliancePolicy_stores" DROP CONSTRAINT "_CompliancePolicy_stores_AB_pkey";

-- AlterTable
ALTER TABLE "_Employee_stores" DROP CONSTRAINT "_Employee_stores_AB_pkey";

-- AlterTable
ALTER TABLE "_PriceBook_stores" DROP CONSTRAINT "_PriceBook_stores_AB_pkey";

-- AlterTable
ALTER TABLE "_Product_categories" DROP CONSTRAINT "_Product_categories_AB_pkey";

-- AlterTable
ALTER TABLE "_PromotionRule_categories" DROP CONSTRAINT "_PromotionRule_categories_AB_pkey";

-- AlterTable
ALTER TABLE "_PromotionRule_products" DROP CONSTRAINT "_PromotionRule_products_AB_pkey";

-- AlterTable
ALTER TABLE "_Promotion_stores" DROP CONSTRAINT "_Promotion_stores_AB_pkey";

-- CreateTable
CREATE TABLE "LotteryGame" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "gameCode" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "operatorName" TEXT NOT NULL DEFAULT '',
    "status" "LotteryGameStatusType" NOT NULL DEFAULT 'configured',
    "ticketPriceCents" INTEGER NOT NULL,
    "ticketsPerPack" INTEGER NOT NULL,
    "salesStartAt" TIMESTAMP(3),
    "salesEndAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotteryGame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryPack" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "game" TEXT,
    "packNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "LotteryPackStatusType" NOT NULL,
    "firstTicketNumber" INTEGER NOT NULL,
    "lastTicketNumber" INTEGER NOT NULL,
    "currentTicketNumber" INTEGER NOT NULL,
    "ticketsReceived" INTEGER NOT NULL,
    "ticketsSold" INTEGER NOT NULL DEFAULT 0,
    "ticketsVoided" INTEGER NOT NULL DEFAULT 0,
    "expectedSalesCents" INTEGER NOT NULL DEFAULT 0,
    "actualSalesCents" INTEGER NOT NULL DEFAULT 0,
    "varianceCents" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "receivedBy" TEXT,
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotteryPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotteryPackEvent" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "pack" TEXT,
    "eventNumber" TEXT NOT NULL DEFAULT '',
    "type" "LotteryPackEventTypeType" NOT NULL,
    "firstTicketNumber" INTEGER,
    "lastTicketNumber" INTEGER,
    "quantity" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL DEFAULT 0,
    "registerSession" TEXT,
    "employee" TEXT,
    "reason" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotteryPackEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LotterySettlement" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "settlementNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "tradingDate" TEXT NOT NULL DEFAULT '',
    "periodStartedAt" TIMESTAMP(3) NOT NULL,
    "periodEndedAt" TIMESTAMP(3) NOT NULL,
    "operatorName" TEXT NOT NULL DEFAULT '',
    "status" "LotterySettlementStatusType" NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "instantSalesCents" INTEGER NOT NULL DEFAULT 0,
    "onlineSalesCents" INTEGER NOT NULL DEFAULT 0,
    "payoutCents" INTEGER NOT NULL DEFAULT 0,
    "commissionCents" INTEGER NOT NULL DEFAULT 0,
    "expectedSettlementCents" INTEGER NOT NULL DEFAULT 0,
    "reportedSettlementCents" INTEGER NOT NULL DEFAULT 0,
    "varianceCents" INTEGER NOT NULL DEFAULT 0,
    "packCount" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LotterySettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyServiceProvider" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "serviceType" "MoneyServiceProviderServiceTypeType" NOT NULL,
    "status" "MoneyServiceProviderStatusType" NOT NULL DEFAULT 'configured',
    "executionMode" "MoneyServiceProviderExecutionModeType" NOT NULL DEFAULT 'external_only',
    "adapterKey" TEXT NOT NULL DEFAULT '',
    "externalAgentReference" TEXT NOT NULL DEFAULT '',
    "jurisdictionCode" TEXT NOT NULL DEFAULT '',
    "credentialReference" TEXT NOT NULL DEFAULT '',
    "configuration" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyServiceProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyServiceTransaction" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "provider" TEXT,
    "transactionNumber" TEXT NOT NULL DEFAULT '',
    "externalTransactionReference" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "serviceType" "MoneyServiceTransactionServiceTypeType" NOT NULL,
    "status" "MoneyServiceTransactionStatusType" NOT NULL,
    "cashDirection" "MoneyServiceTransactionCashDirectionType" NOT NULL,
    "faceAmountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "cashAmountCents" INTEGER NOT NULL DEFAULT 0,
    "providerSettlementCents" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "registerSession" TEXT,
    "employee" TEXT,
    "externalVoidReference" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyServiceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyServiceSettlement" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "provider" TEXT,
    "settlementNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "tradingDate" TEXT NOT NULL DEFAULT '',
    "periodStartedAt" TIMESTAMP(3) NOT NULL,
    "periodEndedAt" TIMESTAMP(3) NOT NULL,
    "status" "MoneyServiceSettlementStatusType" NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "faceAmountCents" INTEGER NOT NULL DEFAULT 0,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "cashInCents" INTEGER NOT NULL DEFAULT 0,
    "cashOutCents" INTEGER NOT NULL DEFAULT 0,
    "expectedSettlementCents" INTEGER NOT NULL DEFAULT 0,
    "reportedSettlementCents" INTEGER NOT NULL DEFAULT 0,
    "varianceCents" INTEGER NOT NULL DEFAULT 0,
    "transactionCount" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyServiceSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransfer" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "transferNumber" TEXT NOT NULL DEFAULT '',
    "status" "InventoryTransferStatusType" NOT NULL DEFAULT 'draft',
    "sourceStore" TEXT,
    "destinationStore" TEXT,
    "sourceLocation" TEXT,
    "destinationLocation" TEXT,
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "shippedBy" TEXT,
    "receivedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransferLine" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "transfer" TEXT,
    "variant" TEXT,
    "lineNumber" INTEGER NOT NULL,
    "skuSnapshot" TEXT NOT NULL DEFAULT '',
    "titleSnapshot" TEXT NOT NULL DEFAULT '',
    "quantityRequested" DECIMAL(18,4) NOT NULL,
    "quantityShipped" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "quantityReceived" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransferLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryTransferLotAllocation" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "line" TEXT,
    "sourceLot" TEXT,
    "destinationLot" TEXT,
    "allocationKey" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(18,4) NOT NULL,
    "lotNumberSnapshot" TEXT NOT NULL DEFAULT '',
    "expiresAtSnapshot" TIMESTAMP(3),
    "unitCostCents" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryTransferLotAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReconciliation" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "paymentProvider" TEXT,
    "reconciliationNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "PaymentReconciliationStatusType" NOT NULL DEFAULT 'in_review',
    "periodStartedAt" TIMESTAMP(3) NOT NULL,
    "periodEndedAt" TIMESTAMP(3) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "capturedCents" INTEGER NOT NULL DEFAULT 0,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "reportedFeeCents" INTEGER NOT NULL DEFAULT 0,
    "expectedSettlementCents" INTEGER NOT NULL DEFAULT 0,
    "reportedSettlementCents" INTEGER NOT NULL DEFAULT 0,
    "varianceCents" INTEGER NOT NULL DEFAULT 0,
    "tenderCount" INTEGER NOT NULL DEFAULT 0,
    "exceptionCount" INTEGER NOT NULL DEFAULT 0,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReconciliationLine" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "reconciliation" TEXT,
    "tender" TEXT,
    "lineKey" TEXT NOT NULL DEFAULT '',
    "capturedCents" INTEGER NOT NULL DEFAULT 0,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "reportedFeeCents" INTEGER NOT NULL DEFAULT 0,
    "expectedSettlementCents" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReconciliationLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineDevice" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "apiKey" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "deviceCode" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "OfflineDeviceStatusType" NOT NULL DEFAULT 'active',
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineOperationBatch" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "device" TEXT,
    "batchNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "requestDigest" TEXT NOT NULL DEFAULT '',
    "status" "OfflineOperationBatchStatusType" NOT NULL,
    "firstSequence" INTEGER NOT NULL,
    "lastSequence" INTEGER NOT NULL,
    "operationCount" INTEGER NOT NULL DEFAULT 0,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "replayedCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3) NOT NULL,
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineOperationBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfflineOperation" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "batch" TEXT,
    "sequence" INTEGER NOT NULL,
    "operationKey" TEXT NOT NULL DEFAULT '',
    "operationType" TEXT NOT NULL DEFAULT '',
    "idempotencyKeyDigest" TEXT NOT NULL DEFAULT '',
    "requestDigest" TEXT NOT NULL DEFAULT '',
    "outcome" "OfflineOperationOutcomeType" NOT NULL,
    "resourceType" TEXT NOT NULL DEFAULT '',
    "resourceId" TEXT NOT NULL DEFAULT '',
    "errorCode" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfflineOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportDestination" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "type" "ExportDestinationTypeType" NOT NULL,
    "status" "ExportDestinationStatusType" NOT NULL DEFAULT 'configured',
    "adapterKey" TEXT NOT NULL DEFAULT '',
    "credentialReference" TEXT NOT NULL DEFAULT '',
    "configuration" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportBatch" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "destination" TEXT,
    "batchNumber" TEXT NOT NULL DEFAULT '',
    "type" "ExportBatchTypeType" NOT NULL,
    "status" "ExportBatchStatusType" NOT NULL,
    "periodStartedAt" TIMESTAMP(3) NOT NULL,
    "periodEndedAt" TIMESTAMP(3) NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "debitTotalCents" INTEGER NOT NULL DEFAULT 0,
    "creditTotalCents" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT NOT NULL DEFAULT '',
    "objectReference" TEXT NOT NULL DEFAULT '',
    "externalReference" TEXT NOT NULL DEFAULT '',
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "generatedBy" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureMessage" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportLine" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "batch" TEXT,
    "lineNumber" INTEGER NOT NULL,
    "accountCode" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "debitCents" INTEGER NOT NULL DEFAULT 0,
    "creditCents" INTEGER NOT NULL DEFAULT 0,
    "sourceType" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "dimensions" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MoneyServiceProvider_stores" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ExportDestination_stores" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_ApiKey_stores" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "LotteryGame_lookupKey_key" ON "LotteryGame"("lookupKey");

-- CreateIndex
CREATE INDEX "LotteryGame_business_idx" ON "LotteryGame"("business");

-- CreateIndex
CREATE INDEX "LotteryGame_gameCode_idx" ON "LotteryGame"("gameCode");

-- CreateIndex
CREATE UNIQUE INDEX "LotteryPack_lookupKey_key" ON "LotteryPack"("lookupKey");

-- CreateIndex
CREATE INDEX "LotteryPack_business_idx" ON "LotteryPack"("business");

-- CreateIndex
CREATE INDEX "LotteryPack_store_idx" ON "LotteryPack"("store");

-- CreateIndex
CREATE INDEX "LotteryPack_game_idx" ON "LotteryPack"("game");

-- CreateIndex
CREATE INDEX "LotteryPack_packNumber_idx" ON "LotteryPack"("packNumber");

-- CreateIndex
CREATE INDEX "LotteryPack_receivedBy_idx" ON "LotteryPack"("receivedBy");

-- CreateIndex
CREATE INDEX "LotteryPack_activatedBy_idx" ON "LotteryPack"("activatedBy");

-- CreateIndex
CREATE INDEX "LotteryPack_closedBy_idx" ON "LotteryPack"("closedBy");

-- CreateIndex
CREATE INDEX "LotteryPack_idempotency_idx" ON "LotteryPack"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "LotteryPackEvent_eventNumber_key" ON "LotteryPackEvent"("eventNumber");

-- CreateIndex
CREATE INDEX "LotteryPackEvent_business_idx" ON "LotteryPackEvent"("business");

-- CreateIndex
CREATE INDEX "LotteryPackEvent_store_idx" ON "LotteryPackEvent"("store");

-- CreateIndex
CREATE INDEX "LotteryPackEvent_pack_idx" ON "LotteryPackEvent"("pack");

-- CreateIndex
CREATE INDEX "LotteryPackEvent_registerSession_idx" ON "LotteryPackEvent"("registerSession");

-- CreateIndex
CREATE INDEX "LotteryPackEvent_employee_idx" ON "LotteryPackEvent"("employee");

-- CreateIndex
CREATE INDEX "LotteryPackEvent_idempotency_idx" ON "LotteryPackEvent"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "LotterySettlement_settlementNumber_key" ON "LotterySettlement"("settlementNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LotterySettlement_lookupKey_key" ON "LotterySettlement"("lookupKey");

-- CreateIndex
CREATE INDEX "LotterySettlement_business_idx" ON "LotterySettlement"("business");

-- CreateIndex
CREATE INDEX "LotterySettlement_store_idx" ON "LotterySettlement"("store");

-- CreateIndex
CREATE INDEX "LotterySettlement_tradingDate_idx" ON "LotterySettlement"("tradingDate");

-- CreateIndex
CREATE INDEX "LotterySettlement_approvedBy_idx" ON "LotterySettlement"("approvedBy");

-- CreateIndex
CREATE INDEX "LotterySettlement_idempotency_idx" ON "LotterySettlement"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyServiceProvider_lookupKey_key" ON "MoneyServiceProvider"("lookupKey");

-- CreateIndex
CREATE INDEX "MoneyServiceProvider_business_idx" ON "MoneyServiceProvider"("business");

-- CreateIndex
CREATE INDEX "MoneyServiceProvider_code_idx" ON "MoneyServiceProvider"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyServiceTransaction_transactionNumber_key" ON "MoneyServiceTransaction"("transactionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyServiceTransaction_lookupKey_key" ON "MoneyServiceTransaction"("lookupKey");

-- CreateIndex
CREATE INDEX "MoneyServiceTransaction_business_idx" ON "MoneyServiceTransaction"("business");

-- CreateIndex
CREATE INDEX "MoneyServiceTransaction_store_idx" ON "MoneyServiceTransaction"("store");

-- CreateIndex
CREATE INDEX "MoneyServiceTransaction_provider_idx" ON "MoneyServiceTransaction"("provider");

-- CreateIndex
CREATE INDEX "MoneyServiceTransaction_externalTransactionReference_idx" ON "MoneyServiceTransaction"("externalTransactionReference");

-- CreateIndex
CREATE INDEX "MoneyServiceTransaction_registerSession_idx" ON "MoneyServiceTransaction"("registerSession");

-- CreateIndex
CREATE INDEX "MoneyServiceTransaction_employee_idx" ON "MoneyServiceTransaction"("employee");

-- CreateIndex
CREATE INDEX "MoneyServiceTransaction_idempotency_idx" ON "MoneyServiceTransaction"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyServiceSettlement_settlementNumber_key" ON "MoneyServiceSettlement"("settlementNumber");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyServiceSettlement_lookupKey_key" ON "MoneyServiceSettlement"("lookupKey");

-- CreateIndex
CREATE INDEX "MoneyServiceSettlement_business_idx" ON "MoneyServiceSettlement"("business");

-- CreateIndex
CREATE INDEX "MoneyServiceSettlement_store_idx" ON "MoneyServiceSettlement"("store");

-- CreateIndex
CREATE INDEX "MoneyServiceSettlement_provider_idx" ON "MoneyServiceSettlement"("provider");

-- CreateIndex
CREATE INDEX "MoneyServiceSettlement_tradingDate_idx" ON "MoneyServiceSettlement"("tradingDate");

-- CreateIndex
CREATE INDEX "MoneyServiceSettlement_approvedBy_idx" ON "MoneyServiceSettlement"("approvedBy");

-- CreateIndex
CREATE INDEX "MoneyServiceSettlement_idempotency_idx" ON "MoneyServiceSettlement"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransfer_transferNumber_key" ON "InventoryTransfer"("transferNumber");

-- CreateIndex
CREATE INDEX "InventoryTransfer_business_idx" ON "InventoryTransfer"("business");

-- CreateIndex
CREATE INDEX "InventoryTransfer_status_idx" ON "InventoryTransfer"("status");

-- CreateIndex
CREATE INDEX "InventoryTransfer_sourceStore_idx" ON "InventoryTransfer"("sourceStore");

-- CreateIndex
CREATE INDEX "InventoryTransfer_destinationStore_idx" ON "InventoryTransfer"("destinationStore");

-- CreateIndex
CREATE INDEX "InventoryTransfer_sourceLocation_idx" ON "InventoryTransfer"("sourceLocation");

-- CreateIndex
CREATE INDEX "InventoryTransfer_destinationLocation_idx" ON "InventoryTransfer"("destinationLocation");

-- CreateIndex
CREATE INDEX "InventoryTransfer_requestedBy_idx" ON "InventoryTransfer"("requestedBy");

-- CreateIndex
CREATE INDEX "InventoryTransfer_approvedBy_idx" ON "InventoryTransfer"("approvedBy");

-- CreateIndex
CREATE INDEX "InventoryTransfer_shippedBy_idx" ON "InventoryTransfer"("shippedBy");

-- CreateIndex
CREATE INDEX "InventoryTransfer_receivedBy_idx" ON "InventoryTransfer"("receivedBy");

-- CreateIndex
CREATE INDEX "InventoryTransfer_idempotency_idx" ON "InventoryTransfer"("idempotency");

-- CreateIndex
CREATE INDEX "InventoryTransferLine_business_idx" ON "InventoryTransferLine"("business");

-- CreateIndex
CREATE INDEX "InventoryTransferLine_transfer_idx" ON "InventoryTransferLine"("transfer");

-- CreateIndex
CREATE INDEX "InventoryTransferLine_variant_idx" ON "InventoryTransferLine"("variant");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransferLotAllocation_allocationKey_key" ON "InventoryTransferLotAllocation"("allocationKey");

-- CreateIndex
CREATE INDEX "InventoryTransferLotAllocation_business_idx" ON "InventoryTransferLotAllocation"("business");

-- CreateIndex
CREATE INDEX "InventoryTransferLotAllocation_line_idx" ON "InventoryTransferLotAllocation"("line");

-- CreateIndex
CREATE INDEX "InventoryTransferLotAllocation_sourceLot_idx" ON "InventoryTransferLotAllocation"("sourceLot");

-- CreateIndex
CREATE INDEX "InventoryTransferLotAllocation_destinationLot_idx" ON "InventoryTransferLotAllocation"("destinationLot");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReconciliation_reconciliationNumber_key" ON "PaymentReconciliation"("reconciliationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReconciliation_lookupKey_key" ON "PaymentReconciliation"("lookupKey");

-- CreateIndex
CREATE INDEX "PaymentReconciliation_business_idx" ON "PaymentReconciliation"("business");

-- CreateIndex
CREATE INDEX "PaymentReconciliation_store_idx" ON "PaymentReconciliation"("store");

-- CreateIndex
CREATE INDEX "PaymentReconciliation_paymentProvider_idx" ON "PaymentReconciliation"("paymentProvider");

-- CreateIndex
CREATE INDEX "PaymentReconciliation_status_idx" ON "PaymentReconciliation"("status");

-- CreateIndex
CREATE INDEX "PaymentReconciliation_periodEndedAt_idx" ON "PaymentReconciliation"("periodEndedAt");

-- CreateIndex
CREATE INDEX "PaymentReconciliation_approvedBy_idx" ON "PaymentReconciliation"("approvedBy");

-- CreateIndex
CREATE INDEX "PaymentReconciliation_idempotency_idx" ON "PaymentReconciliation"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReconciliationLine_lineKey_key" ON "PaymentReconciliationLine"("lineKey");

-- CreateIndex
CREATE INDEX "PaymentReconciliationLine_business_idx" ON "PaymentReconciliationLine"("business");

-- CreateIndex
CREATE INDEX "PaymentReconciliationLine_store_idx" ON "PaymentReconciliationLine"("store");

-- CreateIndex
CREATE INDEX "PaymentReconciliationLine_reconciliation_idx" ON "PaymentReconciliationLine"("reconciliation");

-- CreateIndex
CREATE INDEX "PaymentReconciliationLine_tender_idx" ON "PaymentReconciliationLine"("tender");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineDevice_lookupKey_key" ON "OfflineDevice"("lookupKey");

-- CreateIndex
CREATE INDEX "OfflineDevice_business_idx" ON "OfflineDevice"("business");

-- CreateIndex
CREATE INDEX "OfflineDevice_store_idx" ON "OfflineDevice"("store");

-- CreateIndex
CREATE INDEX "OfflineDevice_apiKey_idx" ON "OfflineDevice"("apiKey");

-- CreateIndex
CREATE INDEX "OfflineDevice_deviceCode_idx" ON "OfflineDevice"("deviceCode");

-- CreateIndex
CREATE INDEX "OfflineDevice_status_idx" ON "OfflineDevice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineOperationBatch_lookupKey_key" ON "OfflineOperationBatch"("lookupKey");

-- CreateIndex
CREATE INDEX "OfflineOperationBatch_business_idx" ON "OfflineOperationBatch"("business");

-- CreateIndex
CREATE INDEX "OfflineOperationBatch_store_idx" ON "OfflineOperationBatch"("store");

-- CreateIndex
CREATE INDEX "OfflineOperationBatch_device_idx" ON "OfflineOperationBatch"("device");

-- CreateIndex
CREATE INDEX "OfflineOperationBatch_status_idx" ON "OfflineOperationBatch"("status");

-- CreateIndex
CREATE INDEX "OfflineOperationBatch_idempotency_idx" ON "OfflineOperationBatch"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineOperation_operationKey_key" ON "OfflineOperation"("operationKey");

-- CreateIndex
CREATE INDEX "OfflineOperation_business_idx" ON "OfflineOperation"("business");

-- CreateIndex
CREATE INDEX "OfflineOperation_store_idx" ON "OfflineOperation"("store");

-- CreateIndex
CREATE INDEX "OfflineOperation_batch_idx" ON "OfflineOperation"("batch");

-- CreateIndex
CREATE INDEX "OfflineOperation_operationType_idx" ON "OfflineOperation"("operationType");

-- CreateIndex
CREATE INDEX "OfflineOperation_outcome_idx" ON "OfflineOperation"("outcome");

-- CreateIndex
CREATE UNIQUE INDEX "ExportDestination_lookupKey_key" ON "ExportDestination"("lookupKey");

-- CreateIndex
CREATE INDEX "ExportDestination_business_idx" ON "ExportDestination"("business");

-- CreateIndex
CREATE INDEX "ExportDestination_code_idx" ON "ExportDestination"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ExportBatch_batchNumber_key" ON "ExportBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "ExportBatch_business_idx" ON "ExportBatch"("business");

-- CreateIndex
CREATE INDEX "ExportBatch_store_idx" ON "ExportBatch"("store");

-- CreateIndex
CREATE INDEX "ExportBatch_destination_idx" ON "ExportBatch"("destination");

-- CreateIndex
CREATE INDEX "ExportBatch_externalReference_idx" ON "ExportBatch"("externalReference");

-- CreateIndex
CREATE INDEX "ExportBatch_generatedBy_idx" ON "ExportBatch"("generatedBy");

-- CreateIndex
CREATE INDEX "ExportBatch_idempotency_idx" ON "ExportBatch"("idempotency");

-- CreateIndex
CREATE INDEX "ExportLine_business_idx" ON "ExportLine"("business");

-- CreateIndex
CREATE INDEX "ExportLine_store_idx" ON "ExportLine"("store");

-- CreateIndex
CREATE INDEX "ExportLine_batch_idx" ON "ExportLine"("batch");

-- CreateIndex
CREATE INDEX "ExportLine_sourceId_idx" ON "ExportLine"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "_MoneyServiceProvider_stores_AB_unique" ON "_MoneyServiceProvider_stores"("A", "B");

-- CreateIndex
CREATE INDEX "_MoneyServiceProvider_stores_B_index" ON "_MoneyServiceProvider_stores"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ExportDestination_stores_AB_unique" ON "_ExportDestination_stores"("A", "B");

-- CreateIndex
CREATE INDEX "_ExportDestination_stores_B_index" ON "_ExportDestination_stores"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ApiKey_stores_AB_unique" ON "_ApiKey_stores"("A", "B");

-- CreateIndex
CREATE INDEX "_ApiKey_stores_B_index" ON "_ApiKey_stores"("B");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyPrefix_key" ON "ApiKey"("keyPrefix");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_providerLookupKey_key" ON "Refund"("providerLookupKey");

-- CreateIndex
CREATE UNIQUE INDEX "Tender_providerLookupKey_key" ON "Tender"("providerLookupKey");

-- CreateIndex
CREATE UNIQUE INDEX "_CartLine_promotions_AB_unique" ON "_CartLine_promotions"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_Cart_promotions_AB_unique" ON "_Cart_promotions"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_CompliancePolicy_categories_AB_unique" ON "_CompliancePolicy_categories"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_CompliancePolicy_products_AB_unique" ON "_CompliancePolicy_products"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_CompliancePolicy_stores_AB_unique" ON "_CompliancePolicy_stores"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_Employee_stores_AB_unique" ON "_Employee_stores"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_PriceBook_stores_AB_unique" ON "_PriceBook_stores"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_Product_categories_AB_unique" ON "_Product_categories"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_PromotionRule_categories_AB_unique" ON "_PromotionRule_categories"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_PromotionRule_products_AB_unique" ON "_PromotionRule_products"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_Promotion_stores_AB_unique" ON "_Promotion_stores"("A", "B");

-- AddForeignKey
ALTER TABLE "LotteryGame" ADD CONSTRAINT "LotteryGame_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPack" ADD CONSTRAINT "LotteryPack_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPack" ADD CONSTRAINT "LotteryPack_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPack" ADD CONSTRAINT "LotteryPack_game_fkey" FOREIGN KEY ("game") REFERENCES "LotteryGame"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPack" ADD CONSTRAINT "LotteryPack_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPack" ADD CONSTRAINT "LotteryPack_activatedBy_fkey" FOREIGN KEY ("activatedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPack" ADD CONSTRAINT "LotteryPack_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPack" ADD CONSTRAINT "LotteryPack_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPackEvent" ADD CONSTRAINT "LotteryPackEvent_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPackEvent" ADD CONSTRAINT "LotteryPackEvent_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPackEvent" ADD CONSTRAINT "LotteryPackEvent_pack_fkey" FOREIGN KEY ("pack") REFERENCES "LotteryPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPackEvent" ADD CONSTRAINT "LotteryPackEvent_registerSession_fkey" FOREIGN KEY ("registerSession") REFERENCES "RegisterSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPackEvent" ADD CONSTRAINT "LotteryPackEvent_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotteryPackEvent" ADD CONSTRAINT "LotteryPackEvent_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotterySettlement" ADD CONSTRAINT "LotterySettlement_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotterySettlement" ADD CONSTRAINT "LotterySettlement_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotterySettlement" ADD CONSTRAINT "LotterySettlement_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LotterySettlement" ADD CONSTRAINT "LotterySettlement_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceProvider" ADD CONSTRAINT "MoneyServiceProvider_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceTransaction" ADD CONSTRAINT "MoneyServiceTransaction_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceTransaction" ADD CONSTRAINT "MoneyServiceTransaction_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceTransaction" ADD CONSTRAINT "MoneyServiceTransaction_provider_fkey" FOREIGN KEY ("provider") REFERENCES "MoneyServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceTransaction" ADD CONSTRAINT "MoneyServiceTransaction_registerSession_fkey" FOREIGN KEY ("registerSession") REFERENCES "RegisterSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceTransaction" ADD CONSTRAINT "MoneyServiceTransaction_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceTransaction" ADD CONSTRAINT "MoneyServiceTransaction_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceSettlement" ADD CONSTRAINT "MoneyServiceSettlement_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceSettlement" ADD CONSTRAINT "MoneyServiceSettlement_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceSettlement" ADD CONSTRAINT "MoneyServiceSettlement_provider_fkey" FOREIGN KEY ("provider") REFERENCES "MoneyServiceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceSettlement" ADD CONSTRAINT "MoneyServiceSettlement_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyServiceSettlement" ADD CONSTRAINT "MoneyServiceSettlement_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_sourceStore_fkey" FOREIGN KEY ("sourceStore") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_destinationStore_fkey" FOREIGN KEY ("destinationStore") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_sourceLocation_fkey" FOREIGN KEY ("sourceLocation") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_destinationLocation_fkey" FOREIGN KEY ("destinationLocation") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_shippedBy_fkey" FOREIGN KEY ("shippedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransfer" ADD CONSTRAINT "InventoryTransfer_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferLine" ADD CONSTRAINT "InventoryTransferLine_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferLine" ADD CONSTRAINT "InventoryTransferLine_transfer_fkey" FOREIGN KEY ("transfer") REFERENCES "InventoryTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferLine" ADD CONSTRAINT "InventoryTransferLine_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferLotAllocation" ADD CONSTRAINT "InventoryTransferLotAllocation_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferLotAllocation" ADD CONSTRAINT "InventoryTransferLotAllocation_line_fkey" FOREIGN KEY ("line") REFERENCES "InventoryTransferLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferLotAllocation" ADD CONSTRAINT "InventoryTransferLotAllocation_sourceLot_fkey" FOREIGN KEY ("sourceLot") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryTransferLotAllocation" ADD CONSTRAINT "InventoryTransferLotAllocation_destinationLot_fkey" FOREIGN KEY ("destinationLot") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_paymentProvider_fkey" FOREIGN KEY ("paymentProvider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationLine" ADD CONSTRAINT "PaymentReconciliationLine_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationLine" ADD CONSTRAINT "PaymentReconciliationLine_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationLine" ADD CONSTRAINT "PaymentReconciliationLine_reconciliation_fkey" FOREIGN KEY ("reconciliation") REFERENCES "PaymentReconciliation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReconciliationLine" ADD CONSTRAINT "PaymentReconciliationLine_tender_fkey" FOREIGN KEY ("tender") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineDevice" ADD CONSTRAINT "OfflineDevice_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineDevice" ADD CONSTRAINT "OfflineDevice_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineDevice" ADD CONSTRAINT "OfflineDevice_apiKey_fkey" FOREIGN KEY ("apiKey") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineOperationBatch" ADD CONSTRAINT "OfflineOperationBatch_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineOperationBatch" ADD CONSTRAINT "OfflineOperationBatch_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineOperationBatch" ADD CONSTRAINT "OfflineOperationBatch_device_fkey" FOREIGN KEY ("device") REFERENCES "OfflineDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineOperationBatch" ADD CONSTRAINT "OfflineOperationBatch_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineOperation" ADD CONSTRAINT "OfflineOperation_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineOperation" ADD CONSTRAINT "OfflineOperation_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfflineOperation" ADD CONSTRAINT "OfflineOperation_batch_fkey" FOREIGN KEY ("batch") REFERENCES "OfflineOperationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportDestination" ADD CONSTRAINT "ExportDestination_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_destination_fkey" FOREIGN KEY ("destination") REFERENCES "ExportDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportLine" ADD CONSTRAINT "ExportLine_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportLine" ADD CONSTRAINT "ExportLine_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExportLine" ADD CONSTRAINT "ExportLine_batch_fkey" FOREIGN KEY ("batch") REFERENCES "ExportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MoneyServiceProvider_stores" ADD CONSTRAINT "_MoneyServiceProvider_stores_A_fkey" FOREIGN KEY ("A") REFERENCES "MoneyServiceProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MoneyServiceProvider_stores" ADD CONSTRAINT "_MoneyServiceProvider_stores_B_fkey" FOREIGN KEY ("B") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExportDestination_stores" ADD CONSTRAINT "_ExportDestination_stores_A_fkey" FOREIGN KEY ("A") REFERENCES "ExportDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ExportDestination_stores" ADD CONSTRAINT "_ExportDestination_stores_B_fkey" FOREIGN KEY ("B") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApiKey_stores" ADD CONSTRAINT "_ApiKey_stores_A_fkey" FOREIGN KEY ("A") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ApiKey_stores" ADD CONSTRAINT "_ApiKey_stores_B_fkey" FOREIGN KEY ("B") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

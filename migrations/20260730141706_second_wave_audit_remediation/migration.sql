BEGIN;

/*
  Warnings:

  - The primary key for the `_ApiKey_stores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_CartLine_promotions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Cart_promotions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_CompliancePolicy_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_CompliancePolicy_products` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_CompliancePolicy_stores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Employee_stores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_ExportDestination_stores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_MoneyServiceProvider_stores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_PriceBook_stores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Product_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_PromotionRule_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_PromotionRule_products` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `_Promotion_stores` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_ApiKey_stores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_CartLine_promotions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Cart_promotions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_CompliancePolicy_categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_CompliancePolicy_products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_CompliancePolicy_stores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Employee_stores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_ExportDestination_stores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_MoneyServiceProvider_stores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_PriceBook_stores` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Product_categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_PromotionRule_categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_PromotionRule_products` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[A,B]` on the table `_Promotion_stores` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "RefundTenderAllocationMethodType" AS ENUM ('cash', 'credit_card', 'debit_card', 'ebt_snap', 'ebt_cash', 'gift_card', 'house_account', 'mobile_wallet', 'fleet_card', 'loyalty', 'other');

-- CreateEnum
CREATE TYPE "RefundTenderAllocationStatusType" AS ENUM ('completed', 'voided');

-- AlterEnum
ALTER TYPE "TenderMethodType" ADD VALUE 'loyalty';

-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "loyaltyPointsToRedeem" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "loyaltyRedemptionCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CartLine" ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ExportBatch" ADD COLUMN     "artifactContent" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "artifactFilename" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "artifactSizeBytes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PrepBatch" ADD COLUMN     "actualCostCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;

-- Legacy role-bearing users were intentionally not auto-approved. Remove the
-- dormant flag as well so approval can only be granted by an explicit owner
-- bootstrap/intervention path.
UPDATE "User"
SET "isPlatformAdmin" = false
WHERE "platformAdminApprovedAt" IS NULL;

-- AlterTable
ALTER TABLE "_ApiKey_stores" DROP CONSTRAINT "_ApiKey_stores_AB_pkey";

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
ALTER TABLE "_ExportDestination_stores" DROP CONSTRAINT "_ExportDestination_stores_AB_pkey";

-- AlterTable
ALTER TABLE "_MoneyServiceProvider_stores" DROP CONSTRAINT "_MoneyServiceProvider_stores_AB_pkey";

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
CREATE TABLE "RefundTenderAllocation" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "refund" TEXT,
    "tender" TEXT,
    "method" "RefundTenderAllocationMethodType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "status" "RefundTenderAllocationStatusType" NOT NULL DEFAULT 'completed',
    "providerRefundId" TEXT NOT NULL DEFAULT '',
    "providerLookupKey" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundTenderAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefundTenderAllocation_providerLookupKey_key" ON "RefundTenderAllocation"("providerLookupKey");

-- CreateIndex
CREATE INDEX "RefundTenderAllocation_business_idx" ON "RefundTenderAllocation"("business");

-- CreateIndex
CREATE INDEX "RefundTenderAllocation_store_idx" ON "RefundTenderAllocation"("store");

-- CreateIndex
CREATE INDEX "RefundTenderAllocation_refund_idx" ON "RefundTenderAllocation"("refund");

-- CreateIndex
CREATE INDEX "RefundTenderAllocation_tender_idx" ON "RefundTenderAllocation"("tender");

-- CreateIndex
CREATE UNIQUE INDEX "_ApiKey_stores_AB_unique" ON "_ApiKey_stores"("A", "B");

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
CREATE UNIQUE INDEX "_ExportDestination_stores_AB_unique" ON "_ExportDestination_stores"("A", "B");

-- CreateIndex
CREATE UNIQUE INDEX "_MoneyServiceProvider_stores_AB_unique" ON "_MoneyServiceProvider_stores"("A", "B");

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
ALTER TABLE "RefundTenderAllocation" ADD CONSTRAINT "RefundTenderAllocation_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundTenderAllocation" ADD CONSTRAINT "RefundTenderAllocation_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundTenderAllocation" ADD CONSTRAINT "RefundTenderAllocation_refund_fkey" FOREIGN KEY ("refund") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundTenderAllocation" ADD CONSTRAINT "RefundTenderAllocation_tender_fkey" FOREIGN KEY ("tender") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

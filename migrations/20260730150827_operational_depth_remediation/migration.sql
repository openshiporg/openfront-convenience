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
CREATE TYPE "OperationalHeartbeatKindType" AS ENUM ('outbox', 'alerts', 'backup');

-- CreateEnum
CREATE TYPE "OperationalHeartbeatStatusType" AS ENUM ('healthy', 'failed');

-- AlterEnum
ALTER TYPE "StoreDayLineDimensionType" ADD VALUE 'merchandise';

-- AlterTable
ALTER TABLE "InventoryCountLine" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "lotNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "unitCostCents" INTEGER;

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
CREATE TABLE "OperationalHeartbeat" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "heartbeatKey" TEXT NOT NULL DEFAULT '',
    "kind" "OperationalHeartbeatKindType" NOT NULL,
    "status" "OperationalHeartbeatStatusType" NOT NULL,
    "workerId" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "details" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalHeartbeat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OperationalHeartbeat_heartbeatKey_key" ON "OperationalHeartbeat"("heartbeatKey");

-- CreateIndex
CREATE INDEX "OperationalHeartbeat_business_idx" ON "OperationalHeartbeat"("business");

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
ALTER TABLE "OperationalHeartbeat" ADD CONSTRAINT "OperationalHeartbeat_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

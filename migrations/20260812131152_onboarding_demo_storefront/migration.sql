BEGIN;

-- CreateEnum
CREATE TYPE "BusinessStorefrontModeType" AS ENUM ('demo', 'live');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "storefrontMode" "BusinessStorefrontModeType" NOT NULL DEFAULT 'demo',
ADD COLUMN     "storefrontStore" TEXT;

-- CreateIndex
CREATE INDEX "Business_storefrontStore_idx" ON "Business"("storefrontStore");

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_storefrontStore_fkey" FOREIGN KEY ("storefrontStore") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;

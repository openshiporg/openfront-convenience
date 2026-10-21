BEGIN;

-- CreateEnum
CREATE TYPE "BusinessStorefrontStatusType" AS ENUM ('draft', 'published');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "storefrontStatus" "BusinessStorefrontStatusType" NOT NULL DEFAULT 'draft',
ALTER COLUMN "brandAccentColor" SET DEFAULT '',
ALTER COLUMN "brandMark" SET DEFAULT '',
ALTER COLUMN "brandName" SET DEFAULT '',
ALTER COLUMN "brandPrimaryColor" SET DEFAULT '';

-- The prior storefront attempt populated unowned public identity and theme
-- values. None of those values were owner-published, so reset the complete
-- projection rather than treating inferred or demo copy as business truth.
UPDATE "Business"
SET "brandName" = '',
    "brandTagline" = '',
    "brandMark" = '',
    "brandPrimaryColor" = '',
    "brandAccentColor" = '',
    "storefrontStatus" = 'draft';

-- This deployment has one root public storefront. Keep publication explicit
-- and race-safe instead of selecting an arbitrary business.
CREATE UNIQUE INDEX "Business_single_published_storefront_key"
ON "Business" ("storefrontStatus")
WHERE "storefrontStatus" = 'published';

COMMIT;

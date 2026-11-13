-- Storefront mode (demo/live) is removed: every storefront is live.
ALTER TABLE "Business" DROP COLUMN "storefrontMode";
DROP TYPE "BusinessStorefrontModeType";

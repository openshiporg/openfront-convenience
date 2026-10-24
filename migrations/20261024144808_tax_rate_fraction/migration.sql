BEGIN;

-- Tax rates move from integer basis points to a fraction, as E-commerce stores
-- them (825 bp -> 0.0825; 8.875% -> 0.08875). Existing rates and line snapshots
-- are converted in place so no stored rate changes meaning. Money math turns the
-- fraction back into exact integer parts per million (features/keystone/lib/money.ts).
--
-- Generated with migrate:gen against the scratch database, then reduced to these
-- columns: Prisma's draft dropped and re-added them (losing every rate) and also
-- proposed join-table key changes that are pre-existing drift, not part of this.

ALTER TABLE "TaxRate" ADD COLUMN "rate" DOUBLE PRECISION;
UPDATE "TaxRate" SET "rate" = "rateBasisPoints" / 10000.0;
ALTER TABLE "TaxRate" ALTER COLUMN "rate" SET NOT NULL;
ALTER TABLE "TaxRate" DROP COLUMN "rateBasisPoints";

ALTER TABLE "CartLine" ADD COLUMN "taxRate" DOUBLE PRECISION DEFAULT 0;
UPDATE "CartLine" SET "taxRate" = CASE WHEN "taxRateBasisPoints" IS NULL THEN NULL ELSE "taxRateBasisPoints" / 10000.0 END;
ALTER TABLE "CartLine" DROP COLUMN "taxRateBasisPoints";

ALTER TABLE "SaleLine" ADD COLUMN "taxRate" DOUBLE PRECISION DEFAULT 0;
UPDATE "SaleLine" SET "taxRate" = CASE WHEN "taxRateBasisPoints" IS NULL THEN NULL ELSE "taxRateBasisPoints" / 10000.0 END;
ALTER TABLE "SaleLine" DROP COLUMN "taxRateBasisPoints";

COMMIT;

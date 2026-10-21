BEGIN;

-- Additive family branding fields; existing identity and operational data stay intact.
ALTER TABLE "Business" ADD COLUMN "logoColor" TEXT NOT NULL DEFAULT '0',
ADD COLUMN "logoIcon" TEXT NOT NULL DEFAULT '';

COMMIT;

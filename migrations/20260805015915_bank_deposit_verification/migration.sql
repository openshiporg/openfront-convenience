BEGIN;

-- A deposited bag can receive its asynchronous bank confirmation after the
-- associated StoreDay is locked. Keep all accounting/source fields immutable
-- while permitting exactly one deposited -> verified evidence append.
CREATE OR REPLACE FUNCTION "ofc_reject_locked_bank_deposit_source"() RETURNS trigger AS $$
DECLARE
  old_is_locked boolean := false;
  new_is_locked boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' AND OLD."depositedAt" IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM "StoreDay"
      WHERE "business" = OLD."business"
        AND "store" = OLD."store"
        AND "status" = 'locked'
        AND "periodStartedAt" <= OLD."depositedAt"
        AND "periodEndedAt" > OLD."depositedAt"
    ) INTO old_is_locked;
  END IF;

  IF TG_OP <> 'DELETE' AND NEW."depositedAt" IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM "StoreDay"
      WHERE "business" = NEW."business"
        AND "store" = NEW."store"
        AND "status" = 'locked'
        AND "periodStartedAt" <= NEW."depositedAt"
        AND "periodEndedAt" > NEW."depositedAt"
    ) INTO new_is_locked;
  END IF;

  IF TG_OP = 'UPDATE'
    AND old_is_locked
    AND new_is_locked
    AND OLD."status" = 'deposited'
    AND NEW."status" = 'verified'
    AND OLD."verifiedAt" IS NULL
    AND OLD."verifiedBy" IS NULL
    AND NEW."verifiedAt" IS NOT NULL
    AND NEW."verifiedAt" >= NEW."depositedAt"
    AND NEW."verifiedBy" IS NOT NULL
    AND btrim(NEW."bankReference") <> ''
    AND (
      to_jsonb(NEW) - ARRAY[
        'status',
        'bankReference',
        'verifiedBy',
        'verifiedAt',
        'notes',
        'updatedAt'
      ]::text[]
    ) IS NOT DISTINCT FROM (
      to_jsonb(OLD) - ARRAY[
        'status',
        'bankReference',
        'verifiedBy',
        'verifiedAt',
        'notes',
        'updatedAt'
      ]::text[]
    )
  THEN
    RETURN NEW;
  END IF;

  IF old_is_locked OR new_is_locked THEN
    RAISE EXCEPTION 'closed store-day period rejects % source mutation', TG_TABLE_NAME USING ERRCODE = '23514';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ofc_bank_deposit_store_day_fence" ON "BankDeposit";
CREATE TRIGGER "ofc_bank_deposit_store_day_fence"
  BEFORE INSERT OR UPDATE OR DELETE ON "BankDeposit"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_bank_deposit_source"();

COMMIT;

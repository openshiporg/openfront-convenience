BEGIN;

-- Locked StoreDay rows and their detail lines are accounting evidence. Keep the
-- application lifecycle as the primary writer while rejecting direct/future
-- mutations after lock at the database boundary.
CREATE OR REPLACE FUNCTION "ofc_reject_locked_store_day_evidence"() RETURNS trigger AS $$
DECLARE
  old_doc jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  new_doc jsonb := CASE WHEN TG_OP = 'DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
BEGIN
  IF TG_TABLE_NAME = 'StoreDay' THEN
    IF old_doc ->> 'status' = 'locked' THEN
      RAISE EXCEPTION 'locked store day rejects direct evidence mutation' USING ERRCODE = '23514';
    END IF;
  ELSIF EXISTS (
    SELECT 1
    FROM "StoreDay" AS day
    WHERE day.status = 'locked'
      AND day.id IN (
        NULLIF(old_doc ->> 'storeDay', ''),
        NULLIF(new_doc ->> 'storeDay', '')
      )
  ) THEN
    RAISE EXCEPTION 'locked store day rejects detail evidence mutation' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ofc_locked_store_day_evidence_fence" ON "StoreDay";
CREATE TRIGGER "ofc_locked_store_day_evidence_fence"
  BEFORE UPDATE OR DELETE ON "StoreDay"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_store_day_evidence"();

DROP TRIGGER IF EXISTS "ofc_locked_store_day_line_evidence_fence" ON "StoreDayLine";
CREATE TRIGGER "ofc_locked_store_day_line_evidence_fence"
  BEFORE INSERT OR UPDATE OR DELETE ON "StoreDayLine"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_store_day_evidence"();

COMMIT;

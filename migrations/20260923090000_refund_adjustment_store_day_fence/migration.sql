BEGIN;

-- RefundTenderAllocation is the append-only current-period adjustment ledger.
-- Its period is inherited from the linked Refund.processedAt; do not let later
-- edits rewrite a locked store day's adjustment evidence.
CREATE OR REPLACE FUNCTION "ofc_reject_locked_refund_adjustment"() RETURNS trigger AS $$
DECLARE
  refund_id text;
  refund_business text;
  refund_store text;
  refund_processed_at timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    refund_id := OLD."refund";
    SELECT "business", "store", "processedAt"
      INTO refund_business, refund_store, refund_processed_at
      FROM "Refund"
      WHERE id = refund_id;
    IF refund_processed_at IS NOT NULL AND EXISTS (
      SELECT 1
      FROM "StoreDay"
      WHERE "business" = refund_business
        AND "store" = refund_store
        AND "status" = 'locked'
        AND "periodStartedAt" <= refund_processed_at
        AND "periodEndedAt" > refund_processed_at
    ) THEN
      RAISE EXCEPTION 'closed store-day period rejects refund adjustment mutation' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    refund_id := NEW."refund";
    SELECT "business", "store", "processedAt"
      INTO refund_business, refund_store, refund_processed_at
      FROM "Refund"
      WHERE id = refund_id;
    IF refund_processed_at IS NOT NULL AND EXISTS (
      SELECT 1
      FROM "StoreDay"
      WHERE "business" = refund_business
        AND "store" = refund_store
        AND "status" = 'locked'
        AND "periodStartedAt" <= refund_processed_at
        AND "periodEndedAt" > refund_processed_at
    ) THEN
      RAISE EXCEPTION 'closed store-day period rejects refund adjustment mutation' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ofc_refund_adjustment_store_day_fence" ON "RefundTenderAllocation";
CREATE TRIGGER "ofc_refund_adjustment_store_day_fence"
  BEFORE INSERT OR UPDATE OR DELETE ON "RefundTenderAllocation"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_refund_adjustment"();

COMMIT;

BEGIN;

-- Keep fuel source fences aligned with the application-wide half-open
-- settlement convention. Opening/closing tank readings are boundary evidence
-- and remain protected at both endpoints; deliveries and dispenses belong to
-- [periodStartedAt, periodEndedAt).
CREATE OR REPLACE FUNCTION "ofc_reject_locked_fuel_source"() RETURNS trigger AS $$
DECLARE row_doc jsonb; event_at timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    row_doc := to_jsonb(OLD); event_at := NULLIF(row_doc ->> TG_ARGV[0], '')::timestamptz;
    IF event_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM "FuelReconciliation" AS reconciliation
      WHERE reconciliation."business" = row_doc ->> 'business'
        AND reconciliation."store" = row_doc ->> 'store'
        AND reconciliation."site" = row_doc ->> 'site'
        AND reconciliation."status" = 'locked'
        AND (
          (TG_TABLE_NAME = 'FuelTankReading'
            AND reconciliation."periodStartedAt" <= event_at
            AND reconciliation."periodEndedAt" >= event_at)
          OR (TG_TABLE_NAME <> 'FuelTankReading'
            AND reconciliation."periodStartedAt" <= event_at
            AND reconciliation."periodEndedAt" > event_at)
        )
        AND (
          (TG_TABLE_NAME IN ('FuelDelivery', 'FuelTankReading') AND reconciliation."tank" = row_doc ->> 'tank')
          OR (TG_TABLE_NAME = 'FuelTransaction' AND EXISTS (
            SELECT 1 FROM "FuelNozzle" AS nozzle
            WHERE nozzle.id = row_doc ->> 'nozzle'
              AND nozzle."tank" = reconciliation."tank"
          ))
        )
    ) THEN
      RAISE EXCEPTION 'closed fuel reconciliation rejects source mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    row_doc := to_jsonb(NEW); event_at := NULLIF(row_doc ->> TG_ARGV[0], '')::timestamptz;
    IF event_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM "FuelReconciliation" AS reconciliation
      WHERE reconciliation."business" = row_doc ->> 'business'
        AND reconciliation."store" = row_doc ->> 'store'
        AND reconciliation."site" = row_doc ->> 'site'
        AND reconciliation."status" = 'locked'
        AND (
          (TG_TABLE_NAME = 'FuelTankReading'
            AND reconciliation."periodStartedAt" <= event_at
            AND reconciliation."periodEndedAt" >= event_at)
          OR (TG_TABLE_NAME <> 'FuelTankReading'
            AND reconciliation."periodStartedAt" <= event_at
            AND reconciliation."periodEndedAt" > event_at)
        )
        AND (
          (TG_TABLE_NAME IN ('FuelDelivery', 'FuelTankReading') AND reconciliation."tank" = row_doc ->> 'tank')
          OR (TG_TABLE_NAME = 'FuelTransaction' AND EXISTS (
            SELECT 1 FROM "FuelNozzle" AS nozzle
            WHERE nozzle.id = row_doc ->> 'nozzle'
              AND nozzle."tank" = reconciliation."tank"
          ))
        )
    ) THEN
      RAISE EXCEPTION 'closed fuel reconciliation rejects source mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- A cash preauthorization belongs to its originating till until it is either
-- cancelled or linked to a completed dispense. Closing the till first would
-- make a short-dispense cash release impossible through supported operations.
CREATE OR REPLACE FUNCTION "ofc_reject_unresolved_cash_fuel_close"() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'closed' AND OLD.status <> 'closed' AND EXISTS (
    SELECT 1
    FROM "Sale" AS sale
    WHERE sale."registerSession" = NEW.id
      AND sale.status = 'completed'
      AND sale.metadata ->> 'purpose' = 'fuel_authorization'
      AND EXISTS (
        SELECT 1 FROM "Tender" AS tender
        WHERE tender.sale = sale.id
          AND tender.method = 'cash'
          AND tender.status = 'captured'
          AND tender."refundedCents" = 0
      )
      AND NOT EXISTS (
        SELECT 1 FROM "FuelTransaction" AS fuel
        WHERE fuel.sale = sale.id
      )
  ) THEN
    RAISE EXCEPTION 'register close rejects unresolved cash fuel authorization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ofc_unresolved_fuel_authorization_register_fence" ON "RegisterSession";
CREATE TRIGGER "ofc_unresolved_fuel_authorization_register_fence"
  BEFORE UPDATE ON "RegisterSession"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_unresolved_cash_fuel_close"();

COMMIT;

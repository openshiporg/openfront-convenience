BEGIN;

/*
  Reviewed additive constraints:
  - Employee business/user membership must be unique.
  - Fuel controller evidence and tender linkage must each be unique.
  The migration preflight rejects retained duplicate data instead of deleting it.
*/
-- DropIndex
DROP INDEX "InventoryLedgerEntry_wasteEvent_key";

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "brandAccentColor" TEXT NOT NULL DEFAULT '#F4B942',
ADD COLUMN     "brandMark" TEXT NOT NULL DEFAULT 'CO',
ADD COLUMN     "brandName" TEXT NOT NULL DEFAULT 'Convenience operator',
ADD COLUMN     "brandPrimaryColor" TEXT NOT NULL DEFAULT '#153F34',
ADD COLUMN     "brandTagline" TEXT NOT NULL DEFAULT '';

-- Preserve each retained operator's identity instead of assigning a generic
-- shared label during the additive brand migration.
UPDATE "Business" SET "brandName" = "name";

-- Relation-table composite primary keys are intentionally retained. Prisma's
-- generated unique-index churn is equivalent for cardinality but would weaken
-- the checked relation-primary-key invariant during deployment.

-- CreateIndex
CREATE UNIQUE INDEX "Employee_business_user_key" ON "Employee"("business", "user");

-- CreateIndex
CREATE UNIQUE INDEX "FuelTransaction_site_controller_key" ON "FuelTransaction"("site", "controllerTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "FuelTransaction_tender_key" ON "FuelTransaction"("tender");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_wasteEvent_idx" ON "InventoryLedgerEntry"("wasteEvent");

-- Closed operational periods are an evidence boundary, not merely a UI state.
-- Source rows cannot be inserted, deleted, backdated, or economically rewritten
-- into a period after its reconciliation has reached a controlled terminal state.
CREATE FUNCTION "ofc_reject_settlement_over_locked_store_day"() RETURNS trigger AS $$
DECLARE row_doc jsonb;
BEGIN
  IF TG_OP <> 'DELETE' THEN
    row_doc := to_jsonb(NEW);
    IF (row_doc ->> 'status') = ANY(string_to_array(TG_ARGV[0], ','))
      AND EXISTS (
        SELECT 1 FROM "StoreDay"
        WHERE "business" = row_doc ->> 'business'
          AND "store" = row_doc ->> 'store'
          AND "status" = 'locked'
          AND "periodStartedAt" < NULLIF(row_doc ->> 'periodEndedAt', '')::timestamptz
          AND "periodEndedAt" > NULLIF(row_doc ->> 'periodStartedAt', '')::timestamptz
      ) THEN
      RAISE EXCEPTION 'settlement approval cannot change a locked store day' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ofc_fuel_settlement_store_day_fence" BEFORE INSERT OR UPDATE ON "FuelReconciliation"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_settlement_over_locked_store_day"('locked');
CREATE TRIGGER "ofc_lottery_settlement_store_day_fence" BEFORE INSERT OR UPDATE ON "LotterySettlement"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_settlement_over_locked_store_day"('approved,exported');
CREATE TRIGGER "ofc_money_service_settlement_store_day_fence" BEFORE INSERT OR UPDATE ON "MoneyServiceSettlement"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_settlement_over_locked_store_day"('approved,exported');
CREATE TRIGGER "ofc_payment_settlement_store_day_fence" BEFORE INSERT OR UPDATE ON "PaymentReconciliation"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_settlement_over_locked_store_day"('approved,exported');

CREATE FUNCTION "ofc_reject_locked_store_day_source"() RETURNS trigger AS $$
DECLARE
  row_doc jsonb;
  event_at timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    row_doc := to_jsonb(OLD);
    event_at := COALESCE(NULLIF(row_doc ->> TG_ARGV[0], '')::timestamptz, CASE WHEN TG_NARGS > 1 THEN NULLIF(row_doc ->> TG_ARGV[1], '')::timestamptz ELSE NULL END);
    IF event_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM "StoreDay"
      WHERE "business" = row_doc ->> 'business'
        AND "store" = row_doc ->> 'store'
        AND "status" = 'locked'
        AND "periodStartedAt" <= event_at
        AND "periodEndedAt" > event_at
    ) THEN
      RAISE EXCEPTION 'closed store-day period rejects % source mutation', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    row_doc := to_jsonb(NEW);
    event_at := COALESCE(NULLIF(row_doc ->> TG_ARGV[0], '')::timestamptz, CASE WHEN TG_NARGS > 1 THEN NULLIF(row_doc ->> TG_ARGV[1], '')::timestamptz ELSE NULL END);
    IF event_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM "StoreDay"
      WHERE "business" = row_doc ->> 'business'
        AND "store" = row_doc ->> 'store'
        AND "status" = 'locked'
        AND "periodStartedAt" <= event_at
        AND "periodEndedAt" > event_at
    ) THEN
      RAISE EXCEPTION 'closed store-day period rejects % source mutation', TG_TABLE_NAME USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ofc_refund_store_day_fence" BEFORE INSERT OR UPDATE OR DELETE ON "Refund"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_store_day_source"('processedAt');
CREATE TRIGGER "ofc_cash_movement_store_day_fence" BEFORE INSERT OR UPDATE OR DELETE ON "CashMovement"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_store_day_source"('occurredAt');
CREATE TRIGGER "ofc_register_session_store_day_fence" BEFORE INSERT OR UPDATE OR DELETE ON "RegisterSession"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_store_day_source"('closedAt', 'openedAt');
CREATE TRIGGER "ofc_bank_deposit_store_day_fence" BEFORE INSERT OR UPDATE OR DELETE ON "BankDeposit"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_store_day_source"('depositedAt');
CREATE TRIGGER "ofc_sale_store_day_insert_delete_fence" BEFORE INSERT OR DELETE ON "Sale"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_store_day_source"('completedAt', 'startedAt');
CREATE TRIGGER "ofc_tender_store_day_fence" BEFORE INSERT OR UPDATE OR DELETE ON "Tender"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_store_day_source"('processedAt');
CREATE TRIGGER "ofc_fuel_transaction_store_day_fence" BEFORE INSERT OR UPDATE OR DELETE ON "FuelTransaction"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_store_day_source"('completedAt');
CREATE TRIGGER "ofc_lottery_event_store_day_fence" BEFORE INSERT OR UPDATE OR DELETE ON "LotteryPackEvent"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_store_day_source"('occurredAt');
CREATE TRIGGER "ofc_money_service_transaction_store_day_fence" BEFORE INSERT OR UPDATE OR DELETE ON "MoneyServiceTransaction"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_store_day_source"('occurredAt');

CREATE FUNCTION "ofc_reject_locked_sale_rewrite"() RETURNS trigger AS $$
DECLARE
  event_at timestamptz;
BEGIN
  IF NEW."business" IS DISTINCT FROM OLD."business"
    OR NEW."store" IS DISTINCT FROM OLD."store"
    OR NEW."completedAt" IS DISTINCT FROM OLD."completedAt"
    OR NEW."currencyCode" IS DISTINCT FROM OLD."currencyCode"
    OR NEW."subtotalCents" IS DISTINCT FROM OLD."subtotalCents"
    OR NEW."discountCents" IS DISTINCT FROM OLD."discountCents"
    OR NEW."taxCents" IS DISTINCT FROM OLD."taxCents"
    OR NEW."roundingCents" IS DISTINCT FROM OLD."roundingCents"
    OR NEW."totalCents" IS DISTINCT FROM OLD."totalCents"
    OR (NEW."status" = 'voided' AND OLD."status" <> 'voided') THEN
    event_at := COALESCE(OLD."completedAt", OLD."startedAt");
    IF EXISTS (
      SELECT 1 FROM "StoreDay"
      WHERE "business" = OLD."business" AND "store" = OLD."store"
        AND "status" = 'locked'
        AND "periodStartedAt" <= event_at AND "periodEndedAt" > event_at
    ) THEN
      RAISE EXCEPTION 'closed store-day period rejects Sale economic rewrite' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ofc_sale_store_day_update_fence" BEFORE UPDATE ON "Sale"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_sale_rewrite"();

CREATE FUNCTION "ofc_reject_locked_fuel_source"() RETURNS trigger AS $$
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
        AND reconciliation."periodEndedAt" >= event_at
        AND (
          (TG_TABLE_NAME = 'FuelTankReading' AND reconciliation."periodStartedAt" <= event_at)
          OR (TG_TABLE_NAME <> 'FuelTankReading' AND reconciliation."periodStartedAt" < event_at)
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
        AND reconciliation."periodEndedAt" >= event_at
        AND (
          (TG_TABLE_NAME = 'FuelTankReading' AND reconciliation."periodStartedAt" <= event_at)
          OR (TG_TABLE_NAME <> 'FuelTankReading' AND reconciliation."periodStartedAt" < event_at)
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
CREATE TRIGGER "ofc_fuel_reconciliation_source_fence" BEFORE INSERT OR UPDATE OR DELETE ON "FuelTransaction"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_fuel_source"('completedAt');
CREATE TRIGGER "ofc_fuel_delivery_reconciliation_source_fence" BEFORE INSERT OR UPDATE OR DELETE ON "FuelDelivery"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_fuel_source"('deliveredAt');
CREATE TRIGGER "ofc_fuel_reading_reconciliation_source_fence" BEFORE INSERT OR UPDATE OR DELETE ON "FuelTankReading"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_fuel_source"('measuredAt');

CREATE FUNCTION "ofc_reject_locked_lottery_source"() RETURNS trigger AS $$
DECLARE row_doc jsonb; event_at timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    row_doc := to_jsonb(OLD); event_at := NULLIF(row_doc ->> 'occurredAt', '')::timestamptz;
    IF event_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM "LotterySettlement" AS settlement
      WHERE settlement."business" = row_doc ->> 'business'
        AND settlement."store" = row_doc ->> 'store'
        AND settlement."status" IN ('approved', 'exported')
        AND settlement."periodStartedAt" <= event_at
        AND settlement."periodEndedAt" > event_at
        AND EXISTS (
          SELECT 1 FROM "LotteryPack" AS pack
          JOIN "LotteryGame" AS game ON game.id = pack.game
          WHERE pack.id = row_doc ->> 'pack'
            AND lower(game."operatorName") = lower(settlement."operatorName")
        )
    ) THEN
      RAISE EXCEPTION 'closed lottery settlement rejects source mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    row_doc := to_jsonb(NEW); event_at := NULLIF(row_doc ->> 'occurredAt', '')::timestamptz;
    IF event_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM "LotterySettlement" AS settlement
      WHERE settlement."business" = row_doc ->> 'business'
        AND settlement."store" = row_doc ->> 'store'
        AND settlement."status" IN ('approved', 'exported')
        AND settlement."periodStartedAt" <= event_at
        AND settlement."periodEndedAt" > event_at
        AND EXISTS (
          SELECT 1 FROM "LotteryPack" AS pack
          JOIN "LotteryGame" AS game ON game.id = pack.game
          WHERE pack.id = row_doc ->> 'pack'
            AND lower(game."operatorName") = lower(settlement."operatorName")
        )
    ) THEN
      RAISE EXCEPTION 'closed lottery settlement rejects source mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ofc_lottery_settlement_source_fence" BEFORE INSERT OR UPDATE OR DELETE ON "LotteryPackEvent"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_lottery_source"();

CREATE FUNCTION "ofc_reject_locked_money_service_source"() RETURNS trigger AS $$
DECLARE row_doc jsonb; event_at timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    row_doc := to_jsonb(OLD); event_at := NULLIF(row_doc ->> 'occurredAt', '')::timestamptz;
    IF event_at IS NOT NULL AND EXISTS (SELECT 1 FROM "MoneyServiceSettlement" WHERE "business" = row_doc ->> 'business' AND "store" = row_doc ->> 'store' AND "provider" = row_doc ->> 'provider' AND "status" IN ('approved', 'exported') AND "periodStartedAt" <= event_at AND "periodEndedAt" > event_at) THEN
      RAISE EXCEPTION 'closed money-service settlement rejects source mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    row_doc := to_jsonb(NEW); event_at := NULLIF(row_doc ->> 'occurredAt', '')::timestamptz;
    IF event_at IS NOT NULL AND EXISTS (SELECT 1 FROM "MoneyServiceSettlement" WHERE "business" = row_doc ->> 'business' AND "store" = row_doc ->> 'store' AND "provider" = row_doc ->> 'provider' AND "status" IN ('approved', 'exported') AND "periodStartedAt" <= event_at AND "periodEndedAt" > event_at) THEN
      RAISE EXCEPTION 'closed money-service settlement rejects source mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ofc_money_service_settlement_source_fence" BEFORE INSERT OR UPDATE OR DELETE ON "MoneyServiceTransaction"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_money_service_source"();

CREATE FUNCTION "ofc_reject_locked_payment_source"() RETURNS trigger AS $$
DECLARE row_doc jsonb; event_at timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    row_doc := to_jsonb(OLD); event_at := NULLIF(row_doc ->> 'processedAt', '')::timestamptz;
    IF event_at IS NOT NULL AND EXISTS (SELECT 1 FROM "PaymentReconciliation" WHERE "business" = row_doc ->> 'business' AND "store" = row_doc ->> 'store' AND "paymentProvider" = row_doc ->> 'paymentProvider' AND "status" IN ('approved', 'exported') AND "periodStartedAt" <= event_at AND "periodEndedAt" > event_at) THEN
      RAISE EXCEPTION 'closed payment reconciliation rejects source mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    row_doc := to_jsonb(NEW); event_at := NULLIF(row_doc ->> 'processedAt', '')::timestamptz;
    IF event_at IS NOT NULL AND EXISTS (SELECT 1 FROM "PaymentReconciliation" WHERE "business" = row_doc ->> 'business' AND "store" = row_doc ->> 'store' AND "paymentProvider" = row_doc ->> 'paymentProvider' AND "status" IN ('approved', 'exported') AND "periodStartedAt" <= event_at AND "periodEndedAt" > event_at) THEN
      RAISE EXCEPTION 'closed payment reconciliation rejects source mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ofc_payment_reconciliation_source_fence" BEFORE INSERT OR UPDATE OR DELETE ON "Tender"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_payment_source"();

CREATE FUNCTION "ofc_reject_locked_payment_refund"() RETURNS trigger AS $$
DECLARE row_doc jsonb; event_at timestamptz;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    row_doc := to_jsonb(OLD); event_at := NULLIF(row_doc ->> 'processedAt', '')::timestamptz;
    IF event_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM "PaymentReconciliation" AS reconciliation
      WHERE reconciliation."business" = row_doc ->> 'business'
        AND reconciliation."store" = row_doc ->> 'store'
        AND reconciliation."status" IN ('approved', 'exported')
        AND reconciliation."periodStartedAt" <= event_at
        AND reconciliation."periodEndedAt" > event_at
        AND (
          EXISTS (SELECT 1 FROM "Tender" WHERE id = row_doc ->> 'originalTender' AND "paymentProvider" = reconciliation."paymentProvider")
          OR EXISTS (
            SELECT 1 FROM "RefundTenderAllocation" AS allocation
            JOIN "Tender" AS tender ON tender.id = allocation.tender
            WHERE allocation.refund = row_doc ->> 'id'
              AND tender."paymentProvider" = reconciliation."paymentProvider"
          )
        )
    ) THEN
      RAISE EXCEPTION 'closed payment reconciliation rejects refund source mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    row_doc := to_jsonb(NEW); event_at := NULLIF(row_doc ->> 'processedAt', '')::timestamptz;
    IF event_at IS NOT NULL AND EXISTS (
      SELECT 1 FROM "PaymentReconciliation" AS reconciliation
      WHERE reconciliation."business" = row_doc ->> 'business'
        AND reconciliation."store" = row_doc ->> 'store'
        AND reconciliation."status" IN ('approved', 'exported')
        AND reconciliation."periodStartedAt" <= event_at
        AND reconciliation."periodEndedAt" > event_at
        AND (
          EXISTS (SELECT 1 FROM "Tender" WHERE id = row_doc ->> 'originalTender' AND "paymentProvider" = reconciliation."paymentProvider")
          OR EXISTS (
            SELECT 1 FROM "RefundTenderAllocation" AS allocation
            JOIN "Tender" AS tender ON tender.id = allocation.tender
            WHERE allocation.refund = row_doc ->> 'id'
              AND tender."paymentProvider" = reconciliation."paymentProvider"
          )
        )
    ) THEN
      RAISE EXCEPTION 'closed payment reconciliation rejects refund source mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ofc_payment_refund_reconciliation_source_fence" BEFORE INSERT OR UPDATE OR DELETE ON "Refund"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_payment_refund"();

CREATE FUNCTION "ofc_reject_locked_payment_refund_allocation"() RETURNS trigger AS $$
DECLARE row_doc jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    row_doc := to_jsonb(OLD);
    IF EXISTS (
      SELECT 1
      FROM "Refund" AS refund
      JOIN "Tender" AS tender ON tender.id = row_doc ->> 'tender'
      JOIN "PaymentReconciliation" AS reconciliation
        ON reconciliation."business" = refund.business
       AND reconciliation."store" = refund.store
       AND reconciliation."paymentProvider" = tender."paymentProvider"
      WHERE refund.id = row_doc ->> 'refund'
        AND reconciliation."status" IN ('approved', 'exported')
        AND reconciliation."periodStartedAt" <= refund."processedAt"
        AND reconciliation."periodEndedAt" > refund."processedAt"
    ) THEN
      RAISE EXCEPTION 'closed payment reconciliation rejects refund allocation mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    row_doc := to_jsonb(NEW);
    IF EXISTS (
      SELECT 1
      FROM "Refund" AS refund
      JOIN "Tender" AS tender ON tender.id = row_doc ->> 'tender'
      JOIN "PaymentReconciliation" AS reconciliation
        ON reconciliation."business" = refund.business
       AND reconciliation."store" = refund.store
       AND reconciliation."paymentProvider" = tender."paymentProvider"
      WHERE refund.id = row_doc ->> 'refund'
        AND reconciliation."status" IN ('approved', 'exported')
        AND reconciliation."periodStartedAt" <= refund."processedAt"
        AND reconciliation."periodEndedAt" > refund."processedAt"
    ) THEN
      RAISE EXCEPTION 'closed payment reconciliation rejects refund allocation mutation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ofc_payment_refund_allocation_reconciliation_source_fence" BEFORE INSERT OR UPDATE OR DELETE ON "RefundTenderAllocation"
  FOR EACH ROW EXECUTE FUNCTION "ofc_reject_locked_payment_refund_allocation"();


COMMIT;

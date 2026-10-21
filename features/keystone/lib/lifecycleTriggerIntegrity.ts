import { Prisma, type PrismaClient } from "@prisma/client";

export const REQUIRED_LIFECYCLE_TRIGGER_BINDINGS = [
  { name: "ofc_bank_deposit_store_day_fence", table: "BankDeposit", function: "ofc_reject_locked_bank_deposit_source" },
  { name: "ofc_cash_movement_store_day_fence", table: "CashMovement", function: "ofc_reject_locked_store_day_source" },
  { name: "ofc_fuel_delivery_reconciliation_source_fence", table: "FuelDelivery", function: "ofc_reject_locked_fuel_source" },
  { name: "ofc_fuel_settlement_store_day_fence", table: "FuelReconciliation", function: "ofc_reject_settlement_over_locked_store_day" },
  { name: "ofc_fuel_transaction_store_day_fence", table: "FuelTransaction", function: "ofc_reject_locked_store_day_source" },
  { name: "ofc_fuel_reconciliation_source_fence", table: "FuelTransaction", function: "ofc_reject_locked_fuel_source" },
  { name: "ofc_fuel_reading_reconciliation_source_fence", table: "FuelTankReading", function: "ofc_reject_locked_fuel_source" },
  { name: "ofc_locked_store_day_evidence_fence", table: "StoreDay", function: "ofc_reject_locked_store_day_evidence" },
  { name: "ofc_locked_store_day_line_evidence_fence", table: "StoreDayLine", function: "ofc_reject_locked_store_day_evidence" },
  { name: "ofc_lottery_event_store_day_fence", table: "LotteryPackEvent", function: "ofc_reject_locked_store_day_source" },
  { name: "ofc_lottery_settlement_source_fence", table: "LotteryPackEvent", function: "ofc_reject_locked_lottery_source" },
  { name: "ofc_lottery_settlement_store_day_fence", table: "LotterySettlement", function: "ofc_reject_settlement_over_locked_store_day" },
  { name: "ofc_money_service_settlement_source_fence", table: "MoneyServiceTransaction", function: "ofc_reject_locked_money_service_source" },
  { name: "ofc_money_service_transaction_store_day_fence", table: "MoneyServiceTransaction", function: "ofc_reject_locked_store_day_source" },
  { name: "ofc_money_service_settlement_store_day_fence", table: "MoneyServiceSettlement", function: "ofc_reject_settlement_over_locked_store_day" },
  { name: "ofc_payment_reconciliation_source_fence", table: "Tender", function: "ofc_reject_locked_payment_source" },
  { name: "ofc_payment_settlement_store_day_fence", table: "PaymentReconciliation", function: "ofc_reject_settlement_over_locked_store_day" },
  { name: "ofc_payment_refund_allocation_reconciliation_source_fence", table: "RefundTenderAllocation", function: "ofc_reject_locked_payment_refund_allocation" },
  { name: "ofc_payment_refund_reconciliation_source_fence", table: "Refund", function: "ofc_reject_locked_payment_refund" },
  { name: "ofc_refund_adjustment_store_day_fence", table: "RefundTenderAllocation", function: "ofc_reject_locked_refund_adjustment" },
  { name: "ofc_refund_store_day_fence", table: "Refund", function: "ofc_reject_locked_store_day_source" },
  { name: "ofc_register_session_store_day_fence", table: "RegisterSession", function: "ofc_reject_locked_store_day_source" },
  { name: "ofc_sale_store_day_insert_delete_fence", table: "Sale", function: "ofc_reject_locked_store_day_source" },
  { name: "ofc_sale_store_day_update_fence", table: "Sale", function: "ofc_reject_locked_sale_rewrite" },
  { name: "ofc_tender_store_day_fence", table: "Tender", function: "ofc_reject_locked_store_day_source" },
  { name: "ofc_unresolved_fuel_authorization_register_fence", table: "RegisterSession", function: "ofc_reject_unresolved_cash_fuel_close" },
] as const;

export const REQUIRED_LIFECYCLE_TRIGGERS =
  REQUIRED_LIFECYCLE_TRIGGER_BINDINGS.map((binding) => binding.name);

type TriggerRow = {
  name: string;
  tableName: string;
  functionName: string;
  enabled: string;
};
type QueryClient = Pick<PrismaClient, "$queryRaw"> | Prisma.TransactionClient;

export function invalidLifecycleTriggerBindings(
  rows: readonly TriggerRow[],
): string[] {
  const byName = new Map<string, TriggerRow[]>();
  for (const row of rows) {
    const matches = byName.get(row.name) ?? [];
    matches.push(row);
    byName.set(row.name, matches);
  }
  return REQUIRED_LIFECYCLE_TRIGGER_BINDINGS.filter((expected) => {
    const matches = byName.get(expected.name) ?? [];
    return (
      matches.length !== 1 ||
      matches[0].tableName !== expected.table ||
      matches[0].functionName !== expected.function ||
      !["O", "A"].includes(matches[0].enabled)
    );
  }).map((binding) => binding.name);
}

export async function assertRequiredLifecycleTriggers(
  client: QueryClient,
): Promise<void> {
  const rows = await client.$queryRaw<TriggerRow[]>(Prisma.sql`
    SELECT
      trg.tgname AS name,
      tbl.relname AS "tableName",
      fn.proname AS "functionName",
      trg.tgenabled AS enabled
    FROM pg_trigger AS trg
    JOIN pg_class AS tbl ON tbl.oid = trg.tgrelid
    JOIN pg_namespace AS ns ON ns.oid = tbl.relnamespace
    JOIN pg_proc AS fn ON fn.oid = trg.tgfoid
    WHERE NOT trg.tgisinternal
      AND ns.nspname = current_schema()
      AND trg.tgname IN (${Prisma.join(REQUIRED_LIFECYCLE_TRIGGERS)})
  `);
  const invalid = invalidLifecycleTriggerBindings(rows);
  if (invalid.length) {
    throw new Error(
      `Required lifecycle triggers are missing, disabled, duplicated, or bound incorrectly: ${invalid.join(", ")}`,
    );
  }
}

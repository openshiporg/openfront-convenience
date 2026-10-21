export const REQUIRED_RELEASE_MIGRATIONS = [
  "20250529211349_initial_migration",
  "20250618162316_add_description_field_to_todo",
  "20250621232051_add_all_fields",
  "20250704004833_add_image_field",
  "20250704011715_make_todoimage_a_separate_model",
  "20250806014640_update_user_to_include_reset_token_field",
  "20250815215522_add_multi_select_field_to_todo_model",
  "20260718080427_convenience_operations",
  "20260718083436_return_lot_allocations",
  "20260718152009_store_day_fuel_reconciliation",
  "20260719124946_durable_operation_outbox",
  "20260730080535_launch_operations",
  "20260730082330_relation_primary_keys",
  "20260730115247_launch_audit_remediation",
  "20260730141706_second_wave_audit_remediation",
  "20260730141800_restore_relation_primary_keys",
  "20260730150827_operational_depth_remediation",
  "20260730150900_restore_relation_primary_keys",
  "20260804165030_batch5_launch_closure",
  "20260804223000_round3_audit_closure",
  "20260805000000_round4_audit_closure",
  "20260805015915_bank_deposit_verification",
  "20260811175141_storefront_settings_ownership",
  "20260812131152_onboarding_demo_storefront",
  "20260923090000_refund_adjustment_store_day_fence",
  "20261019155600_store_logo",
] as const;

export type AppliedMigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  rolled_back_at: Date | null;
};

export function missingRequiredMigrations(
  rows: readonly AppliedMigrationRow[],
): string[] {
  const applied = new Set(
    rows
      .filter((row) => row.finished_at !== null && row.rolled_back_at === null)
      .map((row) => row.migration_name),
  );
  return REQUIRED_RELEASE_MIGRATIONS.filter((name) => !applied.has(name));
}

export function hasUnresolvedMigrationFailure(
  rows: readonly AppliedMigrationRow[],
): boolean {
  return rows.some(
    (row) => row.finished_at === null && row.rolled_back_at === null,
  );
}

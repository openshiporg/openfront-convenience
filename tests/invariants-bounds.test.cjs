// Round 2 invariants: the database holds the bounds the fields and commands promise, and a refusal
// from one of those rules reaches the cashier as a sentence, not "Unexpected error".
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const root = path.join(__dirname, '..');
const migration = fs.readFileSync(path.join(root, 'migrations/20261108200000_invariants_bounds_windows_uniques/migration.sql'), 'utf8');

function loadTs(rel) {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', out)(mod, mod.exports, require);
  return mod.exports;
}

test('every field minimum is mirrored by a NOT VALID CHECK', () => {
  for (const [list, field] of [['Sale', 'refundedCents'], ['Tender', 'amountCents'], ['StockLevel', 'parQuantity'], ['InventoryLot', 'quantityRemaining'], ['RegisterSession', 'expectedCashCents'], ['FuelTank', 'currentVolumeGallons'], ['LotteryPack', 'ticketsSold'], ['CartLine', 'quantity']]) {
    assert.match(migration, new RegExp(`"${list}" ADD CONSTRAINT "${list}_bounds_check" CHECK \\([^;]*"${field}" >= `), `${list}.${field}`);
  }
  assert.doesNotMatch(migration, /CHECK \([^;]*\) (?!NOT VALID)[^;]*;/);
});

test('cross-column, window and one-live rules exist', () => {
  for (const name of ['Sale_refund_within_total_check', 'Tender_refund_within_amount_check', 'PromotionRule_percentage_check', 'FuelTank_within_capacity_check', 'LotteryPack_ticket_range_check', 'PurchaseOrderLine_received_within_ordered_check', 'Shift_window_check', 'PriceBookEntry_window_check', 'FuelPrice_window_check', 'RegisterSession_one_live_per_register_key', 'Shift_one_live_per_employee_key', 'FuelTransaction_one_live_per_nozzle_key', 'ProductBarcode_one_primary_per_variant_key']) {
    assert.ok(migration.includes(`"${name}"`), name);
  }
  // A $0 opening float is a real cash movement, and on-hand stock may go negative where a variant allows it.
  assert.doesNotMatch(migration, /CashMovement_amount_positive_check/);
  assert.doesNotMatch(migration, /"onHandQuantity" >=/);
});

test('constraint refusals become readable messages; other errors pass through untouched', () => {
  const { constraintRefusal } = loadTs('features/keystone/lib/constraintRefusal.ts');
  const check = (name) => ({ message: `ConnectorError(... message: "new row for relation \\"X\\" violates check constraint \\"${name}\\"" ...)` });
  assert.equal(constraintRefusal(check('PromotionRule_percentage_check')).message, 'A percentage promotion can take at most 100% off');
  assert.equal(constraintRefusal(check('Shift_window_check')).message, 'The end must be after the start');
  assert.equal(constraintRefusal(check('Tender_refund_within_amount_check')).message, 'Refund exceeds the amount paid');
  assert.equal(constraintRefusal(check('RegisterSession_bounds_check')).message, 'Register cash cannot go below zero');
  assert.equal(constraintRefusal(check('SaleLine_bounds_check')).message, 'Amounts and quantities cannot be negative');
  assert.equal(constraintRefusal({ code: 'P2010', meta: { message: 'ERROR: new row for relation "Tender" violates check constraint "Tender_refund_within_amount_check"' } }).message, 'Refund exceeds the amount paid');
  assert.equal(constraintRefusal({ code: 'P2002', meta: { modelName: 'RegisterSession', target: ['register'] } }).message, 'Register already has an active session');
  assert.equal(constraintRefusal({ code: 'P2002', meta: { modelName: 'Shift', target: ['employee'] } }).message, 'Employee already has an open shift');
  assert.equal(constraintRefusal({ code: 'P2002', meta: { modelName: 'Sale', target: ['receiptNumber'] } }), null);
  assert.equal(constraintRefusal(new TypeError('x is undefined')), null);
  assert.equal(constraintRefusal(null), null);
});

test('the operation runner translates constraint refusals', () => {
  const src = fs.readFileSync(path.join(root, 'features/keystone/mutations/operationRunner.ts'), 'utf8');
  assert.match(src, /throw constraintRefusal\(error\) \?\? error;/);
});

test('configurePromotion refuses more than 100% off before writing', () => {
  const src = fs.readFileSync(path.join(root, 'features/keystone/mutations/catalogOperations.ts'), 'utf8');
  assert.match(src, /valueBasisPoints > 10_000\)\s*throw new Error\("A percentage promotion can take at most 100% off"\)/);
});

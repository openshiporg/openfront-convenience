// Every declared lifecycle map is enforced: the shared guards refuse illegal moves and stay idempotent on replays.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'features/keystone/lib/transitionPolicy.ts'), 'utf8');
const mod = { exports: {} };
new Function('module', 'exports', 'require', ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(mod, mod.exports, require);
const p = mod.exports;

test('terminal states cannot move', () => {
  assert.throws(() => p.evaluateTransition(p.SALE_TRANSITIONS, 'voided', 'completed'));
  assert.throws(() => p.evaluateTransition(p.CART_TRANSITIONS, 'converted', 'open'));
  assert.throws(() => p.evaluateTransition(p.TENDER_TRANSITIONS, 'refunded', 'captured'));
  assert.throws(() => p.evaluateTransition(p.PREP_BATCH_TRANSITIONS, 'discarded', 'completed'));
});

test('replaying the same status is allowed (idempotent)', () => {
  assert.deepEqual(p.evaluateTransition(p.SALE_TRANSITIONS, 'partially_refunded', 'partially_refunded'), { replay: true });
});

test('transitionGuard refuses illegal updates but ignores creates and same-state writes', () => {
  const errors = [];
  const g = p.transitionGuard(p.REFUND_TRANSITIONS, 'Refund');
  g.validateInput({ operation: 'update', item: { status: 'completed' }, resolvedData: { status: 'requested' }, addValidationError: (m) => errors.push(m) });
  g.validateInput({ operation: 'update', item: { status: 'completed' }, resolvedData: { status: 'completed' }, addValidationError: (m) => errors.push(m) });
  g.validateInput({ operation: 'create', resolvedData: { status: 'completed' }, addValidationError: (m) => errors.push(m) });
  g.validateInput({ operation: 'update', item: { status: 'requested' }, resolvedData: { notes: 'x' }, addValidationError: (m) => errors.push(m) });
  assert.deepEqual(errors, ['Refund cannot move from completed to requested']);
});

test('moveStatus is a compare-and-set: a lost race fails loudly, a replay is a no-op', async () => {
  const calls = [];
  const delegate = (count) => ({ updateMany: async (a) => { calls.push(a); return { count }; } });
  assert.equal(await p.moveStatus(delegate(1), p.CART_TRANSITIONS, { id: 'c' }, 'open', 'converted'), true);
  assert.deepEqual(calls[0], { where: { id: 'c', status: 'open' }, data: { status: 'converted' } });
  assert.equal(await p.moveStatus(delegate(1), p.CART_TRANSITIONS, { id: 'c' }, 'converted', 'converted'), false);
  assert.equal(calls.length, 1);
  await assert.rejects(p.moveStatus(delegate(0), p.CART_TRANSITIONS, { id: 'c' }, 'open', 'voided'), /changed while moving/);
  await assert.rejects(p.moveStatus(delegate(1), p.CART_TRANSITIONS, { id: 'c' }, 'voided', 'open'), /Cannot transition/);
});

test('every writer of the eight formerly unenforced machines imports the policy', () => {
  const read = (f) => fs.readFileSync(path.join(root, 'features/keystone', f), 'utf8');
  for (const [file, name] of [['models/Receiving.ts','RECEIVING'],['models/Cart.ts','CART'],['models/Sale.ts','SALE'],['models/Tender.ts','TENDER'],['models/Refund.ts','REFUND'],['models/Return.ts','RETURN'],['models/PrepBatch.ts','PREP_BATCH'],['models/FuelTransaction.ts','FUEL_TRANSACTION']]) {
    assert.match(read(file), new RegExp(`${name}_TRANSITIONS`), file);
  }
  assert.match(read('mutations/posOperations.ts'), /CART_TRANSITIONS/);
  assert.match(read('mutations/refundOperations.ts'), /TENDER_TRANSITIONS/);
  assert.match(read('mutations/fuelOperations.ts'), /TENDER_TRANSITIONS/);
  assert.match(read('mutations/foodserviceOperations.ts'), /PREP_BATCH_TRANSITIONS/);
});

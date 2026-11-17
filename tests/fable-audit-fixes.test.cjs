// Fable audit fixes: a refused POS operation can be discarded; a retired pickup payment never replays.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const source = fs.readFileSync(path.resolve(root, relative), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', 'require', output)(module, module.exports, require);
  return module.exports;
}

const { performRetainedRetail } = load('features/platform/pos/retainedRetail.ts');
const identity = { userId: 'user_12345678', businessId: 'biz_12345678', storeId: 'store_12345678' };
const intent = { version: 1, ...identity, purpose: 'refundPosSale', key: 'key_12345678', fields: { saleId: 's1' } };
function vault() {
  let stored = null; const confirmed = [];
  return { confirmed, load: async () => stored, save: async (value) => { stored = value; }, confirm: async (value, receipt) => { confirmed.push(receipt); stored = null; } };
}

test('a server refusal with no record under the key is reported and discardable', async () => {
  const v = vault();
  const result = await performRetainedRetail(v, identity, 'new', intent, {
    read: async () => ({ state: 'not_found', retryable: false, id: null, status: null, reference: null }),
    submit: async () => 'closed store-day period rejects Tender source mutation',
  });
  assert.equal(result.receipt, null);
  assert.equal(result.discardable, true);
  assert.match(result.refusal, /store-day/);
});

test('an unknown outcome (network failure) is never discardable', async () => {
  const v = vault();
  const result = await performRetainedRetail(v, identity, 'new', intent, {
    read: async () => { throw new Error('offline'); },
    submit: async () => { throw new Error('offline'); },
  });
  assert.equal(result.discardable, false);
  assert.equal(result.refusal, null);
});

test('a processing outcome is never discardable', async () => {
  const v = vault();
  const result = await performRetainedRetail(v, identity, 'retry', null, {
    read: async () => ({ state: 'processing', retryable: false }),
    submit: async () => null,
  }).catch(() => null);
  // retry with nothing stored is refused outright
  assert.equal(result, null);
  await v.save(intent);
  const again = await performRetainedRetail(v, identity, 'retry', null, {
    read: async () => ({ state: 'processing', retryable: false }),
    submit: async () => null,
  });
  assert.equal(again.discardable, false);
});

test('the vault keeps one pending slot per account and store', () => {
  const source = fs.readFileSync(path.resolve(root, 'features/platform/pos/retailVault.ts'), 'utf8');
  assert.match(source, /`pending:\$\{historyId\}`/);
  assert.match(source, /async discard\(intent:RetailIntent\)/);
});

test('a retired pickup payment changes the Stripe idempotency key', () => {
  const source = fs.readFileSync(path.resolve(root, 'features/keystone/mutations/pickupOperations.ts'), 'utf8');
  assert.match(source, /idempotencyKey = `pickup-\$\{cart\.id\}-\$\{revision\.slice\(0, 24\)\}\$\{retired \? `-\$\{retired\}` : ""\}`/);
  assert.match(source, /pickupRetired: payment\.paymentId/);
});

test('refunds skip the Tender write inside a locked store day or closed reconciliation', () => {
  const source = fs.readFileSync(path.resolve(root, 'features/keystone/mutations/refundOperations.ts'), 'utf8');
  const skip = source.indexOf('if (await tenderPeriodClosed(transaction, tender))');
  const write = source.indexOf('const moved = await transaction.tender.updateMany');
  assert.ok(skip > 0 && skip < write);
  assert.match(source, /storeDay\.count\(\{ where: \{ \.\.\.window, status: "locked" \} \}\)/);
  assert.match(source, /status: \{ in: \["approved", "exported"\] \}/);
});

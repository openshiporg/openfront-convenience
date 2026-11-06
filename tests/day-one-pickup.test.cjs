// Day-one pickup behaviour: online orders stop at zero shelf stock, made-to-order items
// are not shelf stock, and a closed store quotes its next opening time for pickup.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function loadTs(relative, mocks = {}) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', out)((s) => { if (s in mocks) return mocks[s]; throw new Error(`Unmocked ${s}`); }, module, module.exports);
  return module.exports;
}

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const { openStatus } = loadTs('features/storefront/lib/open-now.ts', { './storefront-settings': { STOREFRONT_DAYS: DAYS } });
const hours = Object.fromEntries(DAYS.map((d) => [d, '6am - 11pm']));

test('at 1am a 6am-11pm store is closed and opens at 6am, which pickup copy quotes', () => {
  const status = openStatus(hours, 'America/New_York', new Date('2026-11-06T06:00:00Z')); // 1am New York, Friday
  assert.equal(status.open, false);
  assert.equal(status.label, 'Closed · opens 6am');
});

test('after closing, pickup is quoted for tomorrow', () => {
  const status = openStatus(hours, 'America/New_York', new Date('2026-11-07T04:30:00Z')); // 11:30pm Friday
  assert.equal(status.label, 'Closed · opens tomorrow 6am');
});

test('open stores keep the plain ready-for-pickup state', () => {
  assert.equal(openStatus(hours, 'America/New_York', new Date('2026-11-06T15:00:00Z')).open, true);
});

test('online baskets refuse quantities above shelf stock; the catalog says Sold out', () => {
  const ops = fs.readFileSync(path.join(root, 'features/keystone/mutations/storefrontOperations.ts'), 'utf8');
  assert.match(ops, /variant\.trackInventory && !variant\.allowNegativeInventory[\s\S]{0,600}input\.quantity > onHand[\s\S]{0,80}"Sold out"/);
  assert.match(ops, /variant\.allowNegativeInventory \? "ask" : "sold_out"/);
});

test('the demo seed counts shelf goods without overselling and leaves made-to-order items untracked', () => {
  const seed = fs.readFileSync(path.join(root, 'features/keystone/mutations/onboardConvenienceBusiness.ts'), 'utf8');
  assert.doesNotMatch(seed, /allowNegativeInventory: true/);
  assert.equal((seed.match(/trackInventory: !productSeed\.preparedFood/g) || []).length, 2);
});

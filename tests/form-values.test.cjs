// Node's built-in test runner: the dashboard form conversions (dollars → cents,
// $/gal → mills, store-local time → ISO with offset). No network or env.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function load(relative) {
  const filename = path.resolve(root, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, Intl, Date, Number, String }, { filename });
  return module.exports;
}

const values = load('features/platform/lib/form-values.ts');
const labels = load('features/platform/lib/labels.ts');

test('dollar amounts become integer cents', () => {
  assert.equal(values.centsFromInput('17.07'), 1707);
  assert.equal(values.centsFromInput('$1,234.5'), 123450);
  assert.equal(values.centsFromInput('100'), 10000);
  assert.equal(values.centsFromInput('.99'), 99);
  assert.equal(values.centsFromInput('-3'), -300);
  assert.throws(() => values.centsFromInput('1.234'));
  assert.throws(() => values.centsFromInput('abc'));
  assert.throws(() => values.centsFromInput(''));
});

test('fuel prices become mills', () => {
  assert.equal(values.millsFromInput('3.599'), 3599);
  assert.equal(values.millsFromInput('$4'), 4000);
  assert.throws(() => values.millsFromInput('3.5999'));
});

test('store-local times carry the store offset, across DST', () => {
  assert.equal(values.zonedIso('2026-07-29T08:00', 'America/New_York'), '2026-07-29T08:00:00-04:00');
  assert.equal(values.zonedIso('2026-12-01T08:00', 'America/New_York'), '2026-12-01T08:00:00-05:00');
  assert.equal(values.zonedIso('2026-07-29T08:00', 'Asia/Kolkata'), '2026-07-29T08:00:00+05:30');
  assert.equal(values.zonedIso('2026-07-29T08:00:00-04:00', 'UTC'), '2026-07-29T08:00:00-04:00');
});

test('conversion is chosen by field name', () => {
  assert.equal(values.convertFormValue('openingCashCents', '100', 'UTC'), '10000');
  assert.equal(values.convertFormValue('amountCents2', '1.79', 'UTC'), '179');
  assert.equal(values.convertFormValue('priceMillsPerGallon', '3.599', 'UTC'), '3599');
  assert.equal(values.convertFormValue('startsAt', '2026-07-29T08:00', 'America/Chicago'), '2026-07-29T08:00:00-05:00');
  assert.equal(values.convertFormValue('notes', '12.5', 'UTC'), '12.5');
});

test('references and quantities read as labels', () => {
  assert.equal(labels.shortRef('CART-c11b2d04-544b-4a1e-9c1d-2f3e4a5b6c7d'), 'Basket C11B2D');
  assert.equal(labels.shortRef('OWNER-L7J2TWVF'), 'OWNER-L7J2TWVF');
  assert.equal(labels.quantityText('1.0000'), '1');
  assert.equal(labels.quantityText('0.5000'), '0.5');
  assert.equal(labels.quantityText('100.0000'), '100');
});

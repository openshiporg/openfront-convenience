// Customer pages must not use native date/time inputs or <select>; use popover controls.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

test('storefront has no native select or date/time inputs', () => {
  const files = [...walk(path.join(root, 'app/(shop)')), ...walk(path.join(root, 'features/storefront'))];
  assert.ok(files.length > 0);
  const banned = /<select[\s>]|type=\{?["'](date|time|datetime-local|month|week)["']/;
  const hits = files.filter((f) => banned.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(root, f));
  assert.deepEqual(hits, []);
});

// Sign-up duplicate detection and the sign-in form's error paths (source-level, no network).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('only the User.email unique failure counts as a duplicate account', () => {
  const out = ts.transpileModule(read('features/storefront/lib/auth-errors.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const m = { exports: {} };
  new Function('module', 'exports', out)(m, m.exports);
  assert.equal(m.exports.isDuplicateEmail('A record with this email already exists.'), true);
  assert.equal(m.exports.isDuplicateEmail('A record with this name already exists.'), false);
  assert.equal(m.exports.isDuplicateEmail('Request failed'), false);
});

test('sign-up and sign-in failures each have a visible message', () => {
  const page = read('features/storefront/screens/ShopPages.tsx');
  const actions = read('features/storefront/actions.ts');
  assert.match(page, /exists: "An account with this email already exists\."/);
  for (const key of ['signin', 'unavailable', 'signup']) assert.match(actions + page, new RegExp(`error=${key}`));
  assert.match(page, /unavailable: "/);
});

test('the sign-in password has no minimum length, so a short or older password reaches the server and gets the error', () => {
  const page = read('features/storefront/screens/ShopPages.tsx');
  assert.match(page, /minLength=\{signup \? 10 : undefined\}/);
});

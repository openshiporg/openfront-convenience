// Online pickup payments: pure policy plus the real webhook ingress with an in-memory
// Prisma stand-in. No DB, network or real env.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function sandbox({ env = {}, mocks = {} } = {}) {
  const cache = new Map();
  function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename).exports;
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const module = { exports: {} };
    cache.set(filename, module);
    const localRequire = (specifier) => {
      if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
      if (specifier.startsWith('node:')) return require(specifier);
      if (specifier.startsWith('.')) {
        const resolved = path.resolve(path.dirname(filename), specifier);
        const file = fs.existsSync(`${resolved}.ts`) ? `${resolved}.ts` : `${resolved}/index.ts`;
        return load(path.relative(root, file));
      }
      throw new Error(`Unmocked dependency: ${specifier}`);
    };
    vm.runInNewContext(output, { module, exports: module.exports, require: localRequire, process: { env }, console, URL, Headers, Buffer, TextEncoder }, { filename });
    return module.exports;
  }
  return { load };
}

const policyPath = 'features/keystone/lib/pickupPolicy.ts';
const line = (over = {}, product = {}) => ({
  id: 'l1', quantity: '1.0000', totalCents: 500, variantId: 'v1', ageRestricted: false,
  variant: { status: 'active', sellBy: 'unit', product: { status: 'active', regulatedSaleType: 'none', minimumAge: null, ...product } }, ...over,
});

test('age-restricted SKUs are rejected from online pickup carts, by live classification', () => {
  const { assertPickupEligible } = sandbox({ mocks: { './idempotency': { fingerprintInput: JSON.stringify } } }).load(policyPath);
  assert.doesNotThrow(() => assertPickupEligible([line()]));
  for (const regulatedSaleType of ['tobacco', 'alcohol', 'lottery', 'otc_medicine', 'other']) {
    assert.throws(() => assertPickupEligible([line(), line({ id: 'l2' }, { regulatedSaleType })]), /only be bought in store/);
  }
  assert.throws(() => assertPickupEligible([line({}, { minimumAge: 21 })]), /only be bought in store/);
  // A snapshot flag from scan time also blocks, even if the product row looks clean.
  assert.throws(() => assertPickupEligible([line({ ageRestricted: true })]), /only be bought in store/);
  assert.throws(() => assertPickupEligible([]), /empty/);
});

test('amount and currency mismatches are refused; minor units must be exact integers', () => {
  const { assertPaymentMatches } = sandbox({ mocks: { './idempotency': { fingerprintInput: JSON.stringify } } }).load(policyPath);
  const expected = { amountCents: 1250, currencyCode: 'USD' };
  assert.doesNotThrow(() => assertPaymentMatches(expected, { amountCents: 1250, currencyCode: 'usd' }));
  assert.throws(() => assertPaymentMatches(expected, { amountCents: 1249, currencyCode: 'USD' }), /amount does not match/);
  assert.throws(() => assertPaymentMatches(expected, { amountCents: 12.5, currencyCode: 'USD' }), /amount does not match/);
  assert.throws(() => assertPaymentMatches(expected, { amountCents: 1250, currencyCode: 'CAD' }), /currency does not match/);
  assert.throws(() => assertPaymentMatches(expected, { amountCents: 1250, currencyCode: undefined }), /currency does not match/);
});

test('stripe events map onto the existing payment.captured / refund.completed contract', () => {
  const { mapStripeEvent } = sandbox().load('features/integrations/payment/stripe-events.ts');
  const captured = mapStripeEvent({ id: 'evt_1', type: 'payment_intent.succeeded', created: 1_700_000_000, data: { object: { id: 'pi_1', amount_received: 1250, currency: 'usd' } } });
  assert.deepEqual({ ...captured, occurredAt: undefined }, { externalEventId: 'evt_1', eventType: 'payment.captured', providerPaymentId: 'pi_1', providerRefundId: null, amountCents: 1250, currencyCode: 'USD', failureCode: null, occurredAt: undefined });
  const refunded = mapStripeEvent({ id: 'evt_2', type: 'charge.refunded', created: 1_700_000_000, data: { object: { payment_intent: 'pi_1', currency: 'usd', refunds: { data: [{ id: 're_1', amount: 300 }] } } } });
  assert.equal(refunded.eventType, 'refund.completed');
  assert.equal(refunded.providerRefundId, 're_1');
  assert.equal(refunded.amountCents, 300);
  assert.equal(mapStripeEvent({ id: 'evt_3', type: 'customer.created', created: 1, data: { object: {} } }), null);
});

function webhookHarness() {
  const rows = new Map();
  const tenders = new Map([['prov1:pi_1', { id: 't1', storeId: 's1', amountCents: 1250, currencyCode: 'USD' }]]);
  const transaction = {
    $queryRaw: async () => [],
    webhookEvent: {
      findUnique: async ({ where }) => rows.get(where.lookupKey) ?? null,
      create: async ({ data }) => { const row = { id: `w${rows.size + 1}`, ...data }; rows.set(data.lookupKey, row); return row; },
      update: async ({ where, data }) => { for (const row of rows.values()) if (row.id === where.id) Object.assign(row, data); },
    },
    tender: { findUnique: async ({ where }) => tenders.get(where.providerLookupKey) ?? null },
    cart: { findFirst: async () => null },
    refundTenderAllocation: { findUnique: async () => null },
    refund: { findUnique: async () => null },
    operationalAlert: { findUnique: async () => null, create: async ({ data }) => data },
    auditEvent: { create: async () => ({}) },
    outboxEvent: { create: async () => ({}) },
  };
  const secret = 'whsec_test_secret';
  const stripeStub = class { constructor() { this.webhooks = { constructEvent: (raw, signature, key) => {
    const expected = crypto.createHmac('sha256', key).update(raw).digest('hex');
    if (signature !== expected) throw new Error('bad signature');
    return JSON.parse(raw);
  } }; } };
  const prisma = {
    paymentProvider: { findFirst: async () => ({ id: 'prov1', businessId: 'b1', status: 'active', adapterKey: 'stripe', credentialReference: '' }) },
    $transaction: async (fn) => fn(transaction),
  };
  const { ingestPaymentWebhook } = sandbox({
    env: { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: secret },
    mocks: {
      '@prisma/client': { Prisma: { sql: (s) => s, TransactionIsolationLevel: { Serializable: 'Serializable' } } },
      stripe: { __esModule: true, default: stripeStub },
      '../lib/idempotency': { fingerprintInput: JSON.stringify },
      './pickupOperations': { postPickupSale: async () => { throw new Error('unexpected'); } },
    },
  }).load('features/keystone/mutations/paymentWebhookOperations.ts');
  const send = (event) => {
    const rawBody = JSON.stringify(event);
    const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return ingestPaymentWebhook({ prisma }, { paymentProviderId: 'prov1', rawBody, headers: new Headers({ 'stripe-signature': signature }) });
  };
  const sendRaw = (rawBody, signature) => ingestPaymentWebhook({ prisma }, { paymentProviderId: 'prov1', rawBody, headers: new Headers(signature ? { 'stripe-signature': signature } : {}) });
  return { send, sendRaw, rows };
}

const succeeded = (amount, currency = 'usd', id = 'evt_a') => ({ id, type: 'payment_intent.succeeded', created: 1_700_000_000, data: { object: { id: 'pi_1', amount_received: amount, currency } } });

test('stripe webhook dedupes durably on (provider, event id)', async () => {
  const { send, rows } = webhookHarness();
  const first = await send(succeeded(1250));
  assert.equal(first.status, 'processed');
  assert.equal(first.replayed, false);
  const second = await send(succeeded(1250));
  assert.equal(second.replayed, true);
  assert.equal(second.id, first.id);
  assert.equal(rows.size, 1);
  // The same event id with different evidence is rejected, not silently accepted.
  await assert.rejects(() => send(succeeded(9999)), /reused with different evidence/);
});

test('stripe webhook with a wrong amount or currency is recorded as failed, never processed', async () => {
  const { send } = webhookHarness();
  const wrongAmount = await send(succeeded(1249, 'usd', 'evt_b'));
  assert.equal(wrongAmount.status, 'failed');
  const wrongCurrency = await send(succeeded(1250, 'cad', 'evt_c'));
  assert.equal(wrongCurrency.status, 'failed');
});

test('stripe webhook with a bad signature is rejected before any record is written', async () => {
  const { send, sendRaw, rows } = webhookHarness();
  await assert.rejects(() => sendRaw(JSON.stringify(succeeded(1250)), 'deadbeef'), /signature/i);
  await assert.rejects(() => sendRaw(JSON.stringify(succeeded(1250)), null), /signature/i);
  assert.equal(rows.size, 0);
  assert.equal((await send(succeeded(1250, 'usd', 'evt_ok'))).status, 'processed');
});

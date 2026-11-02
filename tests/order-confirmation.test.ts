import assert from "node:assert/strict";
import test from "node:test";
import { deliverOrderConfirmation } from "../features/keystone/lib/orderConfirmation";
import { normalizeReceiptEmail } from "../features/keystone/mutations/pickupOperations";

const configure = (on: boolean) => { if (on) { process.env.SMTP_HOST = "x"; process.env.SMTP_STORE_LINK = "https://shop.test"; } else { delete process.env.SMTP_HOST; delete process.env.SMTP_STORE_LINK; } };
function fake(customer: any = { email: "a@b.co", name: "Ann" }, cartMeta: any = {}) {
  const audits = new Map<string, any>();
  const sale = { id: "s1", businessId: "b", storeId: "st", receiptNumber: "WEB-1", currencyCode: "USD", totalCents: 500, store: { name: "Shop" }, customer, lines: [{ titleSnapshot: "Chips", variantTitleSnapshot: "", quantity: "2", totalCents: 500 }] };
  return { audits, prisma: {
    sale: { findUnique: async () => sale },
    cart: { findFirst: async () => ({ id: "c1", metadata: cartMeta }) },
    auditEvent: {
      create: async ({ data }: any) => { if (audits.has(data.eventNumber)) throw Object.assign(new Error("dup"), { code: "P2002" }); const row = { id: `a${audits.size}`, ...data }; audits.set(data.eventNumber, row); return row; },
      update: async ({ where, data }: any) => { for (const row of audits.values()) if (row.id === where.id) row.metadata = data.metadata; return {}; },
    },
  } };
}
const KEY = "confirmation-email:s1";

test("sends once on success and links the signed-in receipt", async () => {
  configure(true);
  const { audits, prisma } = fake();
  const sent: any[] = [];
  await deliverOrderConfirmation(prisma, "s1", null, async o => { sent.push(o); return { sent: true }; });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].link, "https://shop.test/account/receipts/s1");
  assert.equal(audits.get(KEY).metadata.status, "sent");
});

test("the provider message id is recorded with a sent status", async () => {
  configure(true);
  const { audits, prisma } = fake();
  await deliverOrderConfirmation(prisma, "s1", null, async () => ({ sent: true, messageId: "<abc@resend>" }));
  assert.equal(audits.get(KEY).metadata.messageId, "<abc@resend>");
});

test("a replay does not resend", async () => {
  configure(true);
  const { prisma } = fake();
  let count = 0;
  const send = async () => { count++; return { sent: true }; };
  await deliverOrderConfirmation(prisma, "s1", null, send);
  await deliverOrderConfirmation(prisma, "s1", null, send);
  assert.equal(count, 1);
});

test("a mail throw is recorded and never surfaces", async () => {
  configure(true);
  const { audits, prisma } = fake();
  await deliverOrderConfirmation(prisma, "s1", null, async () => { throw new Error("boom"); });
  assert.equal(audits.get(KEY).metadata.status, "failed");
});

test("unconfigured mail is recorded as skipped", async () => {
  configure(false);
  const { audits, prisma } = fake();
  let count = 0;
  await deliverOrderConfirmation(prisma, "s1", null, async () => { count++; return { sent: true }; });
  assert.equal(count, 0);
  assert.equal(audits.get(KEY).metadata.status, "skipped_not_configured");
});

test("a guest order without an email is recorded, not mailed", async () => {
  configure(true);
  const { audits, prisma } = fake(null);
  let count = 0;
  await deliverOrderConfirmation(prisma, "s1", null, async () => { count++; return { sent: true }; });
  assert.equal(count, 0);
  assert.equal(audits.get(KEY).metadata.status, "skipped_no_recipient");
});

test("bookkeeping failure never throws", async () => {
  await deliverOrderConfirmation({ sale: { findUnique: async () => { throw new Error("db down"); } } }, "s1");
});

test("a guest with an Email for receipt is mailed, with their own receipt link", async () => {
  configure(true);
  const { audits, prisma } = fake(null, { receiptEmail: "guest@resend.dev" });
  const sent: any[] = [];
  await deliverOrderConfirmation(prisma, "s1", { cartId: "c1", token: "t".repeat(64) }, async o => { sent.push(o); return { sent: true }; });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "guest@resend.dev");
  assert.equal(sent[0].link, `https://shop.test/checkout/complete?cart=c1&token=${"t".repeat(64)}`);
  assert.equal(audits.get(KEY).metadata.status, "sent");
  assert.ok(!JSON.stringify(audits.get(KEY)).includes("tttt"));
});

test("a guest email without the basket proof falls back to the receipt page, never a sign-in page", async () => {
  configure(true);
  const { prisma } = fake(null, { receiptEmail: "guest@resend.dev" });
  const sent: any[] = [];
  await deliverOrderConfirmation(prisma, "s1", null, async o => { sent.push(o); return { sent: true }; });
  assert.equal(sent[0].link, "https://shop.test/checkout/complete");
});

test("a stored guest email that is not an address is ignored", async () => {
  configure(true);
  const { audits, prisma } = fake(null, { receiptEmail: "not-an-email" });
  await deliverOrderConfirmation(prisma, "s1", null, async () => ({ sent: true }));
  assert.equal(audits.get(KEY).metadata.status, "skipped_no_recipient");
});

test("the receipt email is validated and normalised server-side", () => {
  assert.equal(normalizeReceiptEmail("  Guest@Resend.DEV "), "guest@resend.dev");
  assert.equal(normalizeReceiptEmail(""), null);
  assert.equal(normalizeReceiptEmail(undefined), null);
  assert.throws(() => normalizeReceiptEmail("nope"), /valid email/);
  assert.throws(() => normalizeReceiptEmail("a@b"), /valid email/);
  assert.throws(() => normalizeReceiptEmail(42), /valid email/);
  assert.throws(() => normalizeReceiptEmail(`${"a".repeat(250)}@b.co`), /valid email/);
});

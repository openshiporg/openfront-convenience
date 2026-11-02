import assert from "node:assert/strict";
import test from "node:test";
import { deliverOrderConfirmation } from "../features/keystone/lib/orderConfirmation.ts";

const configure = (on: boolean) => { if (on) { process.env.SMTP_HOST = "x"; process.env.SMTP_STORE_LINK = "https://shop.test"; } else { delete process.env.SMTP_HOST; delete process.env.SMTP_STORE_LINK; } };
function fake(customer: any = { email: "a@b.co", name: "Ann" }) {
  const audits = new Map<string, any>();
  const sale = { id: "s1", businessId: "b", storeId: "st", receiptNumber: "WEB-1", currencyCode: "USD", totalCents: 500, store: { name: "Shop" }, customer, lines: [{ titleSnapshot: "Chips", variantTitleSnapshot: "", quantity: "2", totalCents: 500 }] };
  return { audits, prisma: {
    sale: { findUnique: async () => sale },
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
  await deliverOrderConfirmation(prisma, "s1", async o => { sent.push(o); return { sent: true }; });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].link, "https://shop.test/account/receipts/s1");
  assert.equal(audits.get(KEY).metadata.status, "sent");
});

test("a replay does not resend", async () => {
  configure(true);
  const { prisma } = fake();
  let count = 0;
  const send = async () => { count++; return { sent: true }; };
  await deliverOrderConfirmation(prisma, "s1", send);
  await deliverOrderConfirmation(prisma, "s1", send);
  assert.equal(count, 1);
});

test("a mail throw is recorded and never surfaces", async () => {
  configure(true);
  const { audits, prisma } = fake();
  await deliverOrderConfirmation(prisma, "s1", async () => { throw new Error("boom"); });
  assert.equal(audits.get(KEY).metadata.status, "failed");
});

test("unconfigured mail is recorded as skipped", async () => {
  configure(false);
  const { audits, prisma } = fake();
  let count = 0;
  await deliverOrderConfirmation(prisma, "s1", async () => { count++; return { sent: true }; });
  assert.equal(count, 0);
  assert.equal(audits.get(KEY).metadata.status, "skipped_not_configured");
});

test("a guest order without an email is recorded, not mailed", async () => {
  configure(true);
  const { audits, prisma } = fake(null);
  let count = 0;
  await deliverOrderConfirmation(prisma, "s1", async () => { count++; return { sent: true }; });
  assert.equal(count, 0);
  assert.equal(audits.get(KEY).metadata.status, "skipped_no_recipient");
});

test("bookkeeping failure never throws", async () => {
  await deliverOrderConfirmation({ sale: { findUnique: async () => { throw new Error("db down"); } } }, "s1");
});

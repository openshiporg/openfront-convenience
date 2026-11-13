// Needs DATABASE_URL (a scratch DB with migrations applied) and SESSION_SECRET.
// Run: DATABASE_URL=... SESSION_SECRET=... node --import tsx --test tests/relation-filter-access.db.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { getContext } from "@keystone-6/core/context";
import * as PrismaModule from "@prisma/client";
import config from "../features/keystone/index";

const ctx: any = getContext(config as any, PrismaModule as any);
const sudo = ctx.sudo();
const tag = Date.now().toString(36);

const sessions: Record<string, any> = {};
let business: any, store: any;

async function person(name: string, grants: string[]) {
  const role = await ctx.prisma.role.create({
    data: { name: `${name}-${tag}`, businessId: business.id, ...Object.fromEntries(grants.map((g) => [g, true])) },
  });
  const user = await sudo.query.User.createOne({
    data: { name, email: `${name}-${tag}@example.com`, password: "a-long-test-password-1" },
    query: "id",
  });
  const employee = await ctx.prisma.employee.create({
    data: {
      employeeNumber: `E-${name}-${tag}`, status: "active", hourlyRateCents: 1500,
      businessId: business.id, userId: user.id, roleId: role.id,
      stores: { connect: [{ id: store.id }] },
    },
  });
  const data = {
    name, email: `${name}-${tag}@example.com`, isPlatformAdmin: false,
    employees: [{
      id: employee.id, status: "active", business: { id: business.id, status: "active" },
      stores: [{ id: store.id, business: { id: business.id } }],
      role: { id: role.id, name: role.name, business: { id: business.id }, ...Object.fromEntries(grants.map((g) => [g, true])) },
    }],
  };
  return { itemId: user.id, listKey: "User", data, employeeId: employee.id };
}

test("setup", async () => {
  business = await sudo.query.Business.createOne({ data: { name: `Biz ${tag}`, code: `b-${tag}`, taxIdentifier: "tax-alpha" }, query: "id" });
  store = await sudo.query.Store.createOne({ data: { name: `Store ${tag}`, code: `s-${tag}`, business: { connect: { id: business.id } } }, query: "id" });
  const customer = await sudo.query.User.createOne({ data: { name: "Zed Customer", email: `zed-${tag}@example.com`, password: "a-long-test-password-1" }, query: "id" });
  sessions.cashier = await person("cashier", ["canAccessDashboard", "canReadSales", "canReadCash"]);
  sessions.buyer = await person("buyer", ["canAccessDashboard", "canReadPurchasing"]);
  sessions.payments = await person("payments", ["canAccessDashboard", "canReadPayments"]);
  const manager = await person("hrmanager", ["canAccessDashboard", "canManagePeople", "canManageRoles"]);
  sessions.hr = manager;
  const admin = await sudo.query.User.createOne({ data: { name: "Platform Admin", email: `pa-${tag}@example.com`, password: "a-long-test-password-1" }, query: "id" });
  await sudo.db.User.updateOne({ where: { id: admin.id }, data: { isPlatformAdmin: true, platformAdminApprovedAt: new Date("2026-01-01") } });
  sessions.admin = { itemId: admin.id, listKey: "User", data: { name: "Platform Admin", email: `pa-${tag}@example.com`, isPlatformAdmin: true, platformAdminApprovedAt: "2026-01-01T00:00:00.000Z", employees: [] } };
  sessions.customer = { itemId: customer.id, listKey: "User", data: { name: "Zed Customer", email: `zed-${tag}@example.com`, isPlatformAdmin: false, employees: [] } };
  const cart = await sudo.db.Cart.createOne({
    data: { cartNumber: `C-${tag}`, source: "pos", business: { connect: { id: business.id } }, store: { connect: { id: store.id } }, customer: { connect: { id: customer.id } }, cashier: { connect: { id: sessions.cashier.employeeId } }, subtotalCents: 100, totalCents: 100 },
  });
  await sudo.db.Sale.createOne({
    data: { receiptNumber: `R-${tag}`, source: "pos", business: { connect: { id: business.id } }, store: { connect: { id: store.id } }, customer: { connect: { id: customer.id } }, cashier: { connect: { id: sessions.cashier.employeeId } }, cart: { connect: { id: cart.id } }, subtotalCents: 100, totalCents: 100 },
  });
});

type Probe = { name: string; query: (hit: boolean) => string; allowedFor: string[] };
const swap = (hit: boolean, value: string) => (hit ? value : "q9z-none");
const probes: Probe[] = [
  { name: "cartsCount via customer.name", query: (h) => `{ n: cartsCount(where: { customer: { name: { startsWith: "${swap(h, "Zed")}" } } }) }`, allowedFor: ["admin", "hr"] },
  { name: "salesCount via customer.name", query: (h) => `{ n: salesCount(where: { customer: { name: { startsWith: "${swap(h, "Zed")}" } } }) }`, allowedFor: ["admin", "hr"] },
  { name: "salesCount via cashier.employeeNumber", query: (h) => `{ n: salesCount(where: { cashier: { employeeNumber: { startsWith: "${swap(h, "E-")}" } } }) }`, allowedFor: ["admin", "hr"] },
  { name: "salesCount via cashier.hourlyRateCents", query: (h) => `{ n: salesCount(where: { cashier: { hourlyRateCents: { gt: ${h ? 0 : 999999} } } }) }`, allowedFor: ["admin", "hr"] },
  { name: "cartsCount via cashier.user.name", query: (h) => `{ n: cartsCount(where: { cashier: { user: { name: { startsWith: "${swap(h, "cash")}" } } } }) }`, allowedFor: ["admin", "hr"] },
  { name: "employeesCount via user.name", query: (h) => `{ n: employeesCount(where: { user: { name: { startsWith: "${swap(h, "cash")}" } } }) }`, allowedFor: ["admin", "hr"] },
  // Own employee row only: the rate on it is the person's own readable data.
  { name: "employeesCount by hourlyRateCents", query: (h) => `{ n: employeesCount(where: { hourlyRateCents: { gt: ${h ? 0 : 999999} } }) }`, allowedFor: ["admin", "hr", "cashier", "buyer", "payments"] },
  { name: "usersCount via employees.some.hourlyRateCents", query: (h) => `{ n: usersCount(where: { employees: { some: { hourlyRateCents: { gt: ${h ? 0 : 999999} } } } }) }`, allowedFor: ["admin", "hr"] },
  { name: "usersCount via employees.some.role.name", query: (h) => `{ n: usersCount(where: { employees: { some: { role: { name: { startsWith: "${swap(h, "cash")}" } } } } }) }`, allowedFor: ["admin", "hr"] },
  { name: "usersCount via sales.some.receiptNumber", query: (h) => `{ n: usersCount(where: { sales: { some: { receiptNumber: { startsWith: "${swap(h, "R-")}" } } } }) }`, allowedFor: ["admin", "cashier"] },
  { name: "usersCount via carts.some.cartNumber", query: (h) => `{ n: usersCount(where: { carts: { some: { cartNumber: { startsWith: "${swap(h, "C-")}" } } } }) }`, allowedFor: ["admin", "cashier"] },
  { name: "usersCount via apiKeys.some.name", query: (h) => `{ n: usersCount(where: { apiKeys: { some: { name: { startsWith: "${swap(h, "a")}" } } } }) }`, allowedFor: ["admin"] },
  { name: "usersCount by isPlatformAdmin", query: (h) => `{ n: usersCount(where: { isPlatformAdmin: { equals: ${h} } }) }`, allowedFor: ["admin"] },
  { name: "rolesCount via employees.some.user.name", query: (h) => `{ n: rolesCount(where: { employees: { some: { user: { name: { startsWith: "${swap(h, "cash")}" } } } } }) }`, allowedFor: ["admin", "hr"] },
  { name: "businessesCount by taxIdentifier", query: (h) => `{ n: businessesCount(where: { taxIdentifier: { startsWith: "${swap(h, "tax")}" } }) }`, allowedFor: ["admin"] },
  { name: "businessesCount via employees.some.user.name", query: (h) => `{ n: businessesCount(where: { employees: { some: { user: { name: { startsWith: "${swap(h, "cash")}" } } } } }) }`, allowedFor: ["admin", "hr"] },
  { name: "storesCount via employees.some.hourlyRateCents", query: (h) => `{ n: storesCount(where: { employees: { some: { hourlyRateCents: { gt: ${h ? 0 : 999999} } } } }) }`, allowedFor: ["admin", "hr"] },
  { name: "tendersCount via sale.customer.name", query: (h) => `{ n: tendersCount(where: { sale: { customer: { name: { startsWith: "${swap(h, "Zed")}" } } } }) }`, allowedFor: ["admin"] },
  { name: "refundsCount via sale.receiptNumber", query: (h) => `{ n: refundsCount(where: { sale: { receiptNumber: { startsWith: "${swap(h, "R-")}" } } }) }`, allowedFor: ["admin", "payments"] },
  { name: "saleLinesCount via sale.cashier.hourlyRateCents", query: (h) => `{ n: saleLinesCount(where: { sale: { cashier: { hourlyRateCents: { gt: ${h ? 0 : 999999} } } } }) }`, allowedFor: ["admin", "hr"] },
  { name: "auditEventsCount via actor.name", query: (h) => `{ n: auditEventsCount(where: { actor: { name: { startsWith: "${swap(h, "cash")}" } } }) }`, allowedFor: ["admin"] },
  { name: "usersCount by password", query: (h) => `{ n: usersCount(where: { password: { isSet: ${h} } }) }`, allowedFor: [] },
  { name: "employeesCount by posPin", query: (h) => `{ n: employeesCount(where: { posPin: { isSet: ${h} } }) }`, allowedFor: [] },
  { name: "cartsCount by guestTokenDigest", query: (h) => `{ n: cartsCount(where: { guestTokenDigest: { startsWith: "${swap(h, "")}" } }) }`, allowedFor: [] },
  { name: "usersCount by sessionVersion", query: (h) => `{ n: usersCount(where: { sessionVersion: { gte: ${h ? 0 : 99999} } }) }`, allowedFor: [] },
];

// Signed out and each limited role: a hit and a miss must give the same count, or an access error.
for (const who of ["anonymous", "customer", "cashier", "buyer", "payments", "hr"]) {
  for (const probe of probes) {
    test(`${who}: ${probe.name}`, async () => {
      const c = who === "anonymous" ? ctx : ctx.withSession(sessions[who]);
      const run = async (hit: boolean) => {
        const r = await c.graphql.raw({ query: probe.query(hit) });
        return r.errors?.length ? "error" : r.data?.n;
      };
      const [hit, miss] = [await run(true), await run(false)];
      if (!probe.allowedFor.includes(who)) assert.equal(hit, miss, `${probe.name} leaks for ${who}: hit=${hit} miss=${miss}`);
    });
  }
}

test("admin keeps its real filters", async () => {
  const c = ctx.withSession(sessions.admin);
  const count = async (where: string) => (await c.graphql.raw({ query: `{ n: cartsCount(where: ${where}) }` })).data?.n;
  assert.ok((await count(`{ customer: { name: { startsWith: "Zed" } } }`)) >= 1);
  assert.equal(await count(`{ customer: { name: { startsWith: "q9z-none" } } }`), 0);
});

test("hr manager keeps people filters", async () => {
  const c = ctx.withSession(sessions.hr);
  const r = await c.graphql.raw({ query: `{ n: employeesCount(where: { user: { name: { startsWith: "cash" } } }) }` });
  assert.ok(r.data?.n >= 1);
});

test("password, pin, digests and session keys are never filterable, even for admin", async () => {
  const c = ctx.withSession(sessions.admin);
  for (const q of [
    `{ n: usersCount(where: { password: { isSet: true } }) }`,
    `{ n: employeesCount(where: { posPin: { isSet: true } }) }`,
    `{ n: cartsCount(where: { guestTokenDigest: { startsWith: "a" } }) }`,
    `{ n: usersCount(where: { sessionVersion: { gte: 0 } }) }`,
  ]) {
    const r = await c.graphql.raw({ query: q });
    assert.ok(r.errors?.length, `${q} must be refused`);
  }
});

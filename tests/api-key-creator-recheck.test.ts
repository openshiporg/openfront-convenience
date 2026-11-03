import assert from "node:assert/strict";
import test from "node:test";
import { canAccessBusiness, scopesStillHeldByCreator, type Session } from "../features/keystone/access";

const employee = (role: Record<string, unknown> | null, status = "active", businessId = "b1") => ({
  id: "e1", status, business: { id: businessId, status: "active" }, stores: [],
  role: role ? { id: "r1", business: { id: businessId }, ...role } : null,
});
const creator = (employees: any[], admin = false) => ({ id: "u1", isPlatformAdmin: admin, platformAdminApprovedAt: admin ? new Date() : null, employees });
const scopes = ["canReadSales", "canManageCatalog", "canManagePeople"];

test("a creator who still holds every scope keeps them", () => {
  const owner = creator([employee({ canReadSales: true, canManageCatalog: true, canManagePeople: true })]);
  assert.deepEqual(scopesStillHeldByCreator(scopes, "b1", owner), scopes);
});

test("a downgraded creator narrows the key to what they still hold", () => {
  const downgraded = creator([employee({ canReadSales: true })]);
  assert.deepEqual(scopesStillHeldByCreator(scopes, "b1", downgraded), ["canReadSales"]);
});

test("a removed, suspended or role-less creator leaves the key with nothing", () => {
  assert.deepEqual(scopesStillHeldByCreator(scopes, "b1", null), []);
  assert.deepEqual(scopesStillHeldByCreator(scopes, "b1", creator([])), []);
  assert.deepEqual(scopesStillHeldByCreator(scopes, "b1", creator([employee({ canReadSales: true }, "suspended")])), []);
  assert.deepEqual(scopesStillHeldByCreator(scopes, "b1", creator([employee(null)])), []);
});

test("authority in another business does not count", () => {
  assert.deepEqual(scopesStillHeldByCreator(scopes, "b1", creator([employee({ canReadSales: true }, "active", "b2")])), []);
});

test("unknown scopes are dropped; an approved platform admin keeps valid ones", () => {
  assert.deepEqual(scopesStillHeldByCreator(["canReadSales", "notAScope"], "b1", creator([], true)), ["canReadSales"]);
});

test("the machine session built from the narrowed scopes is denied the dropped permission", () => {
  const narrowed = scopesStillHeldByCreator(scopes, "b1", creator([employee({ canReadSales: true })]));
  const machine = { itemId: "u1", listKey: "User", apiKeyId: "k1", apiKeyBusinessId: "b1", apiKeyScopes: narrowed, data: {} } as unknown as Session;
  assert.equal(canAccessBusiness(machine, "b1", "canReadSales"), true);
  assert.equal(canAccessBusiness(machine, "b1", "canManageCatalog"), false);
});

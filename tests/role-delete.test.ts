import assert from "node:assert/strict";
import test from "node:test";

test("Role delete: tenant role managers only, refused while employees hold the role, never for machine keys", async () => {
  const { Role } = await import("../features/keystone/models/Role");
  const r = Role as any;
  const manager = { itemId: "u1", data: { platformRole: null, employees: [] } };
  assert.equal(typeof r.access.operation.delete, "function");
  assert.equal(r.access.operation.delete({ session: undefined }), false);
  const run = async (session: any, count: number) => {
    const errors: string[] = [];
    await r.hooks.validateDelete({ item: { id: "role1" }, context: { session, prisma: { employee: { count: async () => count } } }, addValidationError: (m: string) => errors.push(m) });
    return errors;
  };
  assert.deepEqual(await run(manager, 0), []);
  assert.match((await run(manager, 2))[0], /Reassign/);
  assert.match((await run({ itemId: "k", apiKeyId: "key1" }, 0))[0], /Machine sessions/);
});

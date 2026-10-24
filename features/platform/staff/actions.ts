"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

const value = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

function back(path: string, form: FormData, params: Record<string, string>): never {
  const query = new URLSearchParams(params);
  for (const key of ["businessId", "storeId"]) {
    const entry = value(form, key);
    if (entry) query.set(key, entry);
  }
  redirect(`${path}?${query.toString()}`);
}

const STAFF_PATH = /^\/dashboard\/platform\/staff(\/[a-z0-9]{10,40})?$/;
const returnPath = (form: FormData) => (STAFF_PATH.test(value(form, "returnPath")) ? value(form, "returnPath") : "/dashboard/platform/staff");

/**
 * Adds a person: their sign-in (User) first, then their job at this business
 * (Employee with role and store). Both go through Keystone's access rules.
 */
export async function addStaffAction(form: FormData) {
  const path = "/dashboard/platform/staff";
  const name = value(form, "name");
  const email = value(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const employeeNumber = value(form, "employeeNumber");
  const businessId = value(form, "businessId");
  const storeId = value(form, "storeId");
  const roleId = value(form, "roleId");
  if (!name || !email || !employeeNumber || !roleId || !businessId || !storeId) back(path, form, { error: "Name, email, employee number, role and store are required" });
  if (password.length < 10) back(path, form, { error: "The temporary password needs at least 10 characters" });
  const user = await keystoneClient<{ createUser: { id: string } | null }>(
    `mutation PlatformAddStaffUser($data: UserCreateInput!) { createUser(data: $data) { id } }`,
    { data: { name, email, password } },
  );
  if (!user.success || !user.data.createUser?.id) {
    back(path, form, { error: "That email already has an account, or the password is too common" });
  }
  const employee = await keystoneClient<{ createEmployee: { id: string } | null }>(
    `mutation PlatformAddStaffEmployee($data: EmployeeCreateInput!) { createEmployee(data: $data) { id } }`,
    {
      data: {
        business: { connect: { id: businessId } },
        user: { connect: { id: user.data.createUser!.id } },
        role: { connect: { id: roleId } },
        stores: { connect: [{ id: storeId }] },
        employeeNumber,
        jobTitle: value(form, "jobTitle") || null,
        status: "active",
        hireDate: new Date().toISOString(),
      },
    },
  );
  if (!employee.success || !employee.data.createEmployee?.id) {
    back(path, form, { error: "The sign-in was created but the employee record wasn't. Check the role is one you may grant." });
  }
  revalidatePath(path);
  back(`${path}/${employee.data.createEmployee!.id}`, form, { notice: "Staff member added" });
}

/** Status, title, role and store changes for one employee. */
export async function updateStaffAction(form: FormData) {
  const path = returnPath(form);
  const employeeId = value(form, "employeeId");
  const status = value(form, "status");
  const data: Record<string, unknown> = {
    jobTitle: value(form, "jobTitle") || null,
    ...(status ? { status } : {}),
    ...(value(form, "roleId") ? { role: { connect: { id: value(form, "roleId") } } } : {}),
    ...(status === "terminated" ? { terminatedAt: new Date().toISOString() } : {}),
  };
  const stores = form.getAll("storeIds").map(String).filter(Boolean);
  if (stores.length) data.stores = { set: stores.map((id) => ({ id })) };
  const response = await keystoneClient<{ updateEmployee: { id: string } | null }>(
    `mutation PlatformUpdateStaff($id: ID!, $data: EmployeeUpdateInput!) { updateEmployee(where: { id: $id }, data: $data) { id } }`,
    { id: employeeId, data },
  );
  revalidatePath(path);
  if (!response.success || !response.data.updateEmployee?.id) {
    back(path, form, { error: "Not saved. A role change needs role-management permission and can't grant more than you hold." });
  }
  back(path, form, { notice: "Saved" });
}

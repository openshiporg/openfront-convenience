"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { isCommonPassword } from "@/features/storefront/lib/password-rules";

import { ALL_PERMISSION_KEYS, PERMISSION_AREAS } from "./permissionAreas";

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
  if (isCommonPassword(password, email)) back(path, form, { error: "Choose a less common temporary password" });
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

const ROLE_PATH = /^\/dashboard\/platform\/staff\/roles(\/[a-z0-9]{10,40})?$/;

/** The checked boxes become the role's permissions; "Change" always brings "View" with it. */
function permissionData(form: FormData) {
  const data: Record<string, boolean> = {};
  for (const key of ALL_PERMISSION_KEYS) data[key] = form.get(key) === "on";
  for (const area of PERMISSION_AREAS) if (area.manage && area.read && data[area.manage]) data[area.read] = true;
  return data;
}

function roleError(errors: unknown): string {
  const text = JSON.stringify(errors ?? "");
  if (/beyond the role manager/.test(text)) return "You can't give a role more than your own role allows";
  if (/Reassign this role/.test(text)) return "Move this role's staff to another role first";
  return "Not saved. Roles can only be changed by someone allowed to manage roles.";
}

export async function createRoleAction(form: FormData) {
  const path = "/dashboard/platform/staff/roles";
  const name = value(form, "name");
  const businessId = value(form, "businessId");
  if (!name || !businessId) back(path, form, { error: "Give the role a name" });
  const response = await keystoneClient<{ createRole: { id: string } | null }>(
    `mutation PlatformCreateRole($data: RoleCreateInput!) { createRole(data: $data) { id } }`,
    { data: { name, description: value(form, "description"), business: { connect: { id: businessId } }, ...permissionData(form) } },
  );
  if (!response.success || !response.data.createRole?.id) back(path, form, { error: roleError(response.success ? null : response.error) });
  revalidatePath(path);
  back(`${path}/${response.data.createRole!.id}`, form, { notice: "Role created" });
}

export async function updateRoleAction(form: FormData) {
  const path = ROLE_PATH.test(value(form, "returnPath")) ? value(form, "returnPath") : "/dashboard/platform/staff/roles";
  const name = value(form, "name");
  if (!name) back(path, form, { error: "Give the role a name" });
  const response = await keystoneClient<{ updateRole: { id: string } | null }>(
    `mutation PlatformUpdateRole($id: ID!, $data: RoleUpdateInput!) { updateRole(where: { id: $id }, data: $data) { id } }`,
    { id: value(form, "roleId"), data: { name, description: value(form, "description"), ...permissionData(form) } },
  );
  revalidatePath(path);
  if (!response.success || !response.data.updateRole?.id) back(path, form, { error: roleError(response.success ? null : response.error) });
  back(path, form, { notice: "Saved. Staff with this role get the change at their next page." });
}

export async function deleteRoleAction(form: FormData) {
  const path = "/dashboard/platform/staff/roles";
  const self = `${path}/${value(form, "roleId")}`;
  const response = await keystoneClient<{ deleteRole: { id: string } | null }>(
    `mutation PlatformDeleteRole($id: ID!) { deleteRole(where: { id: $id }) { id } }`,
    { id: value(form, "roleId") },
  );
  if (!response.success || !response.data.deleteRole?.id) back(self, form, { error: roleError(response.success ? null : response.error) });
  revalidatePath(path);
  back(path, form, { notice: "Role deleted" });
}

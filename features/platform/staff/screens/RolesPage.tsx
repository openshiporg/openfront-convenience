import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthenticatedUser } from "@/features/dashboard/actions";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { DetailSection, PlatformDetailShell } from "../../components/PlatformDetailShell";
import { ActionPanel, HiddenScope, TextField } from "../../components/PlatformPage";
import { RetainedForm } from "../../components/RetainedForm";
import { DataTable, Td, Th, Tr, buttonClass, dangerButtonClass, labelClass, primaryButtonClass } from "../../components/cv-ui";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { getPlatformScope, scopeQuery } from "../../lib/scope";
import { createRoleAction, deleteRoleAction, updateRoleAction } from "../actions";
import { ALL_PERMISSION_KEYS, PERMISSION_AREAS, PERMISSION_SWITCHES, roleSummary } from "../permissionAreas";

type RoleRow = Record<string, unknown> & { id: string; name: string; description: string; employeesCount: number };
type RoleDetail = RoleRow & { employees: Array<{ id: string; employeeNumber: string; status: string; user: { name: string } | null }> };

const ROLES = "/dashboard/platform/staff/roles";
const permissionSelection = ALL_PERMISSION_KEYS.join(" ");

async function viewerPermissions(): Promise<Set<string> | null> {
  const me = await getAuthenticatedUser();
  const held = me.success ? me.data?.authenticatedItem?.role?.permissions : null;
  return Array.isArray(held) ? new Set(held) : null;
}

/** Roles in a store owner's words: who has each one and what it lets them change. */
export async function RolesPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const q = scopeQuery(scope);
  const [response, held] = await Promise.all([
    keystoneClient<{ roles: RoleRow[] }>(
      `query PlatformRoles($businessId: ID!) { roles(where: { business: { id: { equals: $businessId } } }, orderBy: { name: asc }) { id name description employeesCount ${permissionSelection} } }`,
      { businessId: scope.businessId ?? "" },
    ),
    viewerPermissions(),
  ]);
  const canManage = !held || held.has("canManageRoles");
  const roles = response.success ? response.data.roles : [];
  return (
    <PlatformDetailShell
      section="Staff"
      sectionHref={`/dashboard/platform/staff${q}`}
      title="Roles"
      meta="A role decides what a person can see and change. Everyone on the staff list has exactly one."
      notice={searchValue(search, "notice")}
      error={searchValue(search, "error")}
      aside={
        canManage ? (
          <ActionPanel title="New role">
            <RetainedForm action={createRoleAction} className="grid min-w-0 gap-3">
              <HiddenScope projection={scope} returnPath={ROLES} />
              <input type="hidden" name="canAccessDashboard" value="on" />
              <TextField label="Name" name="name" placeholder="e.g. Night shift lead" autoComplete="off" required />
              <TextField label="What it's for (optional)" name="description" autoComplete="off" />
              <p className="text-[12px] text-muted-foreground">It starts with dashboard sign-in only. Choose what it allows on the next page.</p>
              <div className="pt-1">
                <button type="submit" className={primaryButtonClass}>Create role</button>
              </div>
            </RetainedForm>
          </ActionPanel>
        ) : null
      }
    >
      {!canManage ? (
        <p className="text-sm text-muted-foreground">Only someone allowed to manage roles can see and change them.</p>
      ) : roles.length ? (
        <DataTable aria-label="Roles">
          <thead>
            <tr>
              <Th>Role</Th>
              <Th priority={2}>Can change</Th>
              <Th align="right">Staff</Th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <Tr key={role.id} className="relative">
                <Td>
                  <Link href={`${ROLES}/${role.id}${q}`} className="font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                    {role.name}
                  </Link>
                  {role.description ? <span className="block text-[12px] text-muted-foreground [overflow-wrap:anywhere]">{role.description}</span> : null}
                </Td>
                <Td priority={2} className="text-muted-foreground">{roleSummary(role)}</Td>
                <Td align="right" className="tabular-nums">{role.employeesCount}</Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      ) : (
        <p className="text-sm text-muted-foreground">No roles yet</p>
      )}
    </PlatformDetailShell>
  );
}

const boxClass = "size-5 accent-foreground disabled:opacity-40";
const cellLabelClass = "flex min-h-11 items-center justify-end sm:min-h-9";

export async function RoleDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PlatformSearch }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const scope = await getPlatformScope(search);
  const q = scopeQuery(scope);
  const [response, held] = await Promise.all([
    keystoneClient<{ role: RoleDetail | null }>(
      `query PlatformRole($id: ID!) { role(where: { id: $id }) { id name description employeesCount ${permissionSelection} employees(orderBy: { employeeNumber: asc }, take: 50) { id employeeNumber status user { name } } } }`,
      { id },
    ),
    viewerPermissions(),
  ]);
  if (!response.success || !response.data.role) notFound();
  const role = response.data.role;
  const path = `${ROLES}/${role.id}`;
  // A manager can only hand out what their own role holds; a box they can't grant is shown but locked,
  // and a grant they can't give stays as it is (sent as a hidden field).
  const grantable = (key: string) => !held || held.has(key);
  const box = (key: string, label: string) => {
    const checked = Boolean(role[key]);
    return grantable(key) ? (
      <input type="checkbox" name={key} defaultChecked={checked} aria-label={label} className={boxClass} />
    ) : (
      <>
        <input type="checkbox" checked={checked} disabled aria-label={`${label} (your role can't grant this)`} className={boxClass} readOnly />
        {checked ? <input type="hidden" name={key} value="on" /> : null}
      </>
    );
  };
  return (
    <PlatformDetailShell
      section="Roles"
      sectionHref={`${ROLES}${q}`}
      title={role.name}
      meta={`${role.employeesCount} ${role.employeesCount === 1 ? "person" : "people"} · ${roleSummary(role)}`}
      notice={searchValue(search, "notice")}
      error={searchValue(search, "error")}
      aside={
        <ActionPanel title={`Staff with this role (${role.employeesCount})`}>
          {role.employees.length ? (
            <ul className="grid gap-1 text-sm">
              {role.employees.map((employee) => (
                <li key={employee.id}>
                  <Link href={`/dashboard/platform/staff/${employee.id}${q}`} className="flex min-h-11 items-center hover:underline sm:min-h-8">
                    {employee.user?.name || employee.employeeNumber}
                    {employee.status !== "active" ? <span className="ml-2 text-[12px] text-muted-foreground">{employee.status}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">Nobody has this role.</p>
              <RetainedForm action={deleteRoleAction}>
                <HiddenScope projection={scope} returnPath={path} />
                <input type="hidden" name="roleId" value={role.id} />
                <button type="submit" className={dangerButtonClass}>Delete role</button>
              </RetainedForm>
            </div>
          )}
        </ActionPanel>
      }
    >
      <RetainedForm action={updateRoleAction} className="grid min-w-0 gap-6">
        <HiddenScope projection={scope} returnPath={path} />
        <input type="hidden" name="roleId" value={role.id} />
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <TextField label="Name" name="name" defaultValue={role.name} autoComplete="off" required />
          <TextField label="What it's for (optional)" name="description" defaultValue={role.description} autoComplete="off" />
        </div>
        <DetailSection title="What this role can do" meta="Change includes view">
          <DataTable aria-label="Permissions by area">
            <thead>
              <tr>
                <Th>Area</Th>
                <Th align="right">View</Th>
                <Th align="right">Change</Th>
              </tr>
            </thead>
            <tbody>
              {PERMISSION_AREAS.map((area) => (
                <Tr key={area.label}>
                  <Td>
                    <span className="font-medium">{area.label}</span>
                    <span className="block text-[12px] text-muted-foreground">{area.hint}</span>
                  </Td>
                  <Td align="right"><span className={cellLabelClass}>{area.read ? box(area.read, `View ${area.label}`) : null}</span></Td>
                  <Td align="right"><span className={cellLabelClass}>{area.manage ? box(area.manage, `Change ${area.label}`) : null}</span></Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        </DetailSection>
        <DetailSection title="Access and set-up">
          <fieldset className="grid gap-1 sm:grid-cols-2">
            <legend className="sr-only">Access and set-up</legend>
            {PERMISSION_SWITCHES.map((entry) => (
              <label key={entry.key} className="flex min-h-11 items-start gap-3 rounded-md px-1 py-2 text-sm">
                <span className="pt-0.5">{box(entry.key, entry.label)}</span>
                <span>
                  <span className="font-medium">{entry.label}</span>
                  <span className={`${labelClass} block font-normal`}>{entry.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </DetailSection>
        <div className="flex flex-wrap gap-2 max-sm:sticky max-sm:bottom-0 max-sm:-mx-4 max-sm:border-t max-sm:bg-background max-sm:px-4 max-sm:py-3">
          <button type="submit" className={primaryButtonClass}>Save role</button>
          <Link href={`${ROLES}${q}`} className={buttonClass}>Cancel</Link>
        </div>
      </RetainedForm>
    </PlatformDetailShell>
  );
}

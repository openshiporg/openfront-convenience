import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { ListRow, PlatformListShell } from "../../components/PlatformListShell";
import { ActionPanel, HiddenScope, SelectField, TextField } from "../../components/PlatformPage";
import { primaryButtonClass } from "../../components/cv-ui";
import { loadPlatformList } from "../../lib/list-query";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";
import { addStaffAction } from "../actions";

const STATUSES = [
  { value: "active", label: "Active" },
  { value: "invited", label: "Invited" },
  { value: "leave", label: "On leave" },
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
];

type EmployeeRow = {
  id: string;
  employeeNumber: string;
  jobTitle: string;
  status: string;
  hireDate: string | null;
  user: { name: string; email: string } | null;
  role: { name: string } | null;
  stores: Array<{ name: string }>;
  shiftsCount: number;
};

export async function StaffListPage({ searchParams }: { searchParams: PlatformSearch }) {
  const search = await searchParams;
  const scope = await getPlatformScope(search);
  const [result, roles] = await Promise.all([
    loadPlatformList<EmployeeRow>({
      path: "employees",
      search,
      scopeWhere: { business: { id: { equals: scope.businessId ?? "" } } },
      statuses: STATUSES,
      selection: `id employeeNumber jobTitle status hireDate user { name email } role { name } stores { name } shiftsCount`,
    }),
    keystoneClient<{ roles: Array<{ id: string; name: string }> }>(
      `query PlatformRoles($businessId: ID!) { roles(where: { business: { id: { equals: $businessId } } }, orderBy: { name: asc }) { id name } }`,
      { businessId: scope.businessId ?? "" },
    ),
  ]);
  const roleOptions = roles.success ? roles.data.roles.map((role) => ({ id: role.id, label: role.name })) : [];
  const error = searchValue(search, "error");
  return (
    <PlatformListShell
      title="Staff"
      scope={scope}
      basePath="/dashboard/platform/staff"
      search={search}
      statuses={STATUSES}
      result={result}
      entity={{ singular: "employee", plural: "employees" }}
      empty="No staff"
      actions={
        <details className="group w-full sm:w-auto">
          <summary className={`${primaryButtonClass} cursor-pointer list-none`}>Add staff</summary>
          <div className="mt-3 w-full sm:absolute sm:right-6 sm:z-20 sm:w-[32rem]">
            <ActionPanel title="Add staff">
              <form action={addStaffAction} className="grid min-w-0 gap-3 sm:grid-cols-2">
                <HiddenScope projection={scope} returnPath="/dashboard/platform/staff" />
                {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p> : null}
                <TextField label="Name" name="name" autoComplete="off" required />
                <TextField label="Email" name="email" type="email" autoComplete="off" required />
                <TextField label="Temporary password" name="password" type="password" minLength={10} autoComplete="new-password" required />
                <TextField label="Employee number" name="employeeNumber" required />
                <TextField label="Job title" name="jobTitle" />
                <SelectField label="Role" name="roleId" options={roleOptions} />
                <div className="pt-1 sm:col-span-2">
                  <button type="submit" className={primaryButtonClass}>Add</button>
                </div>
              </form>
            </ActionPanel>
          </div>
        </details>
      }
    >
      {result.items.map((employee) => (
        <ListRow
          key={employee.id}
          href={`/dashboard/platform/staff/${employee.id}${scopeQuery(scope)}`}
          title={employee.user?.name || employee.employeeNumber}
          status={employee.status}
          meta={[
            employee.jobTitle || null,
            employee.role?.name,
            employee.stores.map((store) => store.name).join(", ") || "No store",
            employee.employeeNumber,
            employee.hireDate ? `since ${formatWhen(employee.hireDate, scope.timezone)}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          figure={`${employee.shiftsCount} ${employee.shiftsCount === 1 ? "shift" : "shifts"}`}
          figureMeta={employee.user?.email}
        />
      ))}
    </PlatformListShell>
  );
}

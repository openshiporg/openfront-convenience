import Link from "next/link";
import { notFound } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

import { DetailSection, FactList, PlatformDetailShell } from "../../components/PlatformDetailShell";
import { ActionPanel, EnumField, HiddenScope, SelectField, TextField } from "../../components/PlatformPage";
import { DataTable, StatusText, Td, Th, Tr, labelClass, primaryButtonClass } from "../../components/cv-ui";
import { shortRef } from "../../lib/labels";
import { searchValue, type PlatformSearch } from "../../lib/projection";
import { formatMoney, formatWhen, getPlatformScope, scopeQuery } from "../../lib/scope";
import { updateStaffAction } from "../actions";

type Employee = {
  id: string;
  employeeNumber: string;
  jobTitle: string;
  status: string;
  hireDate: string | null;
  terminatedAt: string | null;
  hourlyRateCents: number | null;
  overtimeEligible: boolean;
  user: { name: string; email: string } | null;
  role: { id: string; name: string } | null;
  stores: Array<{ id: string; name: string }>;
  manager: { employeeNumber: string; user: { name: string } | null } | null;
  shifts: Array<{ id: string; shiftNumber: string; status: string; startsAt: string | null; endsAt: string | null; clockedInAt: string | null; clockedOutAt: string | null; breakMinutes: number }>;
  registerSessions: Array<{ id: string; sessionNumber: string; status: string; openedAt: string | null; overShortCents: number | null; register: { name: string } | null }>;
};

export async function StaffDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: PlatformSearch }) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const scope = await getPlatformScope(search);
  const response = await keystoneClient<{ employee: Employee | null; roles: Array<{ id: string; name: string }>; stores: Array<{ id: string; name: string }> }>(
    `query PlatformStaff($id: ID!, $businessId: ID!) {
      employee(where: { id: $id }) {
        id employeeNumber jobTitle status hireDate terminatedAt hourlyRateCents overtimeEligible
        user { name email }
        role { id name }
        stores { id name }
        manager { employeeNumber user { name } }
        shifts(orderBy: { startsAt: desc }, take: 20) { id shiftNumber status startsAt endsAt clockedInAt clockedOutAt breakMinutes }
        registerSessions(orderBy: { openedAt: desc }, take: 20) { id sessionNumber status openedAt overShortCents register { name } }
      }
      roles(where: { business: { id: { equals: $businessId } } }, orderBy: { name: asc }) { id name }
      stores(where: { business: { id: { equals: $businessId } } }, orderBy: { name: asc }) { id name }
    }`,
    { id, businessId: scope.businessId ?? "" },
  );
  if (!response.success || !response.data.employee) notFound();
  const employee = response.data.employee;
  const path = `/dashboard/platform/staff/${employee.id}`;
  const q = scopeQuery(scope);
  const name = employee.user?.name || employee.employeeNumber;
  const assigned = new Set(employee.stores.map((store) => store.id));
  return (
    <PlatformDetailShell
      section="Staff"
      sectionHref={`/dashboard/platform/staff${q}`}
      title={name}
      status={employee.status}
      meta={[employee.jobTitle, employee.role?.name, employee.user?.email].filter(Boolean).join(" · ")}
      notice={searchValue(search, "notice")}
      error={searchValue(search, "error")}
      aside={
        <ActionPanel title="Edit">
          <form action={updateStaffAction} className="grid min-w-0 gap-3">
            <HiddenScope projection={scope} returnPath={path} />
            <input type="hidden" name="employeeId" value={employee.id} />
            <EnumField
              label="Status"
              name="status"
              defaultValue={employee.status}
              values={[
                { value: "active", label: "Active" },
                { value: "invited", label: "Invited" },
                { value: "leave", label: "On leave" },
                { value: "suspended", label: "Suspended" },
                { value: "terminated", label: "Terminated" },
              ]}
            />
            <TextField label="Job title" name="jobTitle" defaultValue={employee.jobTitle} />
            <SelectField
              label="Role"
              name="roleId"
              options={response.data.roles.map((role) => ({ id: role.id, label: role.name }))}
              defaultValue={employee.role?.id}
            />
            <fieldset className="grid gap-1.5">
              <legend className={`${labelClass} mb-1.5`}>Stores</legend>
              {response.data.stores.map((store) => (
                <label key={store.id} className="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" name="storeIds" value={store.id} defaultChecked={assigned.has(store.id)} className="size-4 accent-foreground" />
                  {store.name}
                </label>
              ))}
            </fieldset>
            <div className="pt-1">
              <button type="submit" className={primaryButtonClass}>Save</button>
            </div>
          </form>
        </ActionPanel>
      }
    >
      <FactList
        facts={[
          ["Employee number", employee.employeeNumber],
          ["Stores", employee.stores.map((store) => store.name).join(", ") || "None"],
          ["Hired", formatWhen(employee.hireDate, scope.timezone)],
          ["Hourly rate", employee.hourlyRateCents == null ? "—" : formatMoney(employee.hourlyRateCents, scope.currencyCode)],
          ["Overtime", employee.overtimeEligible ? "Eligible" : "Not eligible"],
          ["Manager", employee.manager ? employee.manager.user?.name || employee.manager.employeeNumber : "—"],
        ]}
      />
      <DetailSection title="Shifts" meta={employee.shifts.length}>
        {employee.shifts.length ? (
          <DataTable aria-label="Shifts">
            <thead>
              <tr>
                <Th>Shift</Th>
                <Th>Status</Th>
                <Th>Scheduled</Th>
                <Th priority={2}>Clocked in</Th>
                <Th priority={2}>Clocked out</Th>
                <Th align="right" priority={3}>Break</Th>
              </tr>
            </thead>
            <tbody>
              {employee.shifts.map((shift) => (
                <Tr key={shift.id}>
                  <Td className="font-mono tabular-nums">{shortRef(shift.shiftNumber)}</Td>
                  <Td><StatusText status={shift.status} /></Td>
                  <Td className="text-muted-foreground">
                    {formatWhen(shift.startsAt, scope.timezone)} – {formatWhen(shift.endsAt, scope.timezone)}
                  </Td>
                  <Td priority={2} className="whitespace-nowrap text-muted-foreground">{shift.clockedInAt ? formatWhen(shift.clockedInAt, scope.timezone) : "—"}</Td>
                  <Td priority={2} className="whitespace-nowrap text-muted-foreground">{shift.clockedOutAt ? formatWhen(shift.clockedOutAt, scope.timezone) : "—"}</Td>
                  <Td align="right" priority={3}>{shift.breakMinutes ? `${shift.breakMinutes} min` : "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </DataTable>
        ) : (
          <p className="text-sm text-muted-foreground">No shifts</p>
        )}
      </DetailSection>
      <DetailSection title="Tills" meta={employee.registerSessions.length}>
        {employee.registerSessions.length ? (
          <DataTable aria-label="Tills">
            <thead>
              <tr>
                <Th>Till</Th>
                <Th>Status</Th>
                <Th priority={2}>Opened</Th>
                <Th align="right">Over / short</Th>
              </tr>
            </thead>
            <tbody>
              {employee.registerSessions.map((session) => {
                const variance = session.overShortCents ?? 0;
                return (
                  <Tr key={session.id} className="relative">
                    <Td>
                      <Link href={`/dashboard/platform/tills/${session.id}${q}`} className="after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                        {session.register?.name ?? "Till"} <span className="font-mono text-[12px] text-muted-foreground">{shortRef(session.sessionNumber)}</span>
                      </Link>
                    </Td>
                    <Td><StatusText status={session.status} /></Td>
                    <Td priority={2} className="whitespace-nowrap text-muted-foreground">{formatWhen(session.openedAt, scope.timezone)}</Td>
                    <Td align="right" className={session.status === "closed" && variance < 0 ? "text-[oklch(0.52_0.19_27)] dark:text-red-400" : ""}>
                      {session.status === "closed"
                        ? variance
                          ? `${variance > 0 ? "+" : "−"}${formatMoney(Math.abs(variance), scope.currencyCode)}`
                          : "Balanced"
                        : "—"}
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </DataTable>
        ) : (
          <p className="text-sm text-muted-foreground">No till sessions</p>
        )}
      </DetailSection>
      <p className="text-sm">
        <Link className="underline underline-offset-4" href="/dashboard/roles">
          Roles and permissions
        </Link>
      </p>
    </PlatformDetailShell>
  );
}

export type EmployeeRef = { employeeNumber: string; user: { name: string | null } | null } | null;

/** An employee shown by name, falling back to their number. */
export const employeeName = (employee: EmployeeRef | undefined) =>
  employee?.user?.name?.trim() || employee?.employeeNumber || "—";

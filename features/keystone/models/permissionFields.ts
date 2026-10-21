import { checkbox } from "@keystone-6/core/fields";

import { permissionKeys } from "../access";

function labelForPermission(permission: string): string {
  return permission
    .replace(/^can/, "Can ")
    .replace(/([A-Z])/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

export const permissionFields = Object.fromEntries(
  permissionKeys.map((permission) => [
    permission,
    checkbox({
      defaultValue: false,
      label: labelForPermission(permission),
    }),
  ]),
);

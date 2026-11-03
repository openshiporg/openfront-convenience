import { list } from "@keystone-6/core";
import { relationship, text } from "@keystone-6/core/fields";

import {
  canAccessBusiness,
  isHumanPlatformAdmin,
  permissionKeys,
  permissions,
  tenantAccess,
  type Session,
} from "../access";
import { permissionFields } from "./permissionFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

const roleRelationshipHooks = requiredRelationshipHooks("business");

export const Role = list({
  // Delete is tenant-scoped to role managers (E-commerce parity) and refused
  // while any employee still holds the role (validateDelete below).
  access: tenantAccess("canManageRoles", "canManageRoles", { delete: true }),
  hooks: {
    ...roleRelationshipHooks,
    async validateInput(args) {
      await roleRelationshipHooks.validateInput?.(args);
      const session = args.context.session as Session | undefined;
      if (session?.apiKeyId) {
        args.addValidationError("Machine sessions cannot mutate human authorization roles");
        return;
      }
      if (isHumanPlatformAdmin(session)) return;
      const resolved = args.resolvedData as Record<string, unknown>;
      const item = args.item as { businessId?: string | null } | undefined;
      const businessInput = resolved.business as { connect?: { id?: string } | null } | undefined;
      const businessId = businessInput?.connect?.id ?? item?.businessId ?? null;
      if (!businessId) return;
      for (const permission of permissionKeys) {
        if (resolved[permission] === true && !canAccessBusiness(session, businessId, permission)) {
          args.addValidationError(`A role cannot grant ${permission} beyond the role manager's own permissions`);
        }
      }
    },
    async validateDelete({ item, context, addValidationError }) {
      const session = context.session as Session | undefined;
      if (session?.apiKeyId) {
        addValidationError("Machine sessions cannot mutate human authorization roles");
        return;
      }
      const assigned = await context.prisma.employee.count({ where: { roleId: String(item.id) } });
      if (assigned > 0) {
        addValidationError("Reassign this role's employees before deleting it");
      }
    },
  },
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: (args) => !permissions.canManageRoles(args),
    labelField: "name",
    listView: { initialColumns: ["name", "business", "employees"] },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: "textarea" } }),
    business: relationship({ ref: "Business.roles", access: { update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    ...permissionFields,
    employees: relationship({
      ref: "Employee.role",
      many: true,
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" } },
    }),
    ...trackingFields,
  },
});

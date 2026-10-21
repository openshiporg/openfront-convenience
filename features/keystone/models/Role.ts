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
  access: tenantAccess("canManageRoles", "canManageRoles", { delete: false }),
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
  },
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: true,
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

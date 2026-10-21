import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import {
  checkbox,
  password,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import {
  businessIdsForPermission,
  canAccessBusiness,
  canAccessStore,
  hasPermission,
  hasUnrestrictedStoreAccess,
  isHumanPlatformAdmin,
  isPlatformAdmin,
  isSignedIn,
  permissionKeys,
  storeIdsForPermission,
  type Session,
} from "../access";
import { centsField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

function employeeQueryFilter(session: Session | undefined) {
  if (isHumanPlatformAdmin(session)) return true;
  if (!session) return false;
  const businessIds = Array.from(new Set([
    ...businessIdsForPermission(session, "canReadPeople"),
    ...businessIdsForPermission(session, "canManagePeople"),
  ])).sort();
  const storeIds = Array.from(new Set([
    ...storeIdsForPermission(session, "canReadPeople"),
    ...storeIdsForPermission(session, "canManagePeople"),
  ])).sort();
  const unrestrictedMachine = Boolean(session.apiKeyId && hasUnrestrictedStoreAccess(session));
  return {
    OR: [
      ...(!session.apiKeyId ? [{ user: { id: { equals: session.itemId } } }] : []),
      ...(businessIds.length && (unrestrictedMachine || storeIds.length)
        ? [{
            business: { id: { in: businessIds } },
            ...(unrestrictedMachine ? {} : {
              stores: {
                some: { id: { in: storeIds } },
                every: { id: { in: storeIds } },
              },
            }),
          }]
        : []),
    ],
  };
}

function employeeManageFilter(session: Session | undefined) {
  if (isHumanPlatformAdmin(session)) return true;
  if (!session || session.apiKeyId) return false;
  const businessIds = businessIdsForPermission(session, "canManagePeople");
  const storeIds = storeIdsForPermission(session, "canManagePeople");
  return businessIds.length && storeIds.length
    ? {
        business: { id: { in: businessIds } },
        stores: {
          some: { id: { in: storeIds } },
          every: { id: { in: storeIds } },
        },
      }
    : false;
}

const employeeRelationshipHooks = requiredRelationshipHooks("business", "user", "role");

type RelateOne = { connect?: { id?: string } | null; disconnect?: boolean } | null | undefined;
type RelateMany = {
  connect?: Array<{ id?: string }> | null;
  disconnect?: Array<{ id?: string }> | null;
  set?: Array<{ id?: string }> | null;
  create?: unknown;
} | null | undefined;

function connectedId(value: RelateOne): string | null {
  return typeof value?.connect?.id === "string" ? value.connect.id : null;
}

function relatedIds(value: Array<{ id?: string }> | null | undefined): string[] {
  return (value ?? []).map((entry) => entry.id).filter((id): id is string => Boolean(id));
}

export const Employee = list({
  access: {
    operation: {
      query: isSignedIn,
      create: ({ session }) =>
        Boolean(!session?.apiKeyId && (isPlatformAdmin({ session }) || hasPermission({ session }, "canManagePeople"))),
      update: ({ session }) =>
        Boolean(!session?.apiKeyId && (isPlatformAdmin({ session }) || hasPermission({ session }, "canManagePeople"))),
      delete: () => false,
    },
    filter: {
      query: ({ session }) => employeeQueryFilter(session),
      update: ({ session }) => employeeManageFilter(session),
      delete: ({ session }) => employeeManageFilter(session),
    },
    item: {
      create: ({ session, inputData }) => {
        if (isHumanPlatformAdmin(session)) return true;
        const businessId = inputData.business?.connect?.id;
        return Boolean(
          businessId && canAccessBusiness(session, businessId, "canManagePeople"),
        );
      },
      update: ({ session, inputData }) => {
        if (isHumanPlatformAdmin(session) || !inputData.business) return true;
        const businessId = inputData.business?.connect?.id;
        return Boolean(
          businessId && canAccessBusiness(session, businessId, "canManagePeople"),
        );
      },
      delete: () => false,
    },
  },
  hooks: {
    ...employeeRelationshipHooks,
    async validateInput(args) {
      await employeeRelationshipHooks.validateInput?.(args);
      const resolved = args.resolvedData as Record<string, unknown>;
      const item = args.item as {
        id?: string;
        businessId?: string | null;
        userId?: string | null;
        roleId?: string | null;
        managerId?: string | null;
      } | undefined;
      const businessId = connectedId(resolved.business as RelateOne) ?? item?.businessId ?? null;
      const userId = connectedId(resolved.user as RelateOne) ?? item?.userId ?? null;
      const roleId = connectedId(resolved.role as RelateOne) ?? item?.roleId ?? null;
      if (!businessId || !userId || !roleId) {
        args.addValidationError("Employee business, user, and role are required");
        return;
      }

      const [role, user, duplicate] = await Promise.all([
        args.context.prisma.role.findFirst({ where: { id: roleId, businessId } }),
        args.context.prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
        args.context.prisma.employee.findFirst({
          where: {
            businessId,
            userId,
            ...(item?.id ? { id: { not: item.id } } : {}),
          },
          select: { id: true },
        }),
      ]);
      if (!role) args.addValidationError("Employee role must belong to the employee business");
      if (!user) args.addValidationError("Employee user does not exist");
      if (duplicate) args.addValidationError("A user may have only one employee record per business");
      const session = args.context.session as Session | undefined;
      if (!isHumanPlatformAdmin(session) && roleId !== item?.roleId) {
        if (!canAccessBusiness(session, businessId, "canManageRoles")) {
          args.addValidationError("Changing an employee role requires role-management permission");
        }
        if (role) {
          const rolePermissions = role as unknown as Record<string, unknown>;
          for (const permission of permissionKeys) {
            if (rolePermissions[permission] === true && !canAccessBusiness(session, businessId, permission)) {
              args.addValidationError(`An employee role cannot grant ${permission} beyond the manager's own permissions`);
            }
          }
        }
      }

      const storesInput = resolved.stores as RelateMany;
      if (storesInput?.create) {
        args.addValidationError("Employee stores must connect existing stores");
      }
      let storeIds = item?.id
        ? (await args.context.prisma.employee.findUnique({
            where: { id: item.id },
            select: { stores: { select: { id: true } } },
          }))?.stores.map((store: { id: string }) => store.id) ?? []
        : [];
      if (storesInput?.set) storeIds = relatedIds(storesInput.set);
      for (const id of relatedIds(storesInput?.disconnect)) storeIds = storeIds.filter((candidate: string) => candidate !== id);
      storeIds = Array.from(new Set([...storeIds, ...relatedIds(storesInput?.connect)]));
      if (storeIds.length) {
        const matchingStores = await args.context.prisma.store.count({
          where: { id: { in: storeIds }, businessId },
        });
        if (matchingStores !== storeIds.length) {
          args.addValidationError("Every employee store must belong to the employee business");
        }
        if (
          !isHumanPlatformAdmin(session) &&
          storeIds.some((storeId: string) => !canAccessStore(session, businessId, storeId, "canManagePeople"))
        ) {
          args.addValidationError("Employee stores cannot exceed the manager's store assignments");
        }
      }

      const managerId = connectedId(resolved.manager as RelateOne) ?? item?.managerId ?? null;
      if (managerId) {
        const manager = await args.context.prisma.employee.findFirst({
          where: { id: managerId, businessId },
          select: { id: true },
        });
        if (!manager || manager.id === item?.id) {
          args.addValidationError("Employee manager must be a different employee in the same business");
        }
      }
    },
  },
  ui: {
    labelField: "employeeNumber",
    listView: {
      initialColumns: ["employeeNumber", "user", "business", "role", "status"],
    },
  },
  fields: {
    business: relationship({ ref: "Business.employees", access: { update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    user: relationship({ ref: "User.employees", access: { update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
    role: relationship({ ref: "Role.employees" }),
    stores: relationship({ ref: "Store.employees", many: true }),
    employeeNumber: text({ validation: { isRequired: true }, isIndexed: true }),
    jobTitle: text(),
    status: select({
      type: "enum",
      options: [
        { label: "Invited", value: "invited" },
        { label: "Active", value: "active" },
        { label: "Leave", value: "leave" },
        { label: "Suspended", value: "suspended" },
        { label: "Terminated", value: "terminated" },
      ],
      defaultValue: "invited",
      validation: { isRequired: true },
    }),
    hireDate: timestamp(),
    terminatedAt: timestamp(),
    hourlyRateCents: centsField({ required: false }),
    overtimeEligible: checkbox({ defaultValue: true }),
    posPin: password({
      access: { read: denyAll, create: denyAll, update: denyAll },
      validation: {
        length: { min: 6, max: 12 },
        match: {
          regex: /^\d+$/,
          explanation: "POS PIN must contain digits only",
        },
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
      },
    }),
    manager: relationship({ ref: "Employee.directReports" }),
    directReports: relationship({ ref: "Employee.manager", many: true }),
    shifts: relationship({ ref: "Shift.employee", many: true }),
    registerSessions: relationship({ ref: "RegisterSession.employee", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

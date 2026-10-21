import { graphql, list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import {
  checkbox,
  integer,
  password,
  relationship,
  select,
  text,
  timestamp,
  virtual,
} from "@keystone-6/core/fields";

import {
  businessIdsForPermission,
  hasPermission,
  hasUnrestrictedStoreAccess,
  isHumanPlatformAdmin,
  isPlatformAdmin,
  isSignedIn,
  storeIdsForPermission,
  type Session,
} from "../access";
import { trackingFields } from "./trackingFields";

function userQueryFilter(session: Session | undefined) {
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
  const peopleFilter = businessIds.length && (unrestrictedMachine || storeIds.length)
    ? {
        employees: {
          some: {
            business: { id: { in: businessIds } },
            ...(unrestrictedMachine ? {} : {
              stores: {
                some: { id: { in: storeIds } },
                every: { id: { in: storeIds } },
              },
            }),
          },
        },
      }
    : null;
  return {
    OR: [
      ...(!session.apiKeyId ? [{ id: { equals: session.itemId } }] : []),
      ...(peopleFilter ? [peopleFilter] : []),
    ],
  };
}

function userUpdateFilter(session: Session | undefined) {
  if (isHumanPlatformAdmin(session)) return true;
  if (!session || session.apiKeyId) return false;
  return { id: { equals: session.itemId } };
}

export const User = list({
  access: {
    operation: {
      query: isSignedIn,
      // Storefront customers create their own accounts, as in E-commerce; every
      // privileged User field is create-denied below.
      create: (args) => !args.session?.apiKeyId,
      update: ({ session }) => Boolean(session && !session.apiKeyId),
      delete: () => false,
    },
    filter: {
      query: ({ session }) => userQueryFilter(session),
      update: ({ session }) => userUpdateFilter(session),
      delete: () => false,
    },
  },
  hooks: {
    resolveInput({ operation, resolvedData, item }) {
      if (
        operation === "update" &&
        (resolvedData.password !== undefined || resolvedData.email !== undefined)
      ) {
        return {
          ...resolvedData,
          sessionVersion: Number(item?.sessionVersion ?? 0) + 1,
        };
      }
      return resolvedData;
    },
  },
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "email", "onboardingStatus", "employees"] },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    email: text({
      isFilterable: false,
      isOrderable: false,
      isIndexed: "unique",
      validation: {
        isRequired: true,
        match: {
          regex: /^[^\s@\u0000-\u001f\u007f]+@[^\s@\u0000-\u001f\u007f]+\.[^\s@\u0000-\u001f\u007f]+$/,
          explanation: "Email must be a valid address without control characters",
        },
      },
    }),
    password: password({
      access: {
        read: denyAll,
        update: ({ session, item }) =>
          Boolean(!session?.apiKeyId && (isPlatformAdmin({ session }) || session?.itemId === item.id)),
      },
      validation: {
        isRequired: true,
        length: { min: 10, max: 1000 },
        rejectCommon: true,
      },
    }),
    isPlatformAdmin: checkbox({
      defaultValue: false,
      access: {
        read: isPlatformAdmin,
        create: () => false,
        update: () => false,
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
    platformAdminApprovedAt: timestamp({
      access: {
        create: () => false,
        update: () => false,
      },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "read" },
      },
    }),
    sessionVersion: integer({
      defaultValue: 0,
      validation: { isRequired: true, min: 0 },
      access: { read: isSignedIn, create: () => false, update: () => false },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
      },
    }),
    onboardingStatus: select({
      type: "enum",
      access: {
        update: (args) => isPlatformAdmin(args) || hasPermission(args, "canManageOnboarding"),
      },
      options: [
        { label: "Not Started", value: "not_started" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Dismissed", value: "dismissed" },
      ],
      defaultValue: "not_started",
      validation: { isRequired: true },
    }),
    phone: text(),
    employees: relationship({
      ref: "Employee.user",
      many: true,
      access: { create: () => false, update: () => false },
    }),
    carts: relationship({ ref: "Cart.customer", many: true, access: { create: () => false, update: () => false } }),
    sales: relationship({ ref: "Sale.customer", many: true, access: { create: () => false, update: () => false } }),
    loyaltyAccounts: relationship({ ref: "LoyaltyAccount.user", many: true, access: { create: () => false, update: () => false } }),
    apiKeys: relationship({ ref: "ApiKey.createdBy", many: true, access: { create: () => false, update: () => false } }),
    // The family dashboard core admits users through `authenticatedItem { role { canAccessDashboard
    // canManageOnboarding } }`. Convenience grants come from approved platform admins and active
    // employee roles, so this projects the signed-in human's own grants (the same hasPermission
    // checks as ui.isAccessAllowed and List access) into that shape. Other users read null.
    role: virtual({
      access: { read: ({ session, item }) => Boolean(session && !session.apiKeyId && session.itemId === item.id) },
      field: graphql.field({
        type: graphql.object<{ canAccessDashboard: boolean; canManageOnboarding: boolean }>()({
          name: "UserDashboardRole",
          fields: {
            canAccessDashboard: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
            canManageOnboarding: graphql.field({ type: graphql.nonNull(graphql.Boolean) }),
          },
        }),
        resolve(item, _args, context) {
          const session: Session | undefined = context.session;
          if (!session || session.apiKeyId || session.itemId !== item.id) return null;
          return {
            canAccessDashboard: hasPermission({ session }, "canAccessDashboard"),
            // Onboarding creates a new business, which only a platform administrator
            // may do; employees of an existing business never see the setup card.
            canManageOnboarding: isHumanPlatformAdmin(session),
          };
        },
      }),
      ui: {
        query: "{ canAccessDashboard canManageOnboarding }",
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
      },
    }),
    ...trackingFields,
  },
});

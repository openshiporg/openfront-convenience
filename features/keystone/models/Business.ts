import { list } from "@keystone-6/core";
import { relationship, select, text } from "@keystone-6/core/fields";

import {
  allBusinessIds,
  businessIdsForPermission,
  hasPermission,
  isHumanPlatformAdmin,
  isPlatformAdmin,
  isSignedIn,
  type Session,
} from "../access";
import { metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { sanitizeStoreLogoSvg } from "../../lib/sanitize-store-logo";
import { normalizeStoreLogoColor } from "../../platform/store-settings/lib/store-logo";

function businessIdFilter(session: Session | undefined, manage = false) {
  if (isHumanPlatformAdmin(session)) return true;
  const ids = manage
    ? businessIdsForPermission(session, "canManageBusiness")
    : allBusinessIds(session);
  return ids.length ? { id: { in: ids } } : false;
}

export const Business = list({
  access: {
    operation: {
      query: isSignedIn,
      create: isPlatformAdmin,
      update: ({ session }) =>
        Boolean(
          !session?.apiKeyId &&
          (isPlatformAdmin({ session }) ||
            hasPermission({ session }, "canManageBusiness")),
        ),
      delete: () => false,
    },
    filter: {
      query: ({ session }) => businessIdFilter(session),
      update: ({ session }) => businessIdFilter(session, true),
      delete: ({ session }) => businessIdFilter(session, true),
    },
  },
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["name", "code", "status", "defaultCurrencyCode"],
    },
  },
  fields: {
    name: text({
      validation: { isRequired: true },
      access: { update: () => false },
    }),
    legalName: text({ access: { update: () => false } }),
    code: text({
      isIndexed: "unique",
      access: { update: () => false },
      validation: {
        isRequired: true,
        match: {
          regex: /^[a-z0-9][a-z0-9-]{1,62}$/,
          explanation: "Business code must be a lowercase slug",
        },
      },
    }),
    brandName: text({
      access: { create: () => false, update: () => false },
    }),
    logoIcon: text({
      access: { create: () => false, update: () => false },
      hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === undefined ? undefined : sanitizeStoreLogoSvg(String(resolvedData[fieldKey] ?? "")) },
    }),
    logoColor: text({
      defaultValue: "0",
      access: { create: () => false, update: () => false },
      hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === undefined ? undefined : normalizeStoreLogoColor(resolvedData[fieldKey]) },
    }),
    brandTagline: text({
      access: { create: () => false, update: () => false },
    }),
    brandMark: text({
      access: { create: () => false, update: () => false },
      validation: {
        match: {
          regex: /^(?:|[A-Z0-9]{1,4})$/,
          explanation:
            "Brand mark must be empty or contain 1-4 uppercase letters or digits",
        },
      },
    }),
    brandPrimaryColor: text({
      access: { create: () => false, update: () => false },
      validation: {
        match: {
          regex: /^(?:|#[0-9A-F]{6})$/,
          explanation:
            "Brand color must be empty or an uppercase six-digit hex color",
        },
      },
    }),
    brandAccentColor: text({
      access: { create: () => false, update: () => false },
      validation: {
        match: {
          regex: /^(?:|#[0-9A-F]{6})$/,
          explanation:
            "Brand color must be empty or an uppercase six-digit hex color",
        },
      },
    }),
    storefrontMode: select({
      type: "enum",
      options: [
        { label: "Demo", value: "demo" },
        { label: "Live", value: "live" },
      ],
      defaultValue: "demo",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false },
    }),
    storefrontStatus: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Published", value: "published" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false },
    }),
    storefrontStore: relationship({
      ref: "Store",
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" } },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
      access: { update: ({ session }) => isPlatformAdmin({ session }) },
    }),
    defaultCurrencyCode: text({
      defaultValue: "USD",
      access: { update: () => false },
      validation: {
        isRequired: true,
        match: {
          regex: /^[A-Z]{3}$/,
          explanation: "Currency code must be a three-letter ISO 4217 code",
        },
      },
    }),
    timezone: text({
      defaultValue: "America/New_York",
      validation: { isRequired: true },
      access: { update: () => false },
    }),
    taxIdentifier: text({
      access: {
        read: ({ session }) =>
          isPlatformAdmin({ session }) ||
          hasPermission({ session }, "canManageBusiness"),
        create: ({ session }) =>
          isPlatformAdmin({ session }) ||
          hasPermission({ session }, "canManageBusiness"),
        update: () => false,
      },
    }),
    metadata: metadataField(),
    stores: relationship({
      ref: "Store.business",
      many: true,
      access: { create: () => false, update: () => false },
    }),
    roles: relationship({
      ref: "Role.business",
      many: true,
      access: { create: () => false, update: () => false },
    }),
    employees: relationship({
      ref: "Employee.business",
      many: true,
      access: { create: () => false, update: () => false },
    }),
    operationalHeartbeats: relationship({
      ref: "OperationalHeartbeat.business",
      many: true,
      access: { create: () => false, update: () => false },
    }),
    ...trackingFields,
  },
});

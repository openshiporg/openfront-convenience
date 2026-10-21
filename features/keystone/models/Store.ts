import { list } from "@keystone-6/core";
import { checkbox, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requireRelationshipId, requiredRelationshipHooks } from "./validation";

const storeRelationshipHooks = requiredRelationshipHooks("business");

export const Store = list({
  access: tenantAccess("canAccessDashboard", "canManageBusiness", {
    delete: false,
  }),
  hooks: {
    async resolveInput({ operation, resolvedData }) {
      if (operation !== "create") return resolvedData;
      const businessId = requireRelationshipId(resolvedData.business);
      const code =
        typeof resolvedData.code === "string"
          ? resolvedData.code.trim().toLowerCase()
          : "";
      return {
        ...resolvedData,
        code,
        ...(businessId && code ? { lookupKey: `${businessId}:${code}` } : {}),
      };
    },
    async validateInput(args) {
      await storeRelationshipHooks.validateInput?.(args);
      if (
        (args.context.session as { apiKeyId?: string } | undefined)?.apiKeyId
      ) {
        args.addValidationError(
          "Machine sessions cannot mutate tenant store configuration",
        );
        return;
      }
      const nextStatus = args.resolvedData.status;
      if (
        args.operation === "update" &&
        args.item?.id &&
        (nextStatus === "temporarily_closed" || nextStatus === "closed")
      ) {
        const activeSessions = await args.context.prisma.registerSession.count({
          where: {
            storeId: args.item.id,
            status: { in: ["open", "closing", "suspended"] },
          },
        });
        if (activeSessions > 0)
          args.addValidationError(
            "Close every active register session before closing a store",
          );
      }
    },
  },
  ui: {
    labelField: "name",
    listView: {
      initialColumns: ["name", "code", "business", "status", "fuelEnabled"],
    },
  },
  fields: {
    business: relationship({
      ref: "Business.stores",
      access: { update: () => false },
      ui: { itemView: { fieldMode: "read" } },
    }),
    name: text({ validation: { isRequired: true } }),
    code: text({
      validation: {
        isRequired: true,
        match: {
          regex: /^[a-z0-9][a-z0-9-]{0,62}$/,
          explanation: "Store code must be a lowercase slug",
        },
      },
      isIndexed: true,
      access: { update: () => false },
    }),
    lookupKey: text({
      isIndexed: "unique",
      validation: { isRequired: true },
      access: { create: () => false, update: () => false },
      ui: {
        description: "Globally unique business/store lookup key",
        itemView: { fieldMode: "read" },
      },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Temporarily Closed", value: "temporarily_closed" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    addressLine1: text(),
    addressLine2: text(),
    city: text(),
    stateProvince: text(),
    postalCode: text(),
    countryCode: text({ defaultValue: "US" }),
    phone: text(),
    currencyCode: text({
      defaultValue: "USD",
      validation: {
        isRequired: true,
        match: {
          regex: /^[A-Z]{3}$/,
          explanation: "Currency code must be a three-letter ISO 4217 code",
        },
      },
      access: { update: () => false },
    }),
    timezone: text({
      defaultValue: "America/New_York",
      validation: { isRequired: true },
    }),
    pricesIncludeTax: checkbox({
      defaultValue: false,
      access: { update: () => false },
    }),
    fuelEnabled: checkbox({
      defaultValue: false,
      access: { update: () => false },
    }),
    defaultPriceBook: relationship({
      ref: "PriceBook",
      access: { update: () => false },
      ui: { itemView: { fieldMode: "read" } },
    }),
    primaryInventoryLocation: relationship({
      ref: "InventoryLocation",
      access: { update: () => false },
      ui: { itemView: { fieldMode: "read" } },
    }),
    employees: relationship({
      ref: "Employee.stores",
      many: true,
      access: { create: () => false, update: () => false },
    }),
    registers: relationship({
      ref: "Register.store",
      many: true,
      access: { create: () => false, update: () => false },
    }),
    inventoryLocations: relationship({
      ref: "InventoryLocation.store",
      many: true,
      access: { create: () => false, update: () => false },
    }),
    taxRates: relationship({
      ref: "TaxRate.store",
      many: true,
      access: { create: () => false, update: () => false },
    }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

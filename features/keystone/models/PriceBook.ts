import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, currencyCodeField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks, validateEffectiveInterval } from "./validation";

export const PriceBook = list({
  access: tenantAccess("canReadPricing", "canManagePricing", { create: false, update: false, delete: false }),
  hooks: {
    validateInput(args) {
      requiredRelationshipHooks("business").validateInput(args);
      const resolvedData = args.resolvedData ?? {};
      validateEffectiveInterval({
        startsAt: resolvedData.startsAt ?? args.item?.startsAt,
        endsAt: resolvedData.endsAt ?? args.item?.endsAt,
        addValidationError: args.addValidationError,
      });
    },
  },
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "status", "priority", "currencyCode"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    currencyCode: currencyCodeField(),
    priority: integer({ defaultValue: 0 }),
    startsAt: timestamp(),
    endsAt: timestamp(),
    stores: relationship({ ref: "Store", many: true }),
    entries: relationship({ ref: "PriceBookEntry.priceBook", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

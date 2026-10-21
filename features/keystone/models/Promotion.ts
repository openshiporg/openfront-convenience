import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks, validateEffectiveInterval } from "./validation";

export const Promotion = list({
  access: tenantAccess("canReadPromotions", "canManagePromotions", { create: false, update: false, delete: false }),
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
    listView: { initialColumns: ["name", "code", "status", "priority", "startsAt", "endsAt"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    code: text({ isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Scheduled", value: "scheduled" },
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Expired", value: "expired" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    priority: integer({ defaultValue: 0 }),
    stackable: checkbox({ defaultValue: false }),
    requiresCode: checkbox({ defaultValue: false }),
    usageLimit: integer({ validation: { min: 1 } }),
    perCustomerLimit: integer({ validation: { min: 1 } }),
    startsAt: timestamp(),
    endsAt: timestamp(),
    stores: relationship({ ref: "Store", many: true }),
    rules: relationship({ ref: "PromotionRule.promotion", many: true }),
    redemptions: relationship({ ref: "PromotionRedemption.promotion", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

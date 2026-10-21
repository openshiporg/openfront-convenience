import { list } from "@keystone-6/core";
import { integer, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const LoyaltyProgram = list({
  access: tenantAccess("canReadLoyalty", "canManageLoyalty", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "status", "pointsPerDollar"] },
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
        { label: "Paused", value: "paused" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    pointsPerDollar: integer({ defaultValue: 1, validation: { min: 0 } }),
    redemptionPoints: integer({ defaultValue: 100, validation: { min: 1 } }),
    redemptionValueCents: centsField({ defaultValue: 100 }),
    pointsExpireAfterDays: integer({ validation: { min: 1 } }),
    accounts: relationship({ ref: "LoyaltyAccount.program", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

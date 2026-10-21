import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const LoyaltyAccount = list({
  access: tenantAccess("canReadLoyalty", "canManageLoyalty", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "program"),
  ui: {
    labelField: "accountNumber",
    listView: { initialColumns: ["accountNumber", "program", "user", "status", "pointsBalance", "tier"] },
  },
  fields: {
    business: businessField(),
    program: relationship({ ref: "LoyaltyProgram.accounts" }),
    user: relationship({ ref: "User.loyaltyAccounts" }),
    accountNumber: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    email: text({ isIndexed: true }),
    phone: text({ isIndexed: true }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    tier: text({ defaultValue: "standard", validation: { isRequired: true } }),
    pointsBalance: integer({
      access: { create: () => false, update: () => false },
      defaultValue: 0,
    }),
    lifetimePoints: integer({
      access: { create: () => false, update: () => false },
      defaultValue: 0,
      validation: { min: 0 },
    }),
    marketingOptIn: checkbox({ defaultValue: false }),
    firstVisitAt: timestamp(),
    lastVisitAt: timestamp(),
    entries: relationship({ ref: "LoyaltyLedgerEntry.account", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

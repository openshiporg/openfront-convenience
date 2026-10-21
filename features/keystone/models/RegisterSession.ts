import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const RegisterSession = list({
  access: tenantAccess("canReadCash", "canManageCash", {
    create: false,
    update: false,
    delete: false,
  }),
  hooks: requiredRelationshipHooks("business", "store", "register", "employee"),
  ui: {
    labelField: "sessionNumber",
    listView: { initialColumns: ["sessionNumber", "register", "employee", "status", "openedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    register: relationship({ ref: "Register.sessions" }),
    employee: relationship({ ref: "Employee.registerSessions" }),
    shift: relationship({ ref: "Shift.registerSessions" }),
    sessionNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      access: { create: () => false, update: () => false },
      options: [
        { label: "Open", value: "open" },
        { label: "Closing", value: "closing" },
        { label: "Suspended", value: "suspended" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "open",
      validation: { isRequired: true },
    }),
    openingCashCents: centsField({ defaultValue: 0 }),
    expectedCashCents: centsField({ defaultValue: 0 }),
    countedCashCents: centsField({ required: false }),
    overShortCents: centsField({ required: false, allowNegative: true }),
    openedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    closingStartedAt: timestamp(),
    closedAt: timestamp(),
    closingNotes: text({ ui: { displayMode: "textarea" } }),
    cashMovements: relationship({ ref: "CashMovement.registerSession", many: true }),
    sales: relationship({ ref: "Sale.registerSession", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

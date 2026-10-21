import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const Shift = list({
  access: tenantAccess("canReadPeople", "canManagePeople", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "employee"),
  ui: {
    labelField: "shiftNumber",
    listView: { initialColumns: ["shiftNumber", "employee", "store", "status", "startsAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    employee: relationship({ ref: "Employee.shifts" }),
    shiftNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    roleSnapshot: text(),
    status: select({
      type: "enum",
      access: { create: () => false, update: () => false },
      options: [
        { label: "Scheduled", value: "scheduled" },
        { label: "Clocked In", value: "clocked_in" },
        { label: "On Break", value: "on_break" },
        { label: "Completed", value: "completed" },
        { label: "No Show", value: "no_show" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "scheduled",
      validation: { isRequired: true },
    }),
    startsAt: timestamp({ validation: { isRequired: true } }),
    endsAt: timestamp({ validation: { isRequired: true } }),
    clockedInAt: timestamp(),
    clockedOutAt: timestamp(),
    breakMinutes: integer({ defaultValue: 0, validation: { min: 0 } }),
    hourlyRateCents: centsField({ required: false }),
    notes: text({ ui: { displayMode: "textarea" } }),
    registerSessions: relationship({ ref: "RegisterSession.shift", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

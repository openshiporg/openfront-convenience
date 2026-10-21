import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const InventoryCount = list({
  access: tenantAccess("canReadInventory", "canManageInventory", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "location"),
  ui: {
    labelField: "countNumber",
    listView: { initialColumns: ["countNumber", "store", "location", "status", "startedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    location: relationship({ ref: "InventoryLocation" }),
    countNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    type: select({
      type: "enum",
      options: [
        { label: "Full", value: "full" },
        { label: "Cycle", value: "cycle" },
        { label: "Spot", value: "spot" },
      ],
      defaultValue: "cycle",
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      access: { create: () => false, update: () => false },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Counting", value: "counting" },
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    startedAt: timestamp(),
    submittedAt: timestamp(),
    approvedAt: timestamp(),
    createdBy: relationship({ ref: "Employee" }),
    approvedBy: relationship({ ref: "Employee" }),
    lines: relationship({ ref: "InventoryCountLine.count", many: true }),
    notes: text({ ui: { displayMode: "textarea" } }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

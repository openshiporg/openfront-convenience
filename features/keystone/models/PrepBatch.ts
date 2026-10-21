import { list } from "@keystone-6/core";
import { decimal, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const PrepBatch = list({
  access: tenantAccess("canReadPreparedFood", "canManagePreparedFood", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "recipe"),
  ui: {
    labelField: "batchNumber",
    listView: { initialColumns: ["batchNumber", "recipe", "store", "status", "quantityMade", "expiresAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    batchNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    recipe: relationship({ ref: "Recipe.batches" }),
    status: select({
      type: "enum",
      access: { create: () => false, update: () => false },
      options: [
        { label: "Planned", value: "planned" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Discarded", value: "discarded" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "planned",
      validation: { isRequired: true },
    }),
    quantityPlanned: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    quantityMade: decimal({
      access: { create: () => false, update: () => false },
      precision: 18,
      scale: 4,
      defaultValue: "0.0000",
      validation: { isRequired: true, min: "0.0000" },
    }),
    actualCostCents: centsField({ defaultValue: 0 }),
    outputLot: relationship({ ref: "InventoryLot" }),
    preparedBy: relationship({ ref: "Employee" }),
    startedAt: timestamp(),
    completedAt: timestamp(),
    expiresAt: timestamp(),
    notes: text({ ui: { displayMode: "textarea" } }),
    wasteEvents: relationship({ ref: "WasteEvent.prepBatch", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

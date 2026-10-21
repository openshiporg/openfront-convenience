import { list } from "@keystone-6/core";
import { checkbox, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, quantityField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const Recipe = list({
  access: tenantAccess("canReadPreparedFood", "canManagePreparedFood", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "outputVariant"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "outputVariant", "status", "yieldQuantity", "active"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    outputVariant: relationship({ ref: "ProductVariant" }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    yieldQuantity: quantityField({ defaultValue: "1.0000", min: "0.0001" }),
    yieldUnit: text({ defaultValue: "each", validation: { isRequired: true } }),
    instructions: text({ ui: { displayMode: "textarea" } }),
    allergenNotes: text({ ui: { displayMode: "textarea" } }),
    active: checkbox({ defaultValue: true }),
    ingredients: relationship({ ref: "RecipeIngredient.recipe", many: true }),
    batches: relationship({ ref: "PrepBatch.recipe", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

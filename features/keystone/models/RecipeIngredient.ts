import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, quantityField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const RecipeIngredient = list({
  access: tenantAccess("canReadPreparedFood", "canManagePreparedFood", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "recipe", "inputVariant"),
  ui: {
    labelField: "nameSnapshot",
    listView: { initialColumns: ["recipe", "inputVariant", "quantity", "unit", "optional"] },
  },
  fields: {
    business: businessField(),
    recipe: relationship({ ref: "Recipe.ingredients" }),
    inputVariant: relationship({ ref: "ProductVariant" }),
    nameSnapshot: text({ validation: { isRequired: true } }),
    quantity: quantityField({ min: "0.0001" }),
    unit: text({ validation: { isRequired: true } }),
    wasteBasisPoints: integer({ defaultValue: 0, validation: { min: 0, max: 10000 } }),
    optional: checkbox({ defaultValue: false }),
    notes: text({ ui: { displayMode: "textarea" } }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

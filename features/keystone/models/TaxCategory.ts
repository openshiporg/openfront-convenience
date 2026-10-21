import { list } from "@keystone-6/core";
import { relationship, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const TaxCategory = list({
  access: tenantAccess("canReadPricing", "canManagePricing", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "business"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    description: text({ ui: { displayMode: "textarea" } }),
    products: relationship({ ref: "Product.taxCategory", many: true }),
    rates: relationship({ ref: "TaxRate.taxCategory", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

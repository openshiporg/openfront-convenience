import { list } from "@keystone-6/core";
import { checkbox, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const ProductCategory = list({
  access: tenantAccess("canReadCatalog", "canManageCatalog", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "parent", "status"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    description: text({ ui: { displayMode: "textarea" } }),
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
    requiresManagerApproval: checkbox({ defaultValue: false }),
    parent: relationship({ ref: "ProductCategory.children" }),
    children: relationship({ ref: "ProductCategory.parent", many: true }),
    products: relationship({ ref: "Product.categories", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

import { list } from "@keystone-6/core";
import {
  checkbox,
  integer,
  relationship,
  select,
  text,
} from "@keystone-6/core/fields";
import { document } from "@keystone-6/fields-document";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const Product = list({
  access: tenantAccess("canReadCatalog", "canManageCatalog", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business"),
  ui: {
    labelField: "title",
    listView: { initialColumns: ["title", "handle", "status", "taxCategory", "regulatedSaleType"] },
  },
  fields: {
    business: businessField(),
    title: text({ validation: { isRequired: true } }),
    handle: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    description: document({ formatting: true, links: true, dividers: true }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Discontinued", value: "discontinued" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    regulatedSaleType: select({
      type: "enum",
      options: [
        { label: "None", value: "none" },
        { label: "Alcohol", value: "alcohol" },
        { label: "Tobacco / Nicotine", value: "tobacco" },
        { label: "Lottery", value: "lottery" },
        { label: "OTC Medicine", value: "otc_medicine" },
        { label: "Other", value: "other" },
      ],
      defaultValue: "none",
      validation: { isRequired: true },
    }),
    minimumAge: integer({ validation: { min: 0, max: 120 } }),
    preparedFood: checkbox({ defaultValue: false }),
    discountable: checkbox({ defaultValue: true }),
    returnable: checkbox({ defaultValue: true }),
    taxCategory: relationship({ ref: "TaxCategory.products" }),
    categories: relationship({ ref: "ProductCategory.products", many: true }),
    images: relationship({ ref: "ProductImage.products", many: true }),
    variants: relationship({ ref: "ProductVariant.product", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

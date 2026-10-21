import { list } from "@keystone-6/core";
import { checkbox, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const ProductBarcode = list({
  access: tenantAccess("canReadCatalog", "canManageCatalog", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "variant"),
  ui: {
    labelField: "value",
    listView: { initialColumns: ["value", "format", "variant", "isPrimary", "status"] },
  },
  fields: {
    business: businessField(),
    variant: relationship({ ref: "ProductVariant.barcodes" }),
    value: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    format: select({
      type: "enum",
      options: [
        { label: "UPC-A", value: "upc_a" },
        { label: "UPC-E", value: "upc_e" },
        { label: "EAN-13", value: "ean_13" },
        { label: "EAN-8", value: "ean_8" },
        { label: "PLU", value: "plu" },
        { label: "GS1 DataBar", value: "gs1_databar" },
        { label: "Internal", value: "internal" },
      ],
      validation: { isRequired: true },
    }),
    embeddedDataType: select({
      type: "enum",
      options: [
        { label: "None", value: "none" },
        { label: "Price", value: "price" },
        { label: "Weight", value: "weight" },
      ],
      defaultValue: "none",
      validation: { isRequired: true },
    }),
    embeddedPrefix: text(),
    isPrimary: checkbox({ defaultValue: false }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

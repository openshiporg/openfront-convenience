import { list } from "@keystone-6/core";
import { checkbox, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const ProductVariant = list({
  access: tenantAccess("canReadCatalog", "canManageCatalog", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "product"),
  ui: {
    labelField: "sku",
    listView: { initialColumns: ["sku", "title", "product", "sellBy", "status"] },
  },
  fields: {
    business: businessField(),
    product: relationship({ ref: "Product.variants" }),
    title: text({ validation: { isRequired: true } }),
    sku: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Unavailable", value: "unavailable" },
        { label: "Discontinued", value: "discontinued" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    sellBy: select({
      type: "enum",
      options: [
        { label: "Unit", value: "unit" },
        { label: "Weight", value: "weight" },
        { label: "Volume", value: "volume" },
      ],
      defaultValue: "unit",
      validation: { isRequired: true },
    }),
    unitOfMeasure: select({
      type: "enum",
      options: [
        { label: "Each", value: "each" },
        { label: "Pound", value: "lb" },
        { label: "Ounce", value: "oz" },
        { label: "Kilogram", value: "kg" },
        { label: "Gram", value: "g" },
        { label: "Gallon", value: "gal" },
        { label: "Liter", value: "l" },
        { label: "Milliliter", value: "ml" },
      ],
      defaultValue: "each",
      validation: { isRequired: true },
    }),
    defaultPriceCents: centsField({ defaultValue: 0 }),
    costCents: centsField({
      required: false,
      description: "Current reference cost in cents; lot costs remain authoritative for valuation",
    }),
    trackInventory: checkbox({ defaultValue: true }),
    allowNegativeInventory: checkbox({ defaultValue: false }),
    barcodes: relationship({ ref: "ProductBarcode.variant", many: true }),
    priceEntries: relationship({ ref: "PriceBookEntry.variant", many: true }),
    stockLevels: relationship({ ref: "StockLevel.variant", many: true }),
    lots: relationship({ ref: "InventoryLot.variant", many: true }),
    vendorItems: relationship({ ref: "VendorItem.variant", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

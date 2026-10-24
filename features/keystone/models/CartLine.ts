import { list } from "@keystone-6/core";
import { checkbox, float, integer, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const CartLine = list({
  access: tenantAccess("canReadSales", "canManageSales", {
    create: false,
    update: false,
    delete: false,
  }),
  hooks: requiredRelationshipHooks("business", "store", "cart", "variant"),
  ui: {
    labelField: "titleSnapshot",
    listView: { initialColumns: ["cart", "titleSnapshot", "quantity", "unitPriceCents", "totalCents"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    cart: relationship({ ref: "Cart.lines" }),
    variant: relationship({ ref: "ProductVariant" }),
    barcode: relationship({ ref: "ProductBarcode" }),
    priceBookEntry: relationship({ ref: "PriceBookEntry" }),
    titleSnapshot: text({ validation: { isRequired: true } }),
    variantTitleSnapshot: text(),
    skuSnapshot: text(),
    barcodeSnapshot: text(),
    quantity: quantityField({ min: "0.0001" }),
    unitOfMeasure: text({ defaultValue: "each", validation: { isRequired: true } }),
    unitPriceCents: centsField(),
    subtotalCents: centsField(),
    discountCents: centsField({ defaultValue: 0 }),
    // Snapshot of the tax rate fraction applied to this line.
    taxRate: float({ defaultValue: 0, validation: { min: 0, max: 1 } }),
    taxInclusive: checkbox({ defaultValue: false }),
    taxCents: centsField({ defaultValue: 0 }),
    totalCents: centsField(),
    priceSource: select({
      type: "enum",
      options: [
        { label: "Price Book", value: "price_book" },
        { label: "Variant Default", value: "variant_default" },
        { label: "Embedded Barcode", value: "embedded_barcode" },
        { label: "Manager Override", value: "manager_override" },
      ],
      defaultValue: "price_book",
      validation: { isRequired: true },
    }),
    ageRestricted: checkbox({ defaultValue: false }),
    minimumAge: integer({ validation: { min: 0, max: 120 } }),
    promotions: relationship({ ref: "Promotion", many: true }),
    notes: text({ ui: { displayMode: "textarea" } }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

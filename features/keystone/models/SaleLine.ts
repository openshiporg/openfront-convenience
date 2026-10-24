import { list } from "@keystone-6/core";
import { checkbox, float, integer, json, relationship, text } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const SaleLine = list({
  access: immutableTenantAccess("canReadSales"),
  hooks: requiredRelationshipHooks("business", "store", "sale"),
  ui: {
    labelField: "titleSnapshot",
    listView: { initialColumns: ["sale", "titleSnapshot", "quantity", "unitPriceCents", "totalCents"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    sale: relationship({ ref: "Sale.lines" }),
    lineNumber: integer({ validation: { isRequired: true, min: 1 } }),
    titleSnapshot: text({ validation: { isRequired: true } }),
    variantTitleSnapshot: text(),
    skuSnapshot: text(),
    barcodeSnapshot: text(),
    imageUrlSnapshot: text(),
    productSnapshot: json({ defaultValue: {} }),
    quantity: quantityField({ min: "0.0001" }),
    unitOfMeasure: text({ validation: { isRequired: true } }),
    unitPriceCents: centsField(),
    subtotalCents: centsField(),
    discountCents: centsField({ defaultValue: 0 }),
    taxCategorySnapshot: text(),
    // Snapshot of the tax rate fraction applied to this line.
    taxRate: float({ defaultValue: 0, validation: { min: 0, max: 1 } }),
    taxInclusive: checkbox({ defaultValue: false }),
    taxCents: centsField({ defaultValue: 0 }),
    totalCents: centsField(),
    promotionSnapshot: json({ defaultValue: [] }),
    regulatedSaleType: text({ defaultValue: "none" }),
    minimumAge: integer({ validation: { min: 0, max: 120 } }),
    ageVerified: checkbox({ defaultValue: false }),
    product: relationship({ ref: "Product" }),
    variant: relationship({ ref: "ProductVariant" }),
    barcode: relationship({ ref: "ProductBarcode" }),
    ageVerification: relationship({ ref: "AgeVerification" }),
    inventoryEntries: relationship({ ref: "InventoryLedgerEntry.saleLine", many: true }),
    refundLines: relationship({ ref: "RefundLine.saleLine", many: true }),
    returnLines: relationship({ ref: "ReturnLine.saleLine", many: true }),
    metadata: metadataField("Immutable checkout-time line metadata"),
    ...trackingFields,
  },
});

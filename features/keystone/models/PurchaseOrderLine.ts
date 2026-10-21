import { list } from "@keystone-6/core";
import { decimal, relationship, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const PurchaseOrderLine = list({
  access: tenantAccess("canReadPurchasing", "canManagePurchasing", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "purchaseOrder", "variant"),
  ui: {
    labelField: "descriptionSnapshot",
    listView: { initialColumns: ["purchaseOrder", "variant", "quantityOrdered", "quantityReceived", "unitCostCents"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    purchaseOrder: relationship({ ref: "PurchaseOrder.lines" }),
    vendorItem: relationship({ ref: "VendorItem.purchaseOrderLines" }),
    variant: relationship({ ref: "ProductVariant" }),
    descriptionSnapshot: text({ validation: { isRequired: true } }),
    vendorSkuSnapshot: text(),
    quantityOrdered: quantityField({ min: "0.0001" }),
    quantityReceived: decimal({
      access: { create: () => false, update: () => false },
      precision: 18,
      scale: 4,
      defaultValue: "0.0000",
      validation: { isRequired: true, min: "0.0000" },
    }),
    quantityCancelled: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    unitCostCents: centsField(),
    lineTotalCents: centsField(),
    receivingLines: relationship({ ref: "ReceivingLine.purchaseOrderLine", many: true }),
    notes: text({ ui: { displayMode: "textarea" } }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

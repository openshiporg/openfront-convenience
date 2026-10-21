import { list } from "@keystone-6/core";
import { relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const ReceivingLine = list({
  access: tenantAccess("canReadPurchasing", "canManagePurchasing", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "receiving", "purchaseOrderLine", "variant"),
  ui: {
    labelField: "id",
    listView: { initialColumns: ["receiving", "variant", "quantityAccepted", "quantityRejected", "unitCostCents"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    receiving: relationship({ ref: "Receiving.lines" }),
    purchaseOrderLine: relationship({ ref: "PurchaseOrderLine.receivingLines" }),
    variant: relationship({ ref: "ProductVariant" }),
    quantityExpected: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    quantityAccepted: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    quantityRejected: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    rejectionReason: select({
      type: "enum",
      options: [
        { label: "None", value: "none" },
        { label: "Damaged", value: "damaged" },
        { label: "Expired", value: "expired" },
        { label: "Wrong Item", value: "wrong_item" },
        { label: "Overage", value: "overage" },
        { label: "Quality", value: "quality" },
      ],
      defaultValue: "none",
      validation: { isRequired: true },
    }),
    unitCostCents: centsField(),
    notes: text({ ui: { displayMode: "textarea" } }),
    lots: relationship({ ref: "InventoryLot.receivingLine", many: true }),
    inventoryEntries: relationship({ ref: "InventoryLedgerEntry.receivingLine", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

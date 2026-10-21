import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const InventoryCountLine = list({
  access: tenantAccess("canReadInventory", "canManageInventory", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "count", "stockLevel", "variant"),
  ui: {
    labelField: "id",
    listView: { initialColumns: ["count", "variant", "expectedQuantity", "actualQuantity", "varianceQuantity"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    count: relationship({ ref: "InventoryCount.lines" }),
    stockLevel: relationship({ ref: "StockLevel.countLines" }),
    variant: relationship({ ref: "ProductVariant" }),
    expectedQuantity: quantityField({ defaultValue: "0.0000" }),
    actualQuantity: quantityField({ required: false, min: "0.0000" }),
    varianceQuantity: quantityField({ defaultValue: "0.0000" }),
    unitCostCents: centsField({ required: false }),
    lotNumber: text(),
    expiresAt: timestamp(),
    reason: text(),
    countedBy: relationship({ ref: "Employee" }),
    ledgerEntry: relationship({ ref: "InventoryLedgerEntry.countLine" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

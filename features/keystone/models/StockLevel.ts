import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const StockLevel = list({
  access: tenantAccess("canReadInventory", "canManageInventory", {
    create: false,
    update: false,
    delete: false,
  }),
  hooks: requiredRelationshipHooks("business", "store", "location", "variant"),
  ui: {
    labelField: "lookupKey",
    listView: { initialColumns: ["variant", "location", "onHandQuantity", "reservedQuantity", "reorderPoint"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    location: relationship({ ref: "InventoryLocation.stockLevels" }),
    variant: relationship({ ref: "ProductVariant.stockLevels" }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    onHandQuantity: quantityField({ defaultValue: "0.0000" }),
    reservedQuantity: quantityField({ defaultValue: "0.0000" }),
    parQuantity: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    reorderPoint: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    reorderQuantity: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    lastCountedAt: timestamp(),
    ledgerEntries: relationship({ ref: "InventoryLedgerEntry.stockLevel", many: true }),
    countLines: relationship({ ref: "InventoryCountLine.stockLevel", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

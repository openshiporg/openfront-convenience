import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const InventoryLot = list({
  access: tenantAccess("canReadInventory", "canManageInventory", {
    create: false,
    update: false,
    delete: false,
  }),
  hooks: requiredRelationshipHooks("business", "store", "location", "variant"),
  ui: {
    labelField: "lotNumber",
    listView: { initialColumns: ["lotNumber", "variant", "location", "quantityRemaining", "expiresAt", "status"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    location: relationship({ ref: "InventoryLocation" }),
    variant: relationship({ ref: "ProductVariant.lots" }),
    vendor: relationship({ ref: "Vendor" }),
    receivingLine: relationship({ ref: "ReceivingLine.lots" }),
    lotNumber: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    quantityReceived: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    quantityRemaining: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    unitCostCents: centsField({ defaultValue: 0 }),
    receivedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    expiresAt: timestamp(),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Quarantined", value: "quarantined" },
        { label: "Consumed", value: "consumed" },
        { label: "Expired", value: "expired" },
        { label: "Recalled", value: "recalled" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    ledgerEntries: relationship({ ref: "InventoryLedgerEntry.lot", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

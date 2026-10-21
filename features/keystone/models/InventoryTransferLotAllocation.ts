import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const InventoryTransferLotAllocation = list({
  access: immutableTenantAccess("canReadInventory"),
  hooks: requiredRelationshipHooks("business", "line"),
  ui: {
    labelField: "allocationKey",
    listView: { initialColumns: ["line", "sourceLot", "destinationLot", "quantity", "lotNumberSnapshot"] },
  },
  fields: {
    business: businessField(),
    line: relationship({ ref: "InventoryTransferLine.allocations" }),
    sourceLot: relationship({ ref: "InventoryLot" }),
    destinationLot: relationship({ ref: "InventoryLot" }),
    allocationKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    quantity: quantityField({ min: "0.0001" }),
    lotNumberSnapshot: text({ validation: { isRequired: true } }),
    expiresAtSnapshot: timestamp(),
    unitCostCents: centsField({ defaultValue: 0 }),
    metadata: metadataField("Preserves lot custody from source to destination"),
    ...trackingFields,
  },
});

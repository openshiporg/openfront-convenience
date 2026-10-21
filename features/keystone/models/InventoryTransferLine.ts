import { list } from "@keystone-6/core";
import { integer, relationship, text } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField, quantityField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const InventoryTransferLine = list({
  access: immutableTenantAccess("canReadInventory"),
  hooks: requiredRelationshipHooks("business", "transfer", "variant"),
  ui: {
    labelField: "skuSnapshot",
    listView: { initialColumns: ["transfer", "lineNumber", "skuSnapshot", "quantityRequested", "quantityShipped", "quantityReceived"] },
  },
  fields: {
    business: businessField(),
    transfer: relationship({ ref: "InventoryTransfer.lines" }),
    variant: relationship({ ref: "ProductVariant" }),
    lineNumber: integer({ validation: { isRequired: true, min: 1 } }),
    skuSnapshot: text({ validation: { isRequired: true } }),
    titleSnapshot: text({ validation: { isRequired: true } }),
    quantityRequested: quantityField({ min: "0.0001" }),
    quantityShipped: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    quantityReceived: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    allocations: relationship({ ref: "InventoryTransferLotAllocation.line", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

import { list } from "@keystone-6/core";
import { relationship, select, text } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const ReturnLine = list({
  access: immutableTenantAccess("canReadSales"),
  hooks: requiredRelationshipHooks("business", "store", "return", "saleLine"),
  ui: {
    labelField: "id",
    listView: { initialColumns: ["return", "saleLine", "quantity", "disposition"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    return: relationship({ ref: "Return.lines" }),
    saleLine: relationship({ ref: "SaleLine.returnLines" }),
    quantity: quantityField({ min: "0.0001" }),
    disposition: select({
      type: "enum",
      options: [
        { label: "Restock", value: "restock" },
        { label: "Quarantine", value: "quarantine" },
        { label: "Destroy", value: "destroy" },
        { label: "Return to Vendor", value: "return_to_vendor" },
        { label: "No Inventory Action", value: "no_inventory_action" },
      ],
      validation: { isRequired: true },
    }),
    condition: select({
      type: "enum",
      options: [
        { label: "Sealed", value: "sealed" },
        { label: "Opened", value: "opened" },
        { label: "Damaged", value: "damaged" },
        { label: "Expired", value: "expired" },
        { label: "Unknown", value: "unknown" },
      ],
      defaultValue: "unknown",
      validation: { isRequired: true },
    }),
    refundLine: relationship({ ref: "RefundLine.returnLine" }),
    restockLedgerEntries: relationship({
      ref: "InventoryLedgerEntry.returnLine",
      many: true,
    }),
    note: text({ ui: { displayMode: "textarea" } }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

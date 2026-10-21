import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import {
  businessField,
  centsField,
  metadataField,
  quantityField,
  storeField,
} from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const InventoryLedgerEntry = list({
  access: immutableTenantAccess("canReadInventory"),
  hooks: requiredRelationshipHooks(
    "business",
    "store",
    "stockLevel",
    "location",
    "variant",
  ),
  ui: {
    labelField: "reason",
    listView: {
      initialColumns: [
        "variant",
        "location",
        "type",
        "quantityDelta",
        "balanceAfter",
        "occurredAt",
      ],
    },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    stockLevel: relationship({ ref: "StockLevel.ledgerEntries" }),
    location: relationship({ ref: "InventoryLocation" }),
    variant: relationship({ ref: "ProductVariant" }),
    lot: relationship({ ref: "InventoryLot.ledgerEntries" }),
    type: select({
      type: "enum",
      options: [
        { label: "Opening Balance", value: "opening_balance" },
        { label: "Receiving", value: "receiving" },
        { label: "Sale", value: "sale" },
        { label: "Return", value: "return" },
        { label: "Count Adjustment", value: "count_adjustment" },
        { label: "Transfer In", value: "transfer_in" },
        { label: "Transfer Out", value: "transfer_out" },
        { label: "Production Input", value: "production_input" },
        { label: "Production Output", value: "production_output" },
        { label: "Waste", value: "waste" },
        { label: "Spoilage", value: "spoilage" },
        { label: "Theft", value: "theft" },
        { label: "Correction", value: "correction" },
      ],
      validation: { isRequired: true },
    }),
    quantityDelta: quantityField(),
    balanceAfter: quantityField(),
    unitCostCents: centsField({ required: false }),
    reason: text({ validation: { isRequired: true } }),
    sourceType: text(),
    sourceId: text({ isIndexed: true }),
    receivingLine: relationship({ ref: "ReceivingLine.inventoryEntries" }),
    saleLine: relationship({ ref: "SaleLine.inventoryEntries" }),
    countLine: relationship({ ref: "InventoryCountLine.ledgerEntry" }),
    returnLine: relationship({ ref: "ReturnLine.restockLedgerEntries" }),
    wasteEvent: relationship({ ref: "WasteEvent.ledgerEntries" }),
    actor: relationship({ ref: "Employee" }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    occurredAt: timestamp({
      defaultValue: { kind: "now" },
      validation: { isRequired: true },
    }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

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

export const WasteEvent = list({
  access: immutableTenantAccess("canReadPreparedFood"),
  hooks: requiredRelationshipHooks("business", "store", "variant", "loggedBy"),
  ui: {
    labelField: "eventNumber",
    listView: {
      initialColumns: [
        "eventNumber",
        "variant",
        "reason",
        "quantity",
        "costCents",
        "occurredAt",
      ],
    },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    eventNumber: text({
      isIndexed: "unique",
      validation: { isRequired: true },
    }),
    variant: relationship({ ref: "ProductVariant" }),
    lot: relationship({ ref: "InventoryLot" }),
    prepBatch: relationship({ ref: "PrepBatch.wasteEvents" }),
    reason: select({
      type: "enum",
      options: [
        { label: "Expired", value: "expired" },
        { label: "Spoilage", value: "spoilage" },
        { label: "Preparation Error", value: "preparation_error" },
        { label: "Overproduction", value: "overproduction" },
        { label: "Quality", value: "quality" },
        { label: "Damaged", value: "damaged" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    quantity: quantityField({ min: "0.0001" }),
    costCents: centsField({ defaultValue: 0 }),
    loggedBy: relationship({ ref: "Employee" }),
    occurredAt: timestamp({
      defaultValue: { kind: "now" },
      validation: { isRequired: true },
    }),
    notes: text({ ui: { displayMode: "textarea" } }),
    ledgerEntries: relationship({
      ref: "InventoryLedgerEntry.wasteEvent",
      many: true,
    }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

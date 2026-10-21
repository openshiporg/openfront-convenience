import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const ExportBatch = list({
  access: immutableTenantAccess("canReadExports"),
  hooks: requiredRelationshipHooks("business", "destination"),
  ui: {
    labelField: "batchNumber",
    listView: { initialColumns: ["batchNumber", "destination", "type", "status", "rowCount", "generatedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    destination: relationship({ ref: "ExportDestination.batches" }),
    batchNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: select({
      type: "enum",
      options: [
        { label: "Daily Sales", value: "daily_sales" },
        { label: "Purchasing", value: "purchasing" },
        { label: "Inventory", value: "inventory" },
        { label: "Fuel", value: "fuel" },
        { label: "Lottery", value: "lottery" },
        { label: "Money Services", value: "money_services" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Ready", value: "ready" },
        { label: "Delivering", value: "delivering" },
        { label: "Delivered", value: "delivered" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" },
      ],
      validation: { isRequired: true },
    }),
    periodStartedAt: timestamp({ validation: { isRequired: true } }),
    periodEndedAt: timestamp({ validation: { isRequired: true } }),
    currencyCode: currencyCodeField(),
    rowCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    debitTotalCents: centsField({ defaultValue: 0 }),
    creditTotalCents: centsField({ defaultValue: 0 }),
    checksum: text({ validation: { isRequired: true } }),
    artifactFilename: text(),
    artifactSizeBytes: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    artifactContent: text({
      access: { read: denyAll },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),
    objectReference: text({ ui: { description: "Opaque object-store/export artifact reference; never credentials" } }),
    externalReference: text({ isIndexed: true }),
    generatedAt: timestamp({ validation: { isRequired: true } }),
    generatedBy: relationship({ ref: "Employee" }),
    deliveredAt: timestamp(),
    failedAt: timestamp(),
    failureMessage: text({ ui: { displayMode: "textarea" } }),
    lines: relationship({ ref: "ExportLine.batch", many: true }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("Immutable source scope and adapter-safe export metadata"),
    ...trackingFields,
  },
});

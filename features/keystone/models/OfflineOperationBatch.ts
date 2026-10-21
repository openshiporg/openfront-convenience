import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const OfflineOperationBatch = list({
  access: immutableTenantAccess("canReadOfflineOperations"),
  hooks: requiredRelationshipHooks("business", "store", "device"),
  ui: {
    labelField: "batchNumber",
    listView: { initialColumns: ["batchNumber", "device", "status", "firstSequence", "lastSequence", "conflictCount", "receivedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    device: relationship({ ref: "OfflineDevice.batches" }),
    batchNumber: text({ validation: { isRequired: true } }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    requestDigest: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Completed", value: "completed" },
        { label: "Partial", value: "partial" },
        { label: "Conflict", value: "conflict" },
        { label: "Rejected", value: "rejected" },
      ],
      validation: { isRequired: true },
      isIndexed: true,
    }),
    firstSequence: integer({ validation: { isRequired: true, min: 1 } }),
    lastSequence: integer({ validation: { isRequired: true, min: 1 } }),
    operationCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    appliedCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    replayedCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    conflictCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    rejectedCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    operations: relationship({ ref: "OfflineOperation.batch", many: true }),
    receivedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    processedAt: timestamp({ validation: { isRequired: true } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("Outcome evidence only; operation payloads are not retained"),
    ...trackingFields,
  },
});

import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const OfflineOperation = list({
  access: immutableTenantAccess("canReadOfflineOperations"),
  hooks: requiredRelationshipHooks("business", "store", "batch"),
  ui: {
    labelField: "operationKey",
    listView: { initialColumns: ["batch", "sequence", "operationType", "outcome", "resourceType", "occurredAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    batch: relationship({ ref: "OfflineOperationBatch.operations" }),
    sequence: integer({ validation: { isRequired: true, min: 1 } }),
    operationKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    operationType: text({ validation: { isRequired: true }, isIndexed: true }),
    idempotencyKeyDigest: text({ validation: { isRequired: true } }),
    requestDigest: text({ validation: { isRequired: true } }),
    outcome: select({
      type: "enum",
      options: [
        { label: "Applied", value: "applied" },
        { label: "Replayed", value: "replayed" },
        { label: "Conflict", value: "conflict" },
        { label: "Rejected", value: "rejected" },
      ],
      validation: { isRequired: true },
      isIndexed: true,
    }),
    resourceType: text(),
    resourceId: text(),
    errorCode: text(),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    metadata: metadataField("No customer, payment, or credential payload"),
    ...trackingFields,
  },
});

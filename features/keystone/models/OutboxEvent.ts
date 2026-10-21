import { list } from "@keystone-6/core";
import { integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const OutboxEvent = list({
  access: immutableTenantAccess("canReadIntegrations"),
  hooks: requiredRelationshipHooks("business"),
  ui: {
    labelField: "eventKey",
    listView: { initialColumns: ["topic", "aggregateType", "aggregateId", "status", "availableAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    eventKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    topic: text({ validation: { isRequired: true }, isIndexed: true }),
    schemaVersion: integer({ defaultValue: 1, validation: { isRequired: true, min: 1 } }),
    aggregateType: text({ validation: { isRequired: true }, isIndexed: true }),
    aggregateId: text({ validation: { isRequired: true }, isIndexed: true }),
    action: text({ validation: { isRequired: true }, isIndexed: true }),
    payload: json({ defaultValue: {} }),
    payloadHash: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Processing", value: "processing" },
        { label: "Retry", value: "retry" },
        { label: "Delivered", value: "delivered" },
        { label: "Dead Letter", value: "dead_letter" },
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
      isIndexed: true,
    }),
    attempts: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    totalAttempts: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    replayCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    maxAttempts: integer({ defaultValue: 8, validation: { isRequired: true, min: 1 } }),
    availableAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true }, isIndexed: true }),
    lockedAt: timestamp(),
    lockOwner: text(),
    deliveredAt: timestamp(),
    deadLetteredAt: timestamp(),
    lastError: text({ ui: { displayMode: "textarea" } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    attemptsLog: relationship({ ref: "OutboxAttempt.event", many: true }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    metadata: metadataField("Durable propagation state; payload is an immutable operation snapshot"),
    ...trackingFields,
  },
});

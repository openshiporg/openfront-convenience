import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const WebhookEvent = list({
  access: immutableTenantAccess("canReadIntegrations"),
  hooks: requiredRelationshipHooks("business", "paymentProvider"),
  ui: {
    labelField: "lookupKey",
    listView: { initialColumns: ["eventType", "externalEventId", "status", "attemptCount", "receivedAt"] },
  },
  fields: {
    business: businessField(),
    paymentProvider: relationship({ ref: "PaymentProvider" }),
    externalEventId: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    eventType: text({ validation: { isRequired: true }, isIndexed: true }),
    payloadDigest: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Received", value: "received" },
        { label: "Processing", value: "processing" },
        { label: "Processed", value: "processed" },
        { label: "Ignored", value: "ignored" },
        { label: "Failed", value: "failed" },
      ],
      defaultValue: "received",
      validation: { isRequired: true },
    }),
    attemptCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    receivedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    processedAt: timestamp(),
    lastError: text({ ui: { displayMode: "textarea" } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("No raw webhook payloads or credentials"),
    ...trackingFields,
  },
});

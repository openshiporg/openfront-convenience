import { list } from "@keystone-6/core";
import { json, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { assertNoInlineSecrets } from "../lib/secretPolicy";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const AuditEvent = list({
  access: immutableTenantAccess("canReadAudit"),
  hooks: {
    validateInput(args) {
      requiredRelationshipHooks("business").validateInput(args);
      for (const value of [args.resolvedData?.changes, args.resolvedData?.metadata]) {
        if (value === undefined) continue;
        try {
          assertNoInlineSecrets(value);
        } catch (error) {
          args.addValidationError(error instanceof Error ? error.message : "Audit data contains a secret-like value");
        }
      }
    },
  },
  ui: {
    labelField: "eventNumber",
    listView: { initialColumns: ["eventNumber", "action", "resourceType", "result", "actorUser", "occurredAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    eventNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    action: text({ validation: { isRequired: true }, isIndexed: true }),
    resourceType: text({ validation: { isRequired: true }, isIndexed: true }),
    resourceId: text({ isIndexed: true }),
    result: select({
      type: "enum",
      options: [
        { label: "Succeeded", value: "succeeded" },
        { label: "Denied", value: "denied" },
        { label: "Failed", value: "failed" },
      ],
      validation: { isRequired: true },
    }),
    actorType: select({
      type: "enum",
      options: [
        { label: "User", value: "user" },
        { label: "API Key", value: "api_key" },
        { label: "System", value: "system" },
        { label: "Integration", value: "integration" },
      ],
      validation: { isRequired: true },
    }),
    actorUser: relationship({ ref: "User" }),
    actorEmployee: relationship({ ref: "Employee" }),
    actorApiKey: relationship({ ref: "ApiKey" }),
    requestId: text({ isIndexed: true }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    changes: json({ ui: { description: "Redacted before/after summary; secret-like keys are rejected" } }),
    sourceIpDigest: text(),
    userAgent: text(),
    occurredAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    metadata: metadataField("Redacted operational context only"),
    ...trackingFields,
  },
});

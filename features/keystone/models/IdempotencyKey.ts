import { list } from "@keystone-6/core";
import { json, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const IdempotencyKey = list({
  access: immutableTenantAccess("canReadAudit"),
  hooks: requiredRelationshipHooks("business"),
  ui: {
    labelField: "lookupKey",
    listView: { initialColumns: ["scope", "keyDigest", "state", "startedAt", "completedAt"] },
  },
  fields: {
    business: businessField(),
    scope: text({ validation: { isRequired: true }, isIndexed: true }),
    keyDigest: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    requestDigest: text({ validation: { isRequired: true } }),
    state: select({
      type: "enum",
      options: [
        { label: "Processing", value: "processing" },
        { label: "Succeeded", value: "succeeded" },
        { label: "Failed", value: "failed" },
      ],
      defaultValue: "processing",
      validation: { isRequired: true },
    }),
    responseCode: text(),
    responseDigest: text(),
    responseSnapshot: json({
      ui: { description: "Minimal replay result; never include credentials or full payment payloads" },
    }),
    startedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    completedAt: timestamp(),
    expiresAt: timestamp({ validation: { isRequired: true } }),
    actorUser: relationship({ ref: "User" }),
    actorApiKey: relationship({ ref: "ApiKey" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

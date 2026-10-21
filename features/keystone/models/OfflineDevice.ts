import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const OfflineDevice = list({
  access: tenantAccess("canReadOfflineOperations", "canManageOfflineOperations", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "deviceCode", "store", "status", "lastSequence", "lastSeenAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    apiKey: relationship({ ref: "ApiKey" }),
    name: text({ validation: { isRequired: true } }),
    deviceCode: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Revoked", value: "revoked" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
      isIndexed: true,
    }),
    lastSequence: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    lastSeenAt: timestamp(),
    revokedAt: timestamp(),
    batches: relationship({ ref: "OfflineOperationBatch.device", many: true }),
    metadata: metadataField("Device identity and monotonic replay cursor; no local secrets"),
    ...trackingFields,
  },
});

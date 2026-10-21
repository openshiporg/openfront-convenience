import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { checkbox, integer, json, password, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const ApiKey = list({
  access: tenantAccess("canManageApiKeys", "canManageApiKeys", {
    create: false,
    update: false,
    delete: false,
  }),
  hooks: requiredRelationshipHooks("business"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "keyPrefix", "status", "expiresAt", "lastUsedAt"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    keyPrefix: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    secretHash: password({
      access: { read: denyAll },
      validation: { isRequired: true },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "Generated only by the API-key creation operation; plaintext is returned once",
      },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Revoked", value: "revoked" },
        { label: "Expired", value: "expired" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    scopes: json({ defaultValue: [] }),
    allStores: checkbox({ defaultValue: false }),
    stores: relationship({ ref: "Store", many: true }),
    createdBy: relationship({ ref: "User.apiKeys" }),
    expiresAt: timestamp(),
    revokedAt: timestamp(),
    lastUsedAt: timestamp(),
    failedAuthCount: integer({
      access: { read: denyAll },
      defaultValue: 0,
      validation: { isRequired: true, min: 0 },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),
    failedAuthResetAt: timestamp({
      access: { read: denyAll },
      ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

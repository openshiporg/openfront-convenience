import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const Register = list({
  access: tenantAccess("canReadCash", "canManageCash", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "store", "status", "lastHeartbeatAt"] },
  },
  fields: {
    business: businessField(),
    store: relationship({ ref: "Store.registers" }),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Offline", value: "offline" },
        { label: "Maintenance", value: "maintenance" },
        { label: "Retired", value: "retired" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    deviceIdentifier: text({ isIndexed: true }),
    lastHeartbeatAt: timestamp(),
    sessions: relationship({ ref: "RegisterSession.register", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

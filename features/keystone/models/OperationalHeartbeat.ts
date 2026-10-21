import { list } from "@keystone-6/core";
import { json, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const OperationalHeartbeat = list({
  access: immutableTenantAccess("canReadIntegrations"),
  hooks: requiredRelationshipHooks("business"),
  ui: { labelField: "heartbeatKey", listView: { initialColumns: ["kind", "status", "occurredAt"] } },
  fields: {
    business: relationship({ ref: "Business.operationalHeartbeats" }),
    heartbeatKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    kind: select({
      type: "enum",
      options: [
        { label: "Outbox", value: "outbox" },
        { label: "Alerts", value: "alerts" },
        { label: "Backup", value: "backup" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Healthy", value: "healthy" },
        { label: "Failed", value: "failed" },
      ],
      validation: { isRequired: true },
    }),
    workerId: text(),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    details: json({ defaultValue: {} }),
    ...trackingFields,
  },
});

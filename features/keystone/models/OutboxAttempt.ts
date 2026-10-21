import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const OutboxAttempt = list({
  access: immutableTenantAccess("canReadIntegrations"),
  hooks: requiredRelationshipHooks("business", "event"),
  ui: {
    labelField: "attemptKey",
    listView: { initialColumns: ["event", "attemptNumber", "outcome", "workerId", "finishedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    event: relationship({ ref: "OutboxEvent.attemptsLog" }),
    attemptKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    attemptNumber: integer({ validation: { isRequired: true, min: 1 } }),
    workerId: text({ validation: { isRequired: true }, isIndexed: true }),
    outcome: select({
      type: "enum",
      options: [
        { label: "Processing", value: "processing" },
        { label: "Delivered", value: "delivered" },
        { label: "Retry", value: "retry" },
        { label: "Dead Letter", value: "dead_letter" },
        { label: "Abandoned", value: "abandoned" },
      ],
      defaultValue: "processing",
      validation: { isRequired: true },
      isIndexed: true,
    }),
    startedAt: timestamp({ validation: { isRequired: true } }),
    finishedAt: timestamp(),
    error: text({ ui: { displayMode: "textarea" } }),
    metadata: metadataField("Immutable delivery-attempt evidence"),
    ...trackingFields,
  },
});

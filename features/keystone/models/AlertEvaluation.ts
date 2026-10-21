import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const AlertEvaluation = list({
  access: immutableTenantAccess("canReadAlerts"),
  hooks: requiredRelationshipHooks("business"),
  ui: {
    labelField: "evaluationNumber",
    listView: { initialColumns: ["evaluationNumber", "store", "status", "createdCount", "existingCount", "evaluatedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    evaluationNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: select({
      type: "enum",
      options: [
        { label: "Completed", value: "completed" },
        { label: "Failed", value: "failed" },
      ],
      validation: { isRequired: true },
    }),
    evaluatedAt: timestamp({ validation: { isRequired: true } }),
    createdCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    existingCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    alerts: relationship({ ref: "OperationalAlert.evaluation", many: true }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("Threshold snapshot and evaluation scope"),
    ...trackingFields,
  },
});

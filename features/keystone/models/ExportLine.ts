import { list } from "@keystone-6/core";
import { integer, json, relationship, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const ExportLine = list({
  access: immutableTenantAccess("canReadExports"),
  hooks: requiredRelationshipHooks("business", "batch"),
  ui: {
    labelField: "description",
    listView: { initialColumns: ["batch", "lineNumber", "accountCode", "debitCents", "creditCents", "sourceType"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    batch: relationship({ ref: "ExportBatch.lines" }),
    lineNumber: integer({ validation: { isRequired: true, min: 1 } }),
    accountCode: text({ validation: { isRequired: true } }),
    description: text({ validation: { isRequired: true } }),
    debitCents: centsField({ defaultValue: 0 }),
    creditCents: centsField({ defaultValue: 0 }),
    sourceType: text({ validation: { isRequired: true } }),
    sourceId: text({ validation: { isRequired: true }, isIndexed: true }),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    dimensions: json({ defaultValue: {}, ui: { description: "Non-secret accounting dimensions" } }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

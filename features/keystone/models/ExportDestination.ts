import { denyAll } from "@keystone-6/core/access";
import { list } from "@keystone-6/core";
import { json, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { assertNoInlineSecrets, assertOpaqueSecretReference } from "../lib/secretPolicy";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const ExportDestination = list({
  access: tenantAccess("canReadExports", "canManageExports", { create: false, update: false, delete: false }),
  hooks: {
    validateInput(args) {
      requiredRelationshipHooks("business").validateInput(args);
      try {
        if (args.resolvedData?.configuration !== undefined) assertNoInlineSecrets(args.resolvedData.configuration);
        if (args.resolvedData?.credentialReference !== undefined) {
          assertOpaqueSecretReference(args.resolvedData.credentialReference);
        }
      } catch (error) {
        args.addValidationError(error instanceof Error ? error.message : "Invalid export destination");
      }
    },
  },
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "type", "adapterKey", "status"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: select({
      type: "enum",
      options: [
        { label: "Accounting", value: "accounting" },
        { label: "Provider", value: "provider" },
        { label: "Data Warehouse", value: "data_warehouse" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Configured", value: "configured" },
        { label: "Active", value: "active" },
        { label: "Disabled", value: "disabled" },
        { label: "Error", value: "error" },
      ],
      defaultValue: "configured",
      validation: { isRequired: true },
    }),
    adapterKey: text({ validation: { isRequired: true } }),
    credentialReference: text({
      access: { read: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "Opaque secret-manager reference only",
      },
    }),
    configuration: json({ defaultValue: {}, ui: { description: "Non-secret account mapping and adapter configuration" } }),
    stores: relationship({ ref: "Store", many: true }),
    batches: relationship({ ref: "ExportBatch.destination", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { json, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import {
  assertNoInlineSecrets,
  assertOpaqueSecretReference,
} from "../lib/secretPolicy";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const PaymentProvider = list({
  access: tenantAccess("canReadIntegrations", "canManageIntegrations", { create: false, update: false, delete: false }),
  hooks: {
    validateInput(args) {
      requiredRelationshipHooks("business").validateInput(args);
      try {
        if (args.resolvedData?.configuration !== undefined) {
          assertNoInlineSecrets(args.resolvedData.configuration);
        }
        if (args.resolvedData?.credentialReference !== undefined) {
          assertOpaqueSecretReference(args.resolvedData.credentialReference);
        }
      } catch (error) {
        args.addValidationError(error instanceof Error ? error.message : "Invalid provider configuration");
      }
    },
  },
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "status", "adapterKey"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
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
    createPaymentFunction: text({ defaultValue: "manual", validation: { isRequired: true } }),
    capturePaymentFunction: text({ defaultValue: "manual", validation: { isRequired: true } }),
    refundPaymentFunction: text({ defaultValue: "manual", validation: { isRequired: true } }),
    getPaymentStatusFunction: text({ defaultValue: "manual", validation: { isRequired: true } }),
    handleWebhookFunction: text({ defaultValue: "manual", validation: { isRequired: true } }),
    credentialReference: text({
      access: { read: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "env:// or secret-manager reference; never an inline credential",
      },
    }),
    configuration: json({
      defaultValue: {},
      ui: { description: "Non-secret provider configuration only" },
    }),
    tenders: relationship({ ref: "Tender.paymentProvider", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

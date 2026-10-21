import { denyAll } from "@keystone-6/core/access";
import { list } from "@keystone-6/core";
import { json, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { assertNoInlineSecrets, assertOpaqueSecretReference } from "../lib/secretPolicy";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const MoneyServiceProvider = list({
  access: tenantAccess("canReadMoneyServices", "canManageMoneyServices", { create: false, update: false, delete: false }),
  hooks: {
    validateInput(args) {
      requiredRelationshipHooks("business").validateInput(args);
      try {
        if (args.resolvedData?.configuration !== undefined) assertNoInlineSecrets(args.resolvedData.configuration);
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
    listView: { initialColumns: ["name", "serviceType", "status", "executionMode", "adapterKey"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    serviceType: select({
      type: "enum",
      options: [
        { label: "Money Order", value: "money_order" },
        { label: "Money Transfer", value: "money_transfer" },
        { label: "Bill Payment", value: "bill_payment" },
        { label: "Check Cashing", value: "check_cashing" },
        { label: "Stored Value", value: "stored_value" },
        { label: "ATM / Other", value: "atm_other" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Configured", value: "configured" },
        { label: "Active", value: "active" },
        { label: "Suspended", value: "suspended" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "configured",
      validation: { isRequired: true },
    }),
    executionMode: select({
      type: "enum",
      options: [{ label: "Externally Executed", value: "external_only" }],
      defaultValue: "external_only",
      validation: { isRequired: true },
    }),
    adapterKey: text({ validation: { isRequired: true } }),
    externalAgentReference: text(),
    jurisdictionCode: text(),
    credentialReference: text({
      access: { read: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "env:// or secret-manager reference only",
      },
    }),
    configuration: json({ defaultValue: {}, ui: { description: "Non-secret configuration only" } }),
    stores: relationship({ ref: "Store", many: true }),
    transactions: relationship({ ref: "MoneyServiceTransaction.provider", many: true }),
    settlements: relationship({ ref: "MoneyServiceSettlement.provider", many: true }),
    metadata: metadataField("Configuration evidence only; not proof of registration or licensing"),
    ...trackingFields,
  },
});

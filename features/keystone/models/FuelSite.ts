import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { checkbox, json, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import {
  assertNoInlineSecrets,
  assertOpaqueSecretReference,
} from "../lib/secretPolicy";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const FuelSite = list({
  access: tenantAccess("canReadFuel", "canManageFuel", { create: false, update: false, delete: false }),
  hooks: {
    validateInput(args) {
      requiredRelationshipHooks("business", "store").validateInput(args);
      try {
        if (args.resolvedData?.configuration !== undefined) {
          assertNoInlineSecrets(args.resolvedData.configuration);
        }
        if (args.resolvedData?.controllerCredentialReference !== undefined) {
          assertOpaqueSecretReference(args.resolvedData.controllerCredentialReference);
        }
      } catch (error) {
        args.addValidationError(error instanceof Error ? error.message : "Invalid fuel configuration");
      }
    },
  },
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "store", "enabled", "status", "controllerAdapterKey"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    name: text({ validation: { isRequired: true } }),
    siteCode: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    enabled: checkbox({ defaultValue: false }),
    status: select({
      type: "enum",
      options: [
        { label: "Offline", value: "offline" },
        { label: "Online", value: "online" },
        { label: "Maintenance", value: "maintenance" },
        { label: "Disabled", value: "disabled" },
      ],
      defaultValue: "offline",
      validation: { isRequired: true },
    }),
    controllerAdapterKey: text(),
    controllerCredentialReference: text({
      access: { read: denyAll },
      ui: {
        createView: { fieldMode: "hidden" },
        itemView: { fieldMode: "hidden" },
        listView: { fieldMode: "hidden" },
        description: "Opaque environment or secret-manager reference only",
      },
    }),
    configuration: json({ defaultValue: {}, ui: { description: "Non-secret controller configuration" } }),
    grades: relationship({ ref: "FuelGrade.site", many: true }),
    tanks: relationship({ ref: "FuelTank.site", many: true }),
    pumps: relationship({ ref: "FuelPump.site", many: true }),
    prices: relationship({ ref: "FuelPrice.site", many: true }),
    transactions: relationship({ ref: "FuelTransaction.site", many: true }),
    deliveries: relationship({ ref: "FuelDelivery.site", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

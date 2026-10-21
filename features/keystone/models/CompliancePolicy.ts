import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks, validateEffectiveInterval } from "./validation";

export const CompliancePolicy = list({
  access: tenantAccess("canReadCompliance", "canManageCompliance", { create: false, update: false, delete: false }),
  hooks: {
    validateInput(args) {
      requiredRelationshipHooks("business").validateInput(args);
      const resolvedData = args.resolvedData ?? {};
      validateEffectiveInterval({
        startsAt: resolvedData.startsAt ?? args.item?.startsAt,
        endsAt: resolvedData.endsAt ?? args.item?.endsAt,
        addValidationError: args.addValidationError,
      });
    },
  },
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "policyType", "jurisdiction", "minimumAge", "status"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    policyType: select({
      type: "enum",
      options: [
        { label: "Age Restriction", value: "age_restriction" },
        { label: "Quantity Limit", value: "quantity_limit" },
        { label: "Time of Sale", value: "time_of_sale" },
        { label: "License Required", value: "license_required" },
        { label: "Warning / Acknowledgement", value: "warning" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    jurisdiction: text({ validation: { isRequired: true } }),
    minimumAge: integer({ validation: { min: 0, max: 120 } }),
    idCheckThresholdAge: integer({ validation: { min: 0, max: 120 } }),
    managerOverrideAllowed: checkbox({ defaultValue: false }),
    scanRequired: checkbox({ defaultValue: false }),
    startsAt: timestamp(),
    endsAt: timestamp(),
    stores: relationship({ ref: "Store", many: true }),
    products: relationship({ ref: "Product", many: true }),
    categories: relationship({ ref: "ProductCategory", many: true }),
    verifications: relationship({ ref: "AgeVerification.policy", many: true }),
    incidents: relationship({ ref: "ComplianceIncident.policy", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

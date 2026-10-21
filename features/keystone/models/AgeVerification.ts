import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess, permissions } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const AgeVerification = list({
  access: immutableTenantAccess("canReadCompliance"),
  hooks: requiredRelationshipHooks("business", "store", "policy", "verifiedBy"),
  ui: {
    labelField: "verificationNumber",
    listView: { initialColumns: ["verificationNumber", "policy", "outcome", "ageAtVerification", "verifiedBy", "verifiedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    verificationNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    policy: relationship({ ref: "CompliancePolicy.verifications" }),
    cart: relationship({ ref: "Cart" }),
    sale: relationship({ ref: "Sale.ageVerifications" }),
    verifiedBy: relationship({ ref: "Employee" }),
    outcome: select({
      type: "enum",
      options: [
        { label: "Passed", value: "passed" },
        { label: "Failed", value: "failed" },
        { label: "Overridden", value: "overridden" },
        { label: "Declined", value: "declined" },
      ],
      validation: { isRequired: true },
    }),
    method: select({
      type: "enum",
      options: [
        { label: "ID Scan", value: "id_scan" },
        { label: "Visual ID Check", value: "visual_check" },
        { label: "Known Customer", value: "known_customer" },
        { label: "Manager Override", value: "manager_override" },
      ],
      validation: { isRequired: true },
    }),
    ageAtVerification: integer({ validation: { isRequired: true, min: 0, max: 120 } }),
    documentType: text(),
    documentFingerprint: text({
      access: { read: permissions.canManageCompliance },
      ui: { description: "Non-reversible digest only; never store an ID number or scan payload" },
    }),
    overrideReason: text({ ui: { displayMode: "textarea" } }),
    verifiedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    expiresAt: timestamp(),
    incidents: relationship({ ref: "ComplianceIncident.ageVerification", many: true }),
    metadata: metadataField("Minimal, non-document compliance metadata only"),
    ...trackingFields,
  },
});

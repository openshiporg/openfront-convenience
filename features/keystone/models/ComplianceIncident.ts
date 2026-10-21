import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const ComplianceIncident = list({
  access: tenantAccess("canReadCompliance", "canManageCompliance", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store"),
  ui: {
    labelField: "incidentNumber",
    listView: { initialColumns: ["incidentNumber", "incidentType", "severity", "status", "store", "reportedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    incidentNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    incidentType: select({
      type: "enum",
      options: [
        { label: "Failed Verification", value: "failed_verification" },
        { label: "Override", value: "override" },
        { label: "Refused Sale", value: "refused_sale" },
        { label: "Policy Violation", value: "policy_violation" },
        { label: "Regulator Inquiry", value: "regulator_inquiry" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    severity: select({
      type: "enum",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
        { label: "Critical", value: "critical" },
      ],
      defaultValue: "medium",
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "Investigating", value: "investigating" },
        { label: "Resolved", value: "resolved" },
        { label: "Reported", value: "reported" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "open",
      validation: { isRequired: true },
    }),
    policy: relationship({ ref: "CompliancePolicy.incidents" }),
    ageVerification: relationship({ ref: "AgeVerification.incidents" }),
    sale: relationship({ ref: "Sale" }),
    reportedBy: relationship({ ref: "Employee" }),
    resolvedBy: relationship({ ref: "Employee" }),
    description: text({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    resolution: text({ ui: { displayMode: "textarea" } }),
    reportedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    resolvedAt: timestamp(),
    metadata: metadataField("Do not include full ID data or secrets"),
    ...trackingFields,
  },
});

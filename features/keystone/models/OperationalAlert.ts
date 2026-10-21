import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const OperationalAlert = list({
  access: tenantAccess("canReadAlerts", "canManageAlerts", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business"),
  ui: {
    labelField: "title",
    listView: { initialColumns: ["severity", "type", "title", "store", "status", "detectedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    alertNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    fingerprint: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: select({
      type: "enum",
      options: [
        { label: "Cash Variance", value: "cash_variance" },
        { label: "Fuel Variance", value: "fuel_variance" },
        { label: "Low Inventory", value: "low_inventory" },
        { label: "Expiring Lot", value: "expiring_lot" },
        { label: "Lottery Variance", value: "lottery_variance" },
        { label: "Money Service Variance", value: "money_service_variance" },
        { label: "Payment Variance", value: "payment_variance" },
        { label: "Integration Failure", value: "integration_failure" },
        { label: "Offline Conflict", value: "offline_conflict" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    severity: select({
      type: "enum",
      options: [
        { label: "Info", value: "info" },
        { label: "Warning", value: "warning" },
        { label: "Critical", value: "critical" },
      ],
      defaultValue: "warning",
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "Acknowledged", value: "acknowledged" },
        { label: "Resolved", value: "resolved" },
        { label: "Dismissed", value: "dismissed" },
      ],
      defaultValue: "open",
      validation: { isRequired: true },
    }),
    title: text({ validation: { isRequired: true } }),
    message: text({ validation: { isRequired: true }, ui: { displayMode: "textarea" } }),
    resourceType: text({ validation: { isRequired: true } }),
    resourceId: text({ validation: { isRequired: true }, isIndexed: true }),
    observedValue: text(),
    thresholdValue: text(),
    detectedAt: timestamp({ validation: { isRequired: true } }),
    acknowledgedAt: timestamp(),
    acknowledgedBy: relationship({ ref: "Employee" }),
    resolvedAt: timestamp(),
    resolvedBy: relationship({ ref: "Employee" }),
    resolutionNotes: text({ ui: { displayMode: "textarea" } }),
    evaluation: relationship({ ref: "AlertEvaluation.alerts" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

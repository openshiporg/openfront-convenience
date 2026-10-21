import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const PaymentReconciliation = list({
  access: tenantAccess("canReadPayments", "canManagePayments", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "paymentProvider"),
  ui: {
    labelField: "reconciliationNumber",
    listView: { initialColumns: ["reconciliationNumber", "store", "paymentProvider", "status", "varianceCents", "periodEndedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    paymentProvider: relationship({ ref: "PaymentProvider" }),
    reconciliationNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: select({
      type: "enum",
      options: [
        { label: "In Review", value: "in_review" },
        { label: "Approved", value: "approved" },
        { label: "Exported", value: "exported" },
        { label: "Reopened", value: "reopened" },
      ],
      defaultValue: "in_review",
      validation: { isRequired: true },
      isIndexed: true,
    }),
    periodStartedAt: timestamp({ validation: { isRequired: true } }),
    periodEndedAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    currencyCode: currencyCodeField(),
    capturedCents: centsField({ defaultValue: 0 }),
    refundedCents: centsField({ defaultValue: 0 }),
    reportedFeeCents: centsField({ defaultValue: 0 }),
    expectedSettlementCents: centsField({ defaultValue: 0, allowNegative: true }),
    reportedSettlementCents: centsField({ defaultValue: 0, allowNegative: true }),
    varianceCents: centsField({ defaultValue: 0, allowNegative: true }),
    tenderCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    exceptionCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    lines: relationship({ ref: "PaymentReconciliationLine.reconciliation", many: true }),
    approvedBy: relationship({ ref: "Employee" }),
    approvedAt: timestamp(),
    notes: text({ ui: { displayMode: "textarea" } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("Provider-reported settlement evidence; no cardholder data"),
    ...trackingFields,
  },
});

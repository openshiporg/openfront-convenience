import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const Refund = list({
  access: immutableTenantAccess("canReadPayments"),
  hooks: requiredRelationshipHooks("business", "store", "sale", "originalTender"),
  ui: {
    labelField: "refundNumber",
    listView: { initialColumns: ["refundNumber", "sale", "status", "amountCents", "processedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    sale: relationship({ ref: "Sale.refunds" }),
    originalTender: relationship({ ref: "Tender.refunds" }),
    tenderAllocations: relationship({ ref: "RefundTenderAllocation.refund", many: true }),
    refundNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Approved", value: "approved" },
        { label: "Processing", value: "processing" },
        { label: "Completed", value: "completed" },
        { label: "Failed", value: "failed" },
        { label: "Rejected", value: "rejected" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "requested",
      validation: { isRequired: true },
    }),
    reason: select({
      type: "enum",
      options: [
        { label: "Customer Return", value: "customer_return" },
        { label: "Price Correction", value: "price_correction" },
        { label: "Duplicate Charge", value: "duplicate_charge" },
        { label: "Service Recovery", value: "service_recovery" },
        { label: "Fraud", value: "fraud" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    amountCents: centsField(),
    currencyCode: currencyCodeField(),
    providerRefundId: text({ isIndexed: true }),
    providerLookupKey: text({ isIndexed: "unique", db: { isNullable: true } }),
    requestedBy: relationship({ ref: "Employee" }),
    approvedBy: relationship({ ref: "Employee" }),
    processedBy: relationship({ ref: "Employee" }),
    requestedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    processedAt: timestamp(),
    lines: relationship({ ref: "RefundLine.refund", many: true }),
    loyaltyEntries: relationship({ ref: "LoyaltyLedgerEntry.refund", many: true }),
    notes: text({ ui: { displayMode: "textarea" } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

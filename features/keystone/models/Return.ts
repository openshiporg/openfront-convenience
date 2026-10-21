import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const Return = list({
  access: immutableTenantAccess("canReadSales"),
  hooks: requiredRelationshipHooks("business", "store", "sale"),
  ui: {
    labelField: "returnNumber",
    listView: { initialColumns: ["returnNumber", "sale", "status", "reason", "requestedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    sale: relationship({ ref: "Sale.returns" }),
    refund: relationship({ ref: "Refund" }),
    returnNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Approved", value: "approved" },
        { label: "Received", value: "received" },
        { label: "Completed", value: "completed" },
        { label: "Rejected", value: "rejected" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "requested",
      validation: { isRequired: true },
    }),
    reason: select({
      type: "enum",
      options: [
        { label: "Unwanted", value: "unwanted" },
        { label: "Defective", value: "defective" },
        { label: "Expired", value: "expired" },
        { label: "Wrong Item", value: "wrong_item" },
        { label: "Recall", value: "recall" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    requestedBy: relationship({ ref: "Employee" }),
    approvedBy: relationship({ ref: "Employee" }),
    receivedBy: relationship({ ref: "Employee" }),
    requestedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    receivedAt: timestamp(),
    completedAt: timestamp(),
    lines: relationship({ ref: "ReturnLine.return", many: true }),
    notes: text({ ui: { displayMode: "textarea" } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

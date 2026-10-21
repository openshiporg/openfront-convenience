import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const PurchaseOrder = list({
  access: tenantAccess("canReadPurchasing", "canManagePurchasing", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "vendor"),
  ui: {
    labelField: "poNumber",
    listView: { initialColumns: ["poNumber", "vendor", "store", "status", "expectedAt", "totalCents"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    vendor: relationship({ ref: "Vendor.purchaseOrders" }),
    poNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      access: { create: () => false, update: () => false },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Approved", value: "approved" },
        { label: "Partially Received", value: "partially_received" },
        { label: "Received", value: "received" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    currencyCode: currencyCodeField(),
    subtotalCents: centsField({ defaultValue: 0 }),
    taxCents: centsField({ defaultValue: 0 }),
    shippingCents: centsField({ defaultValue: 0 }),
    totalCents: centsField({ defaultValue: 0 }),
    orderedAt: timestamp(),
    expectedAt: timestamp(),
    submittedAt: timestamp(),
    approvedAt: timestamp(),
    cancelledAt: timestamp(),
    createdBy: relationship({ ref: "Employee" }),
    approvedBy: relationship({ ref: "Employee" }),
    lines: relationship({ ref: "PurchaseOrderLine.purchaseOrder", many: true }),
    receivings: relationship({ ref: "Receiving.purchaseOrder", many: true }),
    notes: text({ ui: { displayMode: "textarea" } }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

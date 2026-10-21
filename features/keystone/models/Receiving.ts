import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const Receiving = list({
  access: tenantAccess("canReadPurchasing", "canManagePurchasing", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "purchaseOrder", "vendor"),
  ui: {
    labelField: "receivingNumber",
    listView: { initialColumns: ["receivingNumber", "purchaseOrder", "vendor", "store", "status", "receivedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    purchaseOrder: relationship({ ref: "PurchaseOrder.receivings" }),
    vendor: relationship({ ref: "Vendor" }),
    receivingNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    vendorDocumentNumber: text({ isIndexed: true }),
    status: select({
      type: "enum",
      access: { create: () => false, update: () => false },
      options: [
        { label: "Draft", value: "draft" },
        { label: "Posted", value: "posted" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    receivedAt: timestamp(),
    postedAt: timestamp(),
    receivedBy: relationship({ ref: "Employee" }),
    lines: relationship({ ref: "ReceivingLine.receiving", many: true }),
    discrepancyNotes: text({ ui: { displayMode: "textarea" } }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

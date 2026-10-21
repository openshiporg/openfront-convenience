import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const InventoryTransfer = list({
  access: tenantAccess("canReadInventory", "canManageInventory", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "sourceStore", "destinationStore", "sourceLocation", "destinationLocation", "requestedBy"),
  ui: {
    labelField: "transferNumber",
    listView: { initialColumns: ["transferNumber", "sourceStore", "destinationStore", "status", "shippedAt", "receivedAt"] },
  },
  fields: {
    business: businessField(),
    transferNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Approved", value: "approved" },
        { label: "Shipped", value: "shipped" },
        { label: "Received", value: "received" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
      isIndexed: true,
    }),
    sourceStore: relationship({ ref: "Store" }),
    destinationStore: relationship({ ref: "Store" }),
    sourceLocation: relationship({ ref: "InventoryLocation" }),
    destinationLocation: relationship({ ref: "InventoryLocation" }),
    lines: relationship({ ref: "InventoryTransferLine.transfer", many: true }),
    requestedBy: relationship({ ref: "Employee" }),
    approvedBy: relationship({ ref: "Employee" }),
    shippedBy: relationship({ ref: "Employee" }),
    receivedBy: relationship({ ref: "Employee" }),
    requestedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    approvedAt: timestamp(),
    shippedAt: timestamp(),
    receivedAt: timestamp(),
    cancelledAt: timestamp(),
    notes: text({ ui: { displayMode: "textarea" } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("Controlled inter-store custody lifecycle"),
    ...trackingFields,
  },
});

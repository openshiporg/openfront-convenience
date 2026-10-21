import { list } from "@keystone-6/core";
import { integer, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { vendorHooks } from "./vendorHooks";

export const Vendor = list({
  access: tenantAccess("canReadPurchasing", "canManagePurchasing", { create: false, update: false, delete: false }),
  hooks: vendorHooks,
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "vendorNumber", "status", "contactName", "leadTimeDays"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    vendorNumber: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "On Hold", value: "on_hold" },
        { label: "Archived", value: "archived" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    contactName: text(),
    email: text(),
    phone: text(),
    website: text(),
    paymentTerms: select({
      type: "enum",
      options: [
        { label: "COD", value: "cod" },
        { label: "Net 7", value: "net_7" },
        { label: "Net 15", value: "net_15" },
        { label: "Net 30", value: "net_30" },
        { label: "Net 60", value: "net_60" },
        { label: "Prepaid", value: "prepaid" },
      ],
      defaultValue: "net_30",
      validation: { isRequired: true },
    }),
    leadTimeDays: integer({ defaultValue: 0, validation: { min: 0 } }),
    minimumOrderCents: centsField({ defaultValue: 0 }),
    notes: text({ ui: { displayMode: "textarea" } }),
    items: relationship({ ref: "VendorItem.vendor", many: true }),
    purchaseOrders: relationship({ ref: "PurchaseOrder.vendor", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const FuelDelivery = list({
  access: tenantAccess("canReadFuel", "canManageFuel", {
    create: false,
    update: false,
    delete: false,
  }),
  hooks: requiredRelationshipHooks("business", "store", "site", "tank"),
  ui: {
    labelField: "deliveryNumber",
    listView: { initialColumns: ["deliveryNumber", "tank", "vendor", "status", "netVolumeGallons", "deliveredAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    site: relationship({ ref: "FuelSite.deliveries" }),
    tank: relationship({ ref: "FuelTank.deliveries" }),
    vendor: relationship({ ref: "Vendor" }),
    deliveryNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    billOfLadingNumber: text({ isIndexed: true }),
    status: select({
      type: "enum",
      options: [
        { label: "Scheduled", value: "scheduled" },
        { label: "In Progress", value: "in_progress" },
        { label: "Received", value: "received" },
        { label: "Reconciled", value: "reconciled" },
        { label: "Disputed", value: "disputed" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "scheduled",
      validation: { isRequired: true },
    }),
    grossVolumeGallons: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    netVolumeGallons: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    beforeVolumeGallons: quantityField({ required: false, min: "0.0000" }),
    afterVolumeGallons: quantityField({ required: false, min: "0.0000" }),
    varianceGallons: quantityField({ required: false }),
    unitCostMillsPerGallon: integer({ validation: { min: 0 } }),
    totalCostCents: centsField({ defaultValue: 0 }),
    deliveredAt: timestamp(),
    receivedBy: relationship({ ref: "Employee" }),
    notes: text({ ui: { displayMode: "textarea" } }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

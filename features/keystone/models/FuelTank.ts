import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const FuelTank = list({
  access: tenantAccess("canReadFuel", "canManageFuel", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "site", "grade"),
  ui: {
    labelField: "tankNumber",
    listView: { initialColumns: ["tankNumber", "grade", "capacityGallons", "currentVolumeGallons", "status", "lastReadingAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    site: relationship({ ref: "FuelSite.tanks" }),
    grade: relationship({ ref: "FuelGrade.tanks" }),
    tankNumber: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Low", value: "low" },
        { label: "Delivery", value: "delivery" },
        { label: "Maintenance", value: "maintenance" },
        { label: "Out of Service", value: "out_of_service" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    capacityGallons: quantityField({ min: "0.0001" }),
    currentVolumeGallons: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    waterVolumeGallons: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    ullageGallons: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    lastReadingAt: timestamp(),
    nozzles: relationship({ ref: "FuelNozzle.tank", many: true }),
    deliveries: relationship({ ref: "FuelDelivery.tank", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

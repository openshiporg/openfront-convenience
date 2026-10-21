import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const FuelTankReading = list({
  access: immutableTenantAccess("canReadFuel"),
  hooks: requiredRelationshipHooks("business", "store", "site", "tank", "recordedBy"),
  ui: {
    labelField: "readingNumber",
    listView: { initialColumns: ["readingNumber", "tank", "source", "volumeGallons", "waterVolumeGallons", "measuredAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    site: relationship({ ref: "FuelSite" }),
    tank: relationship({ ref: "FuelTank" }),
    readingNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    source: select({
      type: "enum",
      options: [
        { label: "Manual Stick", value: "manual_stick" },
        { label: "Automatic Tank Gauge", value: "atg" },
        { label: "Controller", value: "controller" },
        { label: "Delivery", value: "delivery" },
        { label: "Import", value: "import" },
      ],
      validation: { isRequired: true },
    }),
    volumeGallons: quantityField({ min: "0.0000" }),
    waterVolumeGallons: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    ullageGallons: quantityField({ min: "0.0000" }),
    temperatureFahrenheit: quantityField({ required: false }),
    externalReference: text({ isIndexed: true }),
    measuredAt: timestamp({ validation: { isRequired: true } }),
    recordedBy: relationship({ ref: "Employee" }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("Non-authoritative gauge/controller metadata; no inline credentials"),
    ...trackingFields,
  },
});

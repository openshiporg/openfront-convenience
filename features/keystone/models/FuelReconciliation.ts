import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const FuelReconciliation = list({
  access: immutableTenantAccess("canReadFuel"),
  hooks: requiredRelationshipHooks("business", "store", "site", "tank", "openingReading", "closingReading"),
  ui: {
    labelField: "reconciliationNumber",
    listView: { initialColumns: ["reconciliationNumber", "tank", "status", "periodStartedAt", "varianceGallons", "approvedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    site: relationship({ ref: "FuelSite" }),
    tank: relationship({ ref: "FuelTank" }),
    reconciliationNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "In Review", value: "in_review" },
        { label: "Approved", value: "approved" },
        { label: "Locked", value: "locked" },
        { label: "Disputed", value: "disputed" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    periodStartedAt: timestamp({ validation: { isRequired: true } }),
    periodEndedAt: timestamp({ validation: { isRequired: true } }),
    openingReading: relationship({ ref: "FuelTankReading" }),
    closingReading: relationship({ ref: "FuelTankReading" }),
    openingGallons: quantityField({ min: "0.0000" }),
    deliveredGallons: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    dispensedGallons: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    expectedClosingGallons: quantityField({ min: "0.0000" }),
    measuredClosingGallons: quantityField({ min: "0.0000" }),
    varianceGallons: quantityField(),
    toleranceGallons: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    generatedAt: timestamp({ validation: { isRequired: true } }),
    generatedBy: relationship({ ref: "Employee" }),
    approvedAt: timestamp(),
    approvedBy: relationship({ ref: "Employee" }),
    notes: text({ ui: { displayMode: "textarea" } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("Source counts and calculation version"),
    ...trackingFields,
  },
});

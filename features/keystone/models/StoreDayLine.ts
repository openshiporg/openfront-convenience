import { list } from "@keystone-6/core";
import { integer, relationship, select, text } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const StoreDayLine = list({
  access: immutableTenantAccess("canReadReporting"),
  hooks: requiredRelationshipHooks("business", "store", "storeDay"),
  ui: {
    labelField: "label",
    listView: { initialColumns: ["storeDay", "dimension", "label", "expectedCents", "actualCents", "varianceCents"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    storeDay: relationship({ ref: "StoreDay.lines" }),
    lineNumber: integer({ validation: { isRequired: true, min: 1 } }),
    dimension: select({
      type: "enum",
      options: [
        { label: "Register", value: "register" },
        { label: "Tender", value: "tender" },
        { label: "Tax", value: "tax" },
        { label: "Merchandise", value: "merchandise" },
        { label: "Fuel", value: "fuel" },
        { label: "Lottery", value: "lottery" },
        { label: "Money Service", value: "money_service" },
        { label: "Deposit", value: "deposit" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    dimensionKey: text({ validation: { isRequired: true } }),
    label: text({ validation: { isRequired: true } }),
    grossCents: centsField({ defaultValue: 0, allowNegative: true }),
    discountCents: centsField({ defaultValue: 0, allowNegative: true }),
    taxCents: centsField({ defaultValue: 0, allowNegative: true }),
    netCents: centsField({ defaultValue: 0, allowNegative: true }),
    expectedCents: centsField({ defaultValue: 0, allowNegative: true }),
    actualCents: centsField({ defaultValue: 0, allowNegative: true }),
    varianceCents: centsField({ defaultValue: 0, allowNegative: true }),
    quantity: quantityField({ defaultValue: "0.0000" }),
    sourceCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

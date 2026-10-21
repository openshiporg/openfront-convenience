import { list } from "@keystone-6/core";
import { relationship, select, text } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const RefundLine = list({
  access: immutableTenantAccess("canReadPayments"),
  hooks: requiredRelationshipHooks("business", "store", "refund", "saleLine"),
  ui: {
    labelField: "id",
    listView: { initialColumns: ["refund", "saleLine", "quantity", "totalCents", "reason"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    refund: relationship({ ref: "Refund.lines" }),
    saleLine: relationship({ ref: "SaleLine.refundLines" }),
    quantity: quantityField({ min: "0.0001" }),
    subtotalCents: centsField(),
    taxCents: centsField({ defaultValue: 0 }),
    totalCents: centsField(),
    reason: select({
      type: "enum",
      options: [
        { label: "Returned", value: "returned" },
        { label: "Damaged", value: "damaged" },
        { label: "Price Correction", value: "price_correction" },
        { label: "Not Received", value: "not_received" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    note: text({ ui: { displayMode: "textarea" } }),
    returnLine: relationship({ ref: "ReturnLine.refundLine" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

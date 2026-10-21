import { list } from "@keystone-6/core";
import { integer, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const VendorItem = list({
  access: tenantAccess("canReadPurchasing", "canManagePurchasing", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "vendor", "variant"),
  ui: {
    labelField: "vendorSku",
    listView: { initialColumns: ["vendorSku", "vendor", "variant", "casePackQuantity", "unitCostCents", "status"] },
  },
  fields: {
    business: businessField(),
    vendor: relationship({ ref: "Vendor.items" }),
    variant: relationship({ ref: "ProductVariant.vendorItems" }),
    vendorSku: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Unavailable", value: "unavailable" },
        { label: "Discontinued", value: "discontinued" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    casePackQuantity: quantityField({ defaultValue: "1.0000", min: "0.0001" }),
    unitsPerCase: integer({ defaultValue: 1, validation: { min: 1 } }),
    unitCostCents: centsField({ defaultValue: 0 }),
    leadTimeDays: integer({ defaultValue: 0, validation: { min: 0 } }),
    purchaseOrderLines: relationship({ ref: "PurchaseOrderLine.vendorItem", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

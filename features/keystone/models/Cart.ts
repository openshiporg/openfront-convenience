import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const Cart = list({
  access: tenantAccess("canReadSales", "canManageSales", {
    create: false,
    update: false,
    delete: false,
  }),
  hooks: requiredRelationshipHooks("business", "store"),
  ui: {
    labelField: "cartNumber",
    listView: { initialColumns: ["cartNumber", "store", "source", "status", "totalCents", "updatedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    cartNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    source: select({
      type: "enum",
      options: [
        { label: "POS", value: "pos" },
        { label: "Kiosk", value: "kiosk" },
        { label: "Storefront", value: "storefront" },
        { label: "Mobile", value: "mobile" },
        { label: "API", value: "api" },
      ],
      defaultValue: "pos",
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      access: { create: () => false, update: () => false },
      options: [
        { label: "Open", value: "open" },
        { label: "Held", value: "held" },
        { label: "Converted", value: "converted" },
        { label: "Abandoned", value: "abandoned" },
        { label: "Voided", value: "voided" },
      ],
      defaultValue: "open",
      validation: { isRequired: true },
    }),
    currencyCode: currencyCodeField(),
    subtotalCents: centsField({ defaultValue: 0 }),
    discountCents: centsField({ defaultValue: 0 }),
    taxCents: centsField({ defaultValue: 0 }),
    totalCents: centsField({ defaultValue: 0 }),
    loyaltyPointsToRedeem: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    loyaltyRedemptionCents: centsField({ defaultValue: 0 }),
    registerSession: relationship({ ref: "RegisterSession" }),
    cashier: relationship({ ref: "Employee" }),
    customer: relationship({ ref: "User.carts" }),
    loyaltyAccount: relationship({ ref: "LoyaltyAccount" }),
    priceBook: relationship({ ref: "PriceBook" }),
    guestTokenDigest: text({
      access: { read: () => false },
      isIndexed: true,
      ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } },
    }),
    expiresAt: timestamp(),
    lines: relationship({ ref: "CartLine.cart", many: true }),
    promotions: relationship({ ref: "Promotion", many: true }),
    sale: relationship({ ref: "Sale.cart" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

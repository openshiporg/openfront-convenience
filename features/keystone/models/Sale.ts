import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const Sale = list({
  access: immutableTenantAccess("canReadSales"),
  hooks: requiredRelationshipHooks("business", "store"),
  ui: {
    labelField: "receiptNumber",
    listView: { initialColumns: ["receiptNumber", "store", "status", "totalCents", "cashier", "completedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    receiptNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    source: select({
      type: "enum",
      options: [
        { label: "POS", value: "pos" },
        { label: "Kiosk", value: "kiosk" },
        { label: "Storefront", value: "storefront" },
        { label: "Mobile", value: "mobile" },
        { label: "API", value: "api" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Open", value: "open" },
        { label: "Completed", value: "completed" },
        { label: "Partially Refunded", value: "partially_refunded" },
        { label: "Refunded", value: "refunded" },
        { label: "Voided", value: "voided" },
      ],
      defaultValue: "open",
      validation: { isRequired: true },
    }),
    currencyCode: currencyCodeField(),
    subtotalCents: centsField(),
    discountCents: centsField({ defaultValue: 0 }),
    taxCents: centsField({ defaultValue: 0 }),
    roundingCents: centsField({ defaultValue: 0, allowNegative: true }),
    totalCents: centsField(),
    refundedCents: centsField({ defaultValue: 0 }),
    cart: relationship({ ref: "Cart.sale" }),
    registerSession: relationship({ ref: "RegisterSession.sales" }),
    cashier: relationship({ ref: "Employee" }),
    customer: relationship({ ref: "User.sales" }),
    loyaltyAccount: relationship({ ref: "LoyaltyAccount" }),
    lines: relationship({ ref: "SaleLine.sale", many: true }),
    tenders: relationship({ ref: "Tender.sale", many: true }),
    refunds: relationship({ ref: "Refund.sale", many: true }),
    returns: relationship({ ref: "Return.sale", many: true }),
    promotionRedemptions: relationship({ ref: "PromotionRedemption.sale", many: true }),
    loyaltyEntries: relationship({ ref: "LoyaltyLedgerEntry.sale", many: true }),
    ageVerifications: relationship({ ref: "AgeVerification.sale", many: true }),
    startedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    completedAt: timestamp(),
    voidedAt: timestamp(),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

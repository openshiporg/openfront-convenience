import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const StoreDay = list({
  access: immutableTenantAccess("canReadReporting"),
  hooks: requiredRelationshipHooks("business", "store"),
  ui: {
    labelField: "lookupKey",
    listView: {
      initialColumns: ["tradingDate", "store", "status", "totalSalesCents", "cashOverShortCents", "approvedAt"],
    },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    tradingDate: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "In Review", value: "in_review" },
        { label: "Reconciled", value: "reconciled" },
        { label: "Locked", value: "locked" },
        { label: "Reopened", value: "reopened" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    timezoneSnapshot: text({ validation: { isRequired: true } }),
    currencyCode: currencyCodeField(),
    periodStartedAt: timestamp({ validation: { isRequired: true } }),
    periodEndedAt: timestamp({ validation: { isRequired: true } }),
    generatedAt: timestamp({ validation: { isRequired: true } }),
    approvedAt: timestamp(),
    lockedAt: timestamp(),
    approvedBy: relationship({ ref: "Employee" }),
    grossSalesCents: centsField({ defaultValue: 0 }),
    discountCents: centsField({ defaultValue: 0 }),
    taxCents: centsField({ defaultValue: 0, allowNegative: true }),
    totalSalesCents: centsField({ defaultValue: 0 }),
    refundCents: centsField({ defaultValue: 0 }),
    netReceiptsCents: centsField({ defaultValue: 0, allowNegative: true }),
    cashTenderCents: centsField({ defaultValue: 0, allowNegative: true }),
    nonCashTenderCents: centsField({ defaultValue: 0, allowNegative: true }),
    fuelSalesCents: centsField({ defaultValue: 0 }),
    lotteryNetCents: centsField({ defaultValue: 0, allowNegative: true }),
    moneyServiceNetCents: centsField({ defaultValue: 0, allowNegative: true }),
    openingCashCents: centsField({ defaultValue: 0 }),
    expectedCashCents: centsField({ defaultValue: 0 }),
    countedCashCents: centsField({ defaultValue: 0 }),
    cashOverShortCents: centsField({ defaultValue: 0, allowNegative: true }),
    depositedCashCents: centsField({ defaultValue: 0 }),
    undepositedCashCents: centsField({ defaultValue: 0, allowNegative: true }),
    saleCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    refundCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    registerSessionCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    exceptionCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    lines: relationship({ ref: "StoreDayLine.storeDay", many: true }),
    deposits: relationship({ ref: "BankDeposit.storeDay", many: true }),
    notes: text({ ui: { displayMode: "textarea" } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("Source counts and non-authoritative generation context"),
    ...trackingFields,
  },
});

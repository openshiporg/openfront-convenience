import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const MoneyServiceSettlement = list({
  access: tenantAccess("canReadMoneyServices", "canManageMoneyServices", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "provider"),
  ui: {
    labelField: "settlementNumber",
    listView: { initialColumns: ["settlementNumber", "provider", "tradingDate", "status", "expectedSettlementCents", "varianceCents"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    provider: relationship({ ref: "MoneyServiceProvider.settlements" }),
    settlementNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    tradingDate: text({ validation: { isRequired: true }, isIndexed: true }),
    periodStartedAt: timestamp({ validation: { isRequired: true } }),
    periodEndedAt: timestamp({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "In Review", value: "in_review" },
        { label: "Approved", value: "approved" },
        { label: "Exported", value: "exported" },
        { label: "Disputed", value: "disputed" },
      ],
      validation: { isRequired: true },
    }),
    currencyCode: currencyCodeField(),
    faceAmountCents: centsField({ defaultValue: 0 }),
    feeCents: centsField({ defaultValue: 0 }),
    cashInCents: centsField({ defaultValue: 0 }),
    cashOutCents: centsField({ defaultValue: 0 }),
    expectedSettlementCents: centsField({ defaultValue: 0, allowNegative: true }),
    reportedSettlementCents: centsField({ defaultValue: 0, allowNegative: true }),
    varianceCents: centsField({ defaultValue: 0, allowNegative: true }),
    transactionCount: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    generatedAt: timestamp({ validation: { isRequired: true } }),
    approvedAt: timestamp(),
    approvedBy: relationship({ ref: "Employee" }),
    notes: text({ ui: { displayMode: "textarea" } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("Operational provider settlement only; not a regulatory filing"),
    ...trackingFields,
  },
});

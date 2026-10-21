import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const MoneyServiceTransaction = list({
  access: immutableTenantAccess("canReadMoneyServices"),
  hooks: requiredRelationshipHooks("business", "store", "provider", "employee"),
  ui: {
    labelField: "transactionNumber",
    listView: { initialColumns: ["transactionNumber", "provider", "serviceType", "status", "faceAmountCents", "occurredAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    provider: relationship({ ref: "MoneyServiceProvider.transactions" }),
    transactionNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    externalTransactionReference: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    serviceType: select({
      type: "enum",
      options: [
        { label: "Money Order", value: "money_order" },
        { label: "Money Transfer", value: "money_transfer" },
        { label: "Bill Payment", value: "bill_payment" },
        { label: "Check Cashing", value: "check_cashing" },
        { label: "Stored Value", value: "stored_value" },
        { label: "ATM / Other", value: "atm_other" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Confirmed Externally", value: "confirmed" },
        { label: "Voided Externally", value: "voided" },
        { label: "Refunded Externally", value: "refunded" },
        { label: "Reconciled", value: "reconciled" },
      ],
      validation: { isRequired: true },
    }),
    cashDirection: select({
      type: "enum",
      options: [
        { label: "Cash In", value: "in" },
        { label: "Cash Out", value: "out" },
        { label: "No Cash", value: "none" },
      ],
      validation: { isRequired: true },
    }),
    faceAmountCents: centsField(),
    feeCents: centsField({ defaultValue: 0 }),
    cashAmountCents: centsField({ defaultValue: 0 }),
    providerSettlementCents: centsField({ defaultValue: 0, allowNegative: true }),
    currencyCode: currencyCodeField(),
    registerSession: relationship({ ref: "RegisterSession" }),
    employee: relationship({ ref: "Employee" }),
    externalVoidReference: text(),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    voidedAt: timestamp(),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("No customer identity or source-of-funds payloads"),
    ...trackingFields,
  },
});

import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const BankDeposit = list({
  access: tenantAccess("canReadCash", "canManageCash", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "storeDay", "preparedBy"),
  ui: {
    labelField: "depositNumber",
    listView: { initialColumns: ["depositNumber", "storeDay", "status", "amountCents", "varianceCents", "preparedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    storeDay: relationship({ ref: "StoreDay.deposits" }),
    depositNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: select({
      type: "enum",
      options: [
        { label: "Prepared", value: "prepared" },
        { label: "In Transit", value: "in_transit" },
        { label: "Deposited", value: "deposited" },
        { label: "Verified", value: "verified" },
        { label: "Voided", value: "voided" },
      ],
      defaultValue: "prepared",
      validation: { isRequired: true },
    }),
    currencyCode: currencyCodeField(),
    expectedAmountCents: centsField(),
    amountCents: centsField(),
    varianceCents: centsField({ defaultValue: 0, allowNegative: true }),
    bagReference: text({ isIndexed: true }),
    bankReference: text({ isIndexed: true }),
    preparedBy: relationship({ ref: "Employee" }),
    verifiedBy: relationship({ ref: "Employee" }),
    preparedAt: timestamp({ validation: { isRequired: true } }),
    depositedAt: timestamp(),
    verifiedAt: timestamp(),
    notes: text({ ui: { displayMode: "textarea" } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

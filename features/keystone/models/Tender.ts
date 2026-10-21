import { list } from "@keystone-6/core";
import { json, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { assertNoInlineSecrets } from "../lib/secretPolicy";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const Tender = list({
  access: immutableTenantAccess("canReadPayments"),
  hooks: {
    validateInput(args) {
      requiredRelationshipHooks("business", "store", "sale").validateInput(args);
      if (args.resolvedData?.providerData !== undefined) {
        try {
          assertNoInlineSecrets(args.resolvedData.providerData);
        } catch (error) {
          args.addValidationError(error instanceof Error ? error.message : "Invalid provider data");
        }
      }
    },
  },
  ui: {
    labelField: "providerPaymentId",
    listView: { initialColumns: ["sale", "method", "status", "amountCents", "processedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    sale: relationship({ ref: "Sale.tenders" }),
    paymentProvider: relationship({ ref: "PaymentProvider.tenders" }),
    method: select({
      type: "enum",
      options: [
        { label: "Cash", value: "cash" },
        { label: "Credit Card", value: "credit_card" },
        { label: "Debit Card", value: "debit_card" },
        { label: "Mobile Wallet", value: "mobile_wallet" },
        { label: "Gift Card", value: "gift_card" },
        { label: "EBT / SNAP", value: "ebt_snap" },
        { label: "Fleet Card", value: "fleet_card" },
        { label: "House Account", value: "house_account" },
        { label: "Loyalty Points", value: "loyalty" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Authorized", value: "authorized" },
        { label: "Captured", value: "captured" },
        { label: "Partially Refunded", value: "partially_refunded" },
        { label: "Refunded", value: "refunded" },
        { label: "Failed", value: "failed" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
    }),
    amountCents: centsField(),
    tenderedCents: centsField({ required: false }),
    changeCents: centsField({ defaultValue: 0 }),
    refundedCents: centsField({ defaultValue: 0 }),
    currencyCode: currencyCodeField(),
    providerPaymentId: text({ isIndexed: true }),
    providerLookupKey: text({ isIndexed: "unique", db: { isNullable: true } }),
    providerReference: text(),
    cardBrand: text(),
    cardLast4: text({
      validation: {
        match: { regex: /^\d{4}$/, explanation: "Card last four must be exactly four digits" },
      },
    }),
    failureCode: text(),
    failureMessage: text(),
    providerData: json({ defaultValue: {}, ui: { description: "Normalized non-secret provider response" } }),
    processedAt: timestamp(),
    processedBy: relationship({ ref: "Employee" }),
    cashMovement: relationship({ ref: "CashMovement.tender" }),
    refunds: relationship({ ref: "Refund.originalTender", many: true }),
    refundAllocations: relationship({ ref: "RefundTenderAllocation.tender", many: true }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

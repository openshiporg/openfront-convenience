import { list } from "@keystone-6/core";
import { relationship, select, text } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, currencyCodeField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const RefundTenderAllocation = list({
  access: immutableTenantAccess("canReadPayments"),
  hooks: requiredRelationshipHooks("business", "store", "refund", "tender"),
  ui: {
    labelField: "providerRefundId",
    listView: { initialColumns: ["refund", "tender", "method", "amountCents", "status"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    refund: relationship({ ref: "Refund.tenderAllocations" }),
    tender: relationship({ ref: "Tender.refundAllocations" }),
    method: select({
      type: "enum",
      options: [
        { label: "Cash", value: "cash" },
        { label: "Credit Card", value: "credit_card" },
        { label: "Debit Card", value: "debit_card" },
        { label: "EBT SNAP", value: "ebt_snap" },
        { label: "EBT Cash", value: "ebt_cash" },
        { label: "Gift Card", value: "gift_card" },
        { label: "House Account", value: "house_account" },
        { label: "Mobile Wallet", value: "mobile_wallet" },
        { label: "Fleet Card", value: "fleet_card" },
        { label: "Loyalty Points", value: "loyalty" },
        { label: "Other", value: "other" },
      ],
      validation: { isRequired: true },
    }),
    amountCents: centsField(),
    currencyCode: currencyCodeField(),
    status: select({
      type: "enum",
      options: [
        { label: "Completed", value: "completed" },
        { label: "Voided", value: "voided" },
      ],
      defaultValue: "completed",
      validation: { isRequired: true },
    }),
    providerRefundId: text(),
    providerLookupKey: text({ isIndexed: "unique", db: { isNullable: true } }),
    metadata: metadataField("Immutable provider-authority evidence without raw credentials"),
    ...trackingFields,
  },
});

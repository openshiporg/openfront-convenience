import { list } from "@keystone-6/core";
import { relationship, text } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const PaymentReconciliationLine = list({
  access: immutableTenantAccess("canReadPayments"),
  hooks: requiredRelationshipHooks("business", "store", "reconciliation", "tender"),
  ui: {
    labelField: "lineKey",
    listView: { initialColumns: ["reconciliation", "tender", "capturedCents", "refundedCents", "expectedSettlementCents"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    reconciliation: relationship({ ref: "PaymentReconciliation.lines" }),
    tender: relationship({ ref: "Tender" }),
    lineKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    capturedCents: centsField({ defaultValue: 0 }),
    refundedCents: centsField({ defaultValue: 0 }),
    reportedFeeCents: centsField({ defaultValue: 0 }),
    expectedSettlementCents: centsField({ defaultValue: 0, allowNegative: true }),
    metadata: metadataField("Tender-level settlement evidence"),
    ...trackingFields,
  },
});

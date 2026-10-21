import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const CashMovement = list({
  access: immutableTenantAccess("canReadCash"),
  hooks: requiredRelationshipHooks("business", "store", "registerSession", "employee"),
  ui: {
    labelField: "reason",
    listView: { initialColumns: ["registerSession", "type", "direction", "amountCents", "occurredAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    registerSession: relationship({ ref: "RegisterSession.cashMovements" }),
    employee: relationship({ ref: "Employee" }),
    type: select({
      type: "enum",
      options: [
        { label: "Opening Float", value: "opening_float" },
        { label: "Sale Payment", value: "sale_payment" },
        { label: "Refund", value: "refund" },
        { label: "Paid In", value: "paid_in" },
        { label: "Paid Out", value: "paid_out" },
        { label: "Safe Drop", value: "safe_drop" },
        { label: "Lottery Sale", value: "lottery_sale" },
        { label: "Lottery Payout", value: "lottery_payout" },
        { label: "Money Service In", value: "money_service_in" },
        { label: "Money Service Out", value: "money_service_out" },
        { label: "Closing Count", value: "closing_count" },
        { label: "Correction", value: "correction" },
      ],
      validation: { isRequired: true },
    }),
    direction: select({
      type: "enum",
      options: [
        { label: "In", value: "in" },
        { label: "Out", value: "out" },
      ],
      validation: { isRequired: true },
    }),
    amountCents: centsField(),
    reason: text({ validation: { isRequired: true } }),
    sale: relationship({ ref: "Sale" }),
    tender: relationship({ ref: "Tender.cashMovement" }),
    refund: relationship({ ref: "Refund" }),
    occurredAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

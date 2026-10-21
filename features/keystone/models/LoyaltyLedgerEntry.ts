import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const LoyaltyLedgerEntry = list({
  access: immutableTenantAccess("canReadLoyalty"),
  hooks: requiredRelationshipHooks("business", "account"),
  ui: {
    labelField: "description",
    listView: { initialColumns: ["account", "type", "pointsDelta", "balanceAfter", "sale", "occurredAt"] },
  },
  fields: {
    business: businessField(),
    store: relationship({ ref: "Store" }),
    account: relationship({ ref: "LoyaltyAccount.entries" }),
    type: select({
      type: "enum",
      options: [
        { label: "Earned", value: "earned" },
        { label: "Redeemed", value: "redeemed" },
        { label: "Refund Reversal", value: "refund_reversal" },
        { label: "Expired", value: "expired" },
        { label: "Manual Adjustment", value: "manual_adjustment" },
        { label: "Bonus", value: "bonus" },
      ],
      validation: { isRequired: true },
    }),
    pointsDelta: integer({ validation: { isRequired: true } }),
    balanceAfter: integer({ validation: { isRequired: true } }),
    description: text({ validation: { isRequired: true } }),
    sale: relationship({ ref: "Sale.loyaltyEntries" }),
    refund: relationship({ ref: "Refund.loyaltyEntries" }),
    actor: relationship({ ref: "Employee" }),
    expiresAt: timestamp(),
    occurredAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

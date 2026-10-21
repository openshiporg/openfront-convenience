import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const LotteryPackEvent = list({
  access: immutableTenantAccess("canReadLottery"),
  hooks: requiredRelationshipHooks("business", "store", "pack", "employee"),
  ui: {
    labelField: "eventNumber",
    listView: { initialColumns: ["eventNumber", "pack", "type", "quantity", "amountCents", "occurredAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    pack: relationship({ ref: "LotteryPack.events" }),
    eventNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    type: select({
      type: "enum",
      options: [
        { label: "Received", value: "received" },
        { label: "Activated", value: "activated" },
        { label: "Sale Range", value: "sale_range" },
        { label: "Void Range", value: "void_range" },
        { label: "Returned", value: "returned" },
        { label: "Closed", value: "closed" },
        { label: "Settled", value: "settled" },
        { label: "Adjustment", value: "adjustment" },
      ],
      validation: { isRequired: true },
    }),
    firstTicketNumber: integer({ validation: { min: 0 } }),
    lastTicketNumber: integer({ validation: { min: 0 } }),
    quantity: integer({ validation: { isRequired: true, min: 0 } }),
    amountCents: centsField({ defaultValue: 0, allowNegative: true }),
    registerSession: relationship({ ref: "RegisterSession" }),
    employee: relationship({ ref: "Employee" }),
    reason: text(),
    occurredAt: timestamp({ validation: { isRequired: true } }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

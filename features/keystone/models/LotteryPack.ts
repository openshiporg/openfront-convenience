import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const LotteryPack = list({
  access: tenantAccess("canReadLottery", "canManageLottery", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "game"),
  ui: {
    labelField: "packNumber",
    listView: { initialColumns: ["packNumber", "game", "store", "status", "currentTicketNumber", "varianceCents"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    game: relationship({ ref: "LotteryGame.packs" }),
    packNumber: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    status: select({
      type: "enum",
      options: [
        { label: "Received", value: "received" },
        { label: "Activated", value: "activated" },
        { label: "In Sale", value: "in_sale" },
        { label: "Closed", value: "closed" },
        { label: "Returned", value: "returned" },
        { label: "Settled", value: "settled" },
      ],
      validation: { isRequired: true },
    }),
    firstTicketNumber: integer({ validation: { isRequired: true, min: 0 } }),
    lastTicketNumber: integer({ validation: { isRequired: true, min: 0 } }),
    currentTicketNumber: integer({ validation: { isRequired: true, min: 0 } }),
    ticketsReceived: integer({ validation: { isRequired: true, min: 1 } }),
    ticketsSold: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    ticketsVoided: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    expectedSalesCents: centsField({ defaultValue: 0 }),
    actualSalesCents: centsField({ defaultValue: 0 }),
    varianceCents: centsField({ defaultValue: 0, allowNegative: true }),
    receivedAt: timestamp({ validation: { isRequired: true } }),
    receivedBy: relationship({ ref: "Employee" }),
    activatedAt: timestamp(),
    activatedBy: relationship({ ref: "Employee" }),
    closedAt: timestamp(),
    closedBy: relationship({ ref: "Employee" }),
    settlement: relationship({ ref: "LotterySettlement.packs" }),
    events: relationship({ ref: "LotteryPackEvent.pack", many: true }),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

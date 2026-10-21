import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const LotteryGame = list({
  access: tenantAccess("canReadLottery", "canManageLottery", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "gameCode", "jurisdictionCode", "ticketPriceCents", "status"] },
  },
  fields: {
    business: businessField(),
    name: text({ validation: { isRequired: true } }),
    gameCode: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    jurisdictionCode: text({ validation: { isRequired: true } }),
    operatorName: text({ validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Configured", value: "configured" },
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "configured",
      validation: { isRequired: true },
    }),
    ticketPriceCents: centsField(),
    ticketsPerPack: integer({ validation: { isRequired: true, min: 1 } }),
    salesStartAt: timestamp(),
    salesEndAt: timestamp(),
    packs: relationship({ ref: "LotteryPack.game", many: true }),
    metadata: metadataField("Operator game metadata only; no claim of jurisdiction approval"),
    ...trackingFields,
  },
});

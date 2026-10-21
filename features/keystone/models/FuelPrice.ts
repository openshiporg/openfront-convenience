import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks, validateEffectiveInterval } from "./validation";

export const FuelPrice = list({
  access: tenantAccess("canReadFuel", "canManageFuel", { create: false, update: false, delete: false }),
  hooks: {
    validateInput(args) {
      requiredRelationshipHooks("business", "store", "site", "grade").validateInput(args);
      const resolvedData = args.resolvedData ?? {};
      validateEffectiveInterval({
        startsAt: resolvedData.startsAt ?? args.item?.startsAt,
        endsAt: resolvedData.endsAt ?? args.item?.endsAt,
        addValidationError: args.addValidationError,
      });
    },
  },
  ui: {
    labelField: "lookupKey",
    listView: { initialColumns: ["grade", "priceTier", "priceMillsPerGallon", "status", "startsAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    site: relationship({ ref: "FuelSite.prices" }),
    grade: relationship({ ref: "FuelGrade.prices" }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    priceTier: select({
      type: "enum",
      options: [
        { label: "Cash", value: "cash" },
        { label: "Credit", value: "credit" },
        { label: "Fleet", value: "fleet" },
        { label: "Loyalty", value: "loyalty" },
      ],
      defaultValue: "credit",
      validation: { isRequired: true },
    }),
    priceMillsPerGallon: integer({
      validation: { isRequired: true, min: 0 },
      ui: { description: "Thousandths of a dollar per gallon (e.g. 3499 = $3.499)" },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Scheduled", value: "scheduled" },
        { label: "Active", value: "active" },
        { label: "Expired", value: "expired" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "scheduled",
      validation: { isRequired: true },
    }),
    startsAt: timestamp({ validation: { isRequired: true } }),
    endsAt: timestamp(),
    authorizedBy: relationship({ ref: "Employee" }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

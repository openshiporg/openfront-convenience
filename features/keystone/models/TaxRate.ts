import { list } from "@keystone-6/core";
import { checkbox, float, integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks, validateEffectiveInterval } from "./validation";

export const TaxRate = list({
  access: tenantAccess("canReadPricing", "canManagePricing", { create: false, update: false, delete: false }),
  hooks: {
    validateInput(args) {
      requiredRelationshipHooks("business", "store", "taxCategory").validateInput(args);
      const resolvedData = args.resolvedData ?? {};
      validateEffectiveInterval({
        startsAt: resolvedData.startsAt ?? args.item?.startsAt,
        endsAt: resolvedData.endsAt ?? args.item?.endsAt,
        addValidationError: args.addValidationError,
      });
    },
  },
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "store", "taxCategory", "rate", "status"] },
  },
  fields: {
    business: businessField(),
    store: relationship({ ref: "Store.taxRates" }),
    taxCategory: relationship({ ref: "TaxCategory.rates" }),
    name: text({ validation: { isRequired: true } }),
    jurisdiction: text(),
    // A fraction, as in E-commerce (0.08875 = 8.875%). Money math converts it to
    // exact parts per million (lib/money.ts), so tax stays exact to the cent.
    rate: float({
      validation: { isRequired: true, min: 0, max: 1 },
      ui: { description: "Fraction: 0.08875 is 8.875%" },
    }),
    inclusive: checkbox({ defaultValue: false }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Expired", value: "expired" },
      ],
      defaultValue: "draft",
      validation: { isRequired: true },
    }),
    startsAt: timestamp(),
    endsAt: timestamp(),
    metadata: metadataField(),
    ...trackingFields,
  },
});

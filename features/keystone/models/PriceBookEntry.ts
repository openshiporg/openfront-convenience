import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks, validateEffectiveInterval } from "./validation";

export const PriceBookEntry = list({
  access: tenantAccess("canReadPricing", "canManagePricing", { create: false, update: false, delete: false }),
  hooks: {
    validateInput(args) {
      requiredRelationshipHooks("business", "priceBook", "variant").validateInput(args);
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
    listView: { initialColumns: ["variant", "priceBook", "amountCents", "status", "startsAt"] },
  },
  fields: {
    business: businessField(),
    priceBook: relationship({ ref: "PriceBook.entries" }),
    variant: relationship({ ref: "ProductVariant.priceEntries" }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    amountCents: centsField(),
    minQuantity: quantityField({ defaultValue: "1.0000", min: "0.0001" }),
    maxQuantity: quantityField({ required: false, min: "0.0001" }),
    status: select({
      type: "enum",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
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

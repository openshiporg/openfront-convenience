import { list } from "@keystone-6/core";
import { relationship, text, timestamp } from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import { businessField, centsField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const PromotionRedemption = list({
  access: immutableTenantAccess("canReadPromotions"),
  hooks: requiredRelationshipHooks("business", "store", "promotion", "sale"),
  ui: {
    labelField: "codeSnapshot",
    listView: { initialColumns: ["promotion", "sale", "amountCents", "loyaltyAccount", "redeemedAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    promotion: relationship({ ref: "Promotion.redemptions" }),
    sale: relationship({ ref: "Sale.promotionRedemptions" }),
    loyaltyAccount: relationship({ ref: "LoyaltyAccount" }),
    codeSnapshot: text(),
    amountCents: centsField(),
    redeemedAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

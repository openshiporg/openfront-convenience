import { list } from "@keystone-6/core";
import { integer, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, centsField, metadataField, quantityField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const PromotionRule = list({
  access: tenantAccess("canReadPromotions", "canManagePromotions", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "promotion"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "promotion", "ruleType", "benefitMethod", "priority"] },
  },
  fields: {
    business: businessField(),
    promotion: relationship({ ref: "Promotion.rules" }),
    name: text({ validation: { isRequired: true } }),
    priority: integer({ defaultValue: 0 }),
    ruleType: select({
      type: "enum",
      options: [
        { label: "Item Discount", value: "item_discount" },
        { label: "Basket Discount", value: "basket_discount" },
        { label: "Quantity Break", value: "quantity_break" },
        { label: "Buy X Get Y", value: "buy_x_get_y" },
        { label: "Mix and Match", value: "mix_and_match" },
      ],
      validation: { isRequired: true },
    }),
    benefitMethod: select({
      type: "enum",
      options: [
        { label: "Percentage", value: "percentage" },
        { label: "Fixed Amount", value: "fixed_amount" },
        { label: "Fixed Price", value: "fixed_price" },
        { label: "Free Item", value: "free_item" },
      ],
      validation: { isRequired: true },
    }),
    valueBasisPoints: integer({ validation: { min: 0, max: 10000 } }),
    valueCents: centsField({ required: false }),
    minQuantity: quantityField({ required: false, min: "0.0001" }),
    buyQuantity: quantityField({ required: false, min: "0.0001" }),
    getQuantity: quantityField({ required: false, min: "0.0001" }),
    minSubtotalCents: centsField({ required: false }),
    maxDiscountCents: centsField({ required: false }),
    products: relationship({ ref: "Product", many: true }),
    categories: relationship({ ref: "ProductCategory", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

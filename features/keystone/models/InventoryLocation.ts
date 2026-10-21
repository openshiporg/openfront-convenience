import { list } from "@keystone-6/core";
import { relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const InventoryLocation = list({
  access: tenantAccess("canReadInventory", "canManageInventory", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "store", "type", "status"] },
  },
  fields: {
    business: businessField(),
    store: relationship({ ref: "Store.inventoryLocations" }),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    type: select({
      type: "enum",
      options: [
        { label: "Sales Floor", value: "sales_floor" },
        { label: "Back Room", value: "back_room" },
        { label: "Cooler", value: "cooler" },
        { label: "Freezer", value: "freezer" },
        { label: "Kitchen", value: "kitchen" },
        { label: "Warehouse", value: "warehouse" },
      ],
      defaultValue: "sales_floor",
      validation: { isRequired: true },
    }),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    stockLevels: relationship({ ref: "StockLevel.location", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

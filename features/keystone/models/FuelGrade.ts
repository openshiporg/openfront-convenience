import { list } from "@keystone-6/core";
import { integer, relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const FuelGrade = list({
  access: tenantAccess("canReadFuel", "canManageFuel", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "site"),
  ui: {
    labelField: "name",
    listView: { initialColumns: ["name", "code", "octaneRating", "site", "status"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    site: relationship({ ref: "FuelSite.grades" }),
    name: text({ validation: { isRequired: true } }),
    code: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    octaneRating: integer({ validation: { min: 0, max: 120 } }),
    productCode: text(),
    status: select({
      type: "enum",
      options: [
        { label: "Active", value: "active" },
        { label: "Unavailable", value: "unavailable" },
        { label: "Retired", value: "retired" },
      ],
      defaultValue: "active",
      validation: { isRequired: true },
    }),
    tanks: relationship({ ref: "FuelTank.grade", many: true }),
    nozzles: relationship({ ref: "FuelNozzle.grade", many: true }),
    prices: relationship({ ref: "FuelPrice.grade", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

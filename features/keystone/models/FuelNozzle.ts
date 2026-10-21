import { list } from "@keystone-6/core";
import { relationship, select, text } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const FuelNozzle = list({
  access: tenantAccess("canReadFuel", "canManageFuel", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "pump", "tank", "grade"),
  ui: {
    labelField: "nozzleNumber",
    listView: { initialColumns: ["nozzleNumber", "pump", "grade", "tank", "status"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    pump: relationship({ ref: "FuelPump.nozzles" }),
    tank: relationship({ ref: "FuelTank.nozzles" }),
    grade: relationship({ ref: "FuelGrade.nozzles" }),
    nozzleNumber: text({ validation: { isRequired: true } }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Available", value: "available" },
        { label: "Lifted", value: "lifted" },
        { label: "Dispensing", value: "dispensing" },
        { label: "Offline", value: "offline" },
        { label: "Maintenance", value: "maintenance" },
      ],
      defaultValue: "offline",
      validation: { isRequired: true },
    }),
    transactions: relationship({ ref: "FuelTransaction.nozzle", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

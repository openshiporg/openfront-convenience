import { list } from "@keystone-6/core";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { tenantAccess } from "../access";
import { businessField, metadataField, storeField } from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const FuelPump = list({
  access: tenantAccess("canReadFuel", "canManageFuel", { create: false, update: false, delete: false }),
  hooks: requiredRelationshipHooks("business", "store", "site"),
  ui: {
    labelField: "pumpNumber",
    listView: { initialColumns: ["pumpNumber", "site", "status", "controllerAddress", "lastCommunicationAt"] },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    site: relationship({ ref: "FuelSite.pumps" }),
    pumpNumber: text({ validation: { isRequired: true }, isIndexed: true }),
    lookupKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "enum",
      options: [
        { label: "Available", value: "available" },
        { label: "In Use", value: "in_use" },
        { label: "Offline", value: "offline" },
        { label: "Maintenance", value: "maintenance" },
        { label: "Emergency Stop", value: "emergency_stop" },
      ],
      defaultValue: "offline",
      validation: { isRequired: true },
    }),
    controllerAddress: text(),
    serialNumber: text(),
    lastCommunicationAt: timestamp(),
    nozzles: relationship({ ref: "FuelNozzle.pump", many: true }),
    transactions: relationship({ ref: "FuelTransaction.pump", many: true }),
    metadata: metadataField(),
    ...trackingFields,
  },
});

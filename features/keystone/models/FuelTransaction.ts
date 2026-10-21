import { list } from "@keystone-6/core";
import {
  integer,
  relationship,
  select,
  text,
  timestamp,
} from "@keystone-6/core/fields";

import { immutableTenantAccess } from "../access";
import {
  businessField,
  centsField,
  currencyCodeField,
  metadataField,
  quantityField,
  storeField,
} from "./modelFields";
import { trackingFields } from "./trackingFields";
import { requiredRelationshipHooks } from "./validation";

export const FuelTransaction = list({
  access: immutableTenantAccess("canReadFuel"),
  hooks: requiredRelationshipHooks(
    "business",
    "store",
    "site",
    "pump",
    "nozzle",
    "grade",
  ),
  ui: {
    labelField: "transactionNumber",
    listView: {
      initialColumns: [
        "transactionNumber",
        "pump",
        "grade",
        "status",
        "volumeGallons",
        "totalCents",
      ],
    },
  },
  fields: {
    business: businessField(),
    store: storeField(),
    site: relationship({ ref: "FuelSite.transactions" }),
    pump: relationship({ ref: "FuelPump.transactions" }),
    nozzle: relationship({ ref: "FuelNozzle.transactions" }),
    grade: relationship({ ref: "FuelGrade" }),
    transactionNumber: text({
      isIndexed: "unique",
      validation: { isRequired: true },
    }),
    controllerTransactionId: text({ isIndexed: true }),
    status: select({
      type: "enum",
      options: [
        { label: "Requested", value: "requested" },
        { label: "Authorized", value: "authorized" },
        { label: "Dispensing", value: "dispensing" },
        { label: "Completed", value: "completed" },
        { label: "Stopped", value: "stopped" },
        { label: "Declined", value: "declined" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Refunded", value: "refunded" },
      ],
      defaultValue: "requested",
      validation: { isRequired: true },
    }),
    volumeGallons: quantityField({ defaultValue: "0.0000", min: "0.0000" }),
    unitPriceMillsPerGallon: integer({
      validation: { isRequired: true, min: 0 },
    }),
    totalCents: centsField({ defaultValue: 0 }),
    authorizedCents: centsField({ defaultValue: 0 }),
    currencyCode: currencyCodeField(),
    sale: relationship({ ref: "Sale" }),
    tender: relationship({ ref: "Tender" }),
    requestedAt: timestamp({
      defaultValue: { kind: "now" },
      validation: { isRequired: true },
    }),
    authorizedAt: timestamp(),
    dispensingStartedAt: timestamp(),
    completedAt: timestamp(),
    idempotency: relationship({ ref: "IdempotencyKey" }),
    metadata: metadataField("Controller response summary without credentials"),
    ...trackingFields,
  },
});

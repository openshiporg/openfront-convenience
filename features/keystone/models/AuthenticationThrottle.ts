import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { integer, text, timestamp } from "@keystone-6/core/fields";

import { trackingFields } from "./trackingFields";

/**
 * A database-backed authentication throttle shared by all application replicas.
 * Keys are one-way digests of an operation class plus normalized identity; raw
 * email addresses, passwords, reset tokens, and source addresses are never stored.
 */
export const AuthenticationThrottle = list({
  access: {
    operation: {
      query: denyAll,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
  },
  ui: { isHidden: true },
  fields: {
    keyHash: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    count: integer({ defaultValue: 0, validation: { isRequired: true, min: 0 } }),
    resetsAt: timestamp({ validation: { isRequired: true }, isIndexed: true }),
    ...trackingFields,
  },
});

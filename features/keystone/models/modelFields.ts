import {
  decimal,
  integer,
  json,
  relationship,
  text,
} from "@keystone-6/core/fields";

import { assertNoInlineSecrets } from "../lib/secretPolicy";

export function businessField() {
  return relationship({
    ref: "Business",
    access: { update: () => false },
    ui: { itemView: { fieldMode: "read" } },
  });
}

export function storeField() {
  return relationship({
    ref: "Store",
    access: { update: () => false },
    ui: { itemView: { fieldMode: "read" } },
  });
}

export function quantityField({
  defaultValue,
  required = true,
  min,
  description,
}: {
  defaultValue?: string;
  required?: boolean;
  min?: string;
  description?: string;
} = {}) {
  return decimal({
    precision: 18,
    scale: 4,
    ...(defaultValue === undefined ? {} : { defaultValue }),
    validation: {
      isRequired: required,
      ...(min === undefined ? {} : { min }),
    },
    ui: description ? { description } : undefined,
  });
}

export function centsField({
  defaultValue,
  required = true,
  allowNegative = false,
  description,
}: {
  defaultValue?: number;
  required?: boolean;
  allowNegative?: boolean;
  description?: string;
} = {}) {
  return integer({
    ...(defaultValue === undefined ? {} : { defaultValue }),
    validation: {
      isRequired: required,
      ...(allowNegative ? {} : { min: 0 }),
    },
    ui: {
      description: description ?? "Amount in integer minor currency units (cents)",
    },
  });
}

export function currencyCodeField() {
  return text({
    defaultValue: "USD",
    validation: {
      isRequired: true,
      match: {
        regex: /^[A-Z]{3}$/,
        explanation: "Currency code must be a three-letter ISO 4217 code",
      },
    },
  });
}

export function metadataField(description = "Non-authoritative metadata only") {
  return json({
    defaultValue: {},
    hooks: {
      validateInput(args) {
        const value = (args.resolvedData as Record<string, unknown>)[String(args.fieldKey)];
        if (value === undefined) return;
        if (JSON.stringify(value).length > 32 * 1024) {
          args.addValidationError("Metadata exceeds 32 KiB");
          return;
        }
        try {
          assertNoInlineSecrets(value);
        } catch (error) {
          args.addValidationError(error instanceof Error ? error.message : "Metadata contains disallowed secret material");
        }
      },
    },
    ui: { description },
  });
}

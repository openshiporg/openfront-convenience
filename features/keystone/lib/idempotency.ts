import { createHash } from "node:crypto";

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value) ?? "undefined";
}

export function normalizeIdempotencyKey(value?: string | null): string {
  const key = value?.trim() ?? "";

  if (key.length < 16) {
    throw new Error("Idempotency key must be at least 16 characters");
  }
  if (key.length > 128) {
    throw new Error("Idempotency key must be at most 128 characters");
  }
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new Error("Idempotency key contains unsupported characters");
  }

  return key;
}

export function buildScopedIdempotencyKey(scope: string, key: string): string {
  return createHash("sha256").update(`${scope}:${key}`).digest("hex");
}

export function fingerprintInput(input: unknown): string {
  return createHash("sha256").update(stableSerialize(input)).digest("hex");
}

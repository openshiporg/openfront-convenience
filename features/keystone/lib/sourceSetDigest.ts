import { createHash } from "node:crypto";

/**
 * Stable evidence fingerprint for a bounded reconciliation source set. Values
 * are opaque row IDs only; amounts are independently recomputed at approval.
 */
export function sourceSetDigest(
  groups: Record<string, Array<string | null>>,
): string {
  const normalized = Object.fromEntries(
    Object.entries(groups)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, values]) => [
        name,
        [
          ...new Set(values.filter((value): value is string => Boolean(value))),
        ].sort(),
      ]),
  );
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function metadataSourceSetDigest(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const digest = (value as Record<string, unknown>).sourceSetDigest;
  return typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest)
    ? digest
    : null;
}

export function normalizeInventoryCountSearch(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") {
    throw new Error("Inventory count search must be a single text value");
  }
  if (value.length > 80) {
    throw new Error("Inventory count search must not exceed 80 characters");
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(
      "Inventory count search must not contain control characters",
    );
  }
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length < 2) {
    throw new Error("Inventory count search must be at least 2 characters");
  }
  return normalized;
}

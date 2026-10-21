export const FOODSERVICE_PREP_BATCH_SEARCH_MAX_LENGTH = 80;

export function normalizeFoodservicePrepBatchSearch(
  value: unknown,
): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("Prep-batch search must be a single text value");
  }
  if (value.length > FOODSERVICE_PREP_BATCH_SEARCH_MAX_LENGTH) {
    throw new Error("Prep-batch search must not exceed 80 characters");
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(
      "Prep-batch search contains unsupported control characters",
    );
  }

  const query = value.trim();
  if (!query) return null;
  if (query.length < 2) {
    throw new Error("Prep-batch search must contain at least 2 characters");
  }
  return query;
}

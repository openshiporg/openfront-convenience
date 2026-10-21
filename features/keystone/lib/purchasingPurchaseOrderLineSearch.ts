export const PURCHASING_ORDER_LINE_SEARCH_MAX_LENGTH = 80;

export function normalizePurchasingOrderLineSearch(
  value: unknown,
): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("Receiving-line search must be a single text value");
  }
  if (value.length > PURCHASING_ORDER_LINE_SEARCH_MAX_LENGTH) {
    throw new Error("Receiving-line search must not exceed 80 characters");
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(
      "Receiving-line search contains unsupported control characters",
    );
  }

  const query = value.trim();
  if (!query) return null;
  if (query.length < 2) {
    throw new Error("Receiving-line search must contain at least 2 characters");
  }
  return query;
}

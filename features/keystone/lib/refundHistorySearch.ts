export const REFUND_HISTORY_SEARCH_MAX_LENGTH = 80;

export function normalizeRefundHistorySearch(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error("Refund history search must be a single text value");
  }
  if (value.length > REFUND_HISTORY_SEARCH_MAX_LENGTH) {
    throw new Error("Refund history search must not exceed 80 characters");
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error(
      "Refund history search contains unsupported control characters",
    );
  }

  const reference = value.trim();
  if (!reference) return null;
  if (reference.length < 2) {
    throw new Error("Refund history search must contain at least 2 characters");
  }
  return reference;
}

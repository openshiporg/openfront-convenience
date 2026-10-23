// Human-readable references and quantities, shared by the projection and the POS screens.

const REFERENCE_WORDS: Record<string, string> = {
  CART: "Basket",
  REG: "Till",
  SHIFT: "Shift",
  SALE: "Sale",
  RCPT: "Receipt",
};

/** "CART-c11b2d04-544b-…" → "Basket C11B2D"; short, human-readable codes pass through. */
export function shortRef(code: string | null | undefined): string {
  const value = (code ?? "").trim();
  const match = /^([A-Z]+)-([0-9a-f]{6})[0-9a-f]{2}-[0-9a-f-]{20,}$/i.exec(value);
  if (!match) return value;
  return `${REFERENCE_WORDS[match[1].toUpperCase()] ?? match[1]} ${match[2].toUpperCase()}`;
}

/** "1.0000" → "1", "0.5000" → "0.5". */
export function quantityText(value: unknown): string {
  const text = String(value ?? "");
  return /^-?\d+\.\d+$/.test(text) ? text.replace(/\.?0+$/, "") : text;
}

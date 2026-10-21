const SCALE = 4;
const SCALE_FACTOR = 10n ** BigInt(SCALE);
const DECIMAL_PATTERN = /^([+-]?)(\d+)(?:\.(\d+))?$/;

function toScaledInteger(value: string | number): bigint {
  const source = String(value).trim();
  const match = DECIMAL_PATTERN.exec(source);

  if (!match) {
    throw new Error("Value must be a valid decimal quantity");
  }

  const [, sign, whole, fraction = ""] = match;
  if (fraction.length > SCALE) {
    throw new Error(`Quantity supports at most ${SCALE} decimal places`);
  }
  if (`${whole}${fraction}`.replace(/^0+/, "").length > 18) {
    throw new Error("Quantity exceeds decimal(18,4) precision");
  }

  const scaled = BigInt(whole) * SCALE_FACTOR + BigInt(fraction.padEnd(SCALE, "0"));
  return sign === "-" ? -scaled : scaled;
}

function fromScaledInteger(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / SCALE_FACTOR;
  const fraction = (absolute % SCALE_FACTOR).toString().padStart(SCALE, "0");
  return `${absolute === 0n ? "" : sign}${whole}.${fraction}`;
}

export function normalizeQuantity(value: string | number): string {
  return fromScaledInteger(toScaledInteger(value));
}

export function addQuantities(left: string | number, right: string | number): string {
  return fromScaledInteger(toScaledInteger(left) + toScaledInteger(right));
}

export function compareQuantities(left: string | number, right: string | number): -1 | 0 | 1 {
  const leftValue = toScaledInteger(left);
  const rightValue = toScaledInteger(right);
  return leftValue === rightValue ? 0 : leftValue > rightValue ? 1 : -1;
}

export function quantityToScaledInteger(value: string | number): bigint {
  return toScaledInteger(value);
}

export function scaledIntegerToQuantity(value: bigint): string {
  return fromScaledInteger(value);
}

export const QUANTITY_SCALE_FACTOR = SCALE_FACTOR;

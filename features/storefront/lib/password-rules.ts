import "server-only";

// dumb-passwords knows "password" but not "password123", so the word without its
// leading/trailing digits and symbols is checked too, along with character
// variety and the email's own name (the same rule Analytics uses).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dumbPasswords = require("dumb-passwords") as { check(password: string): boolean };

export function isCommonPassword(password: string, email: string): boolean {
  const lower = password.toLowerCase();
  const stem = lower.replace(/^[\d\W_]+|[\d\W_]+$/g, "");
  const local = email.split("@")[0]?.toLowerCase() || "";
  return (
    dumbPasswords.check(password) ||
    (stem.length >= 3 && dumbPasswords.check(stem)) ||
    new Set(lower).size < 4 ||
    (local.length >= 3 && lower.includes(local))
  );
}

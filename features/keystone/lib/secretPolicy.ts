const SENSITIVE_KEY_PATTERN =
  /(?:password|passphrase|secret|token|pin|authority|authorization|proof|api[_-]?key|private[_-]?key|client[_-]?secret|signing[_-]?key)/i;
const SAFE_KEY_PATTERN =
  /^(?:publishableKey|tokenPreview|secretReference|credentialReference)$/i;

function isSensitiveKey(key: string): boolean {
  return !SAFE_KEY_PATTERN.test(key) && SENSITIVE_KEY_PATTERN.test(key);
}

function findSensitivePath(value: unknown, path: string[] = []): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findSensitivePath(value[index], [...path, String(index)]);
      if (found) return found;
    }
    return null;
  }

  if (!value || typeof value !== "object") return null;

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const currentPath = [...path, key];
    if (
      isSensitiveKey(key) &&
      entry !== null &&
      entry !== undefined &&
      entry !== ""
    ) {
      return currentPath.join(".");
    }
    const found = findSensitivePath(entry, currentPath);
    if (found) return found;
  }

  return null;
}

export function assertNoInlineSecrets(value: unknown): void {
  const sensitivePath = findSensitivePath(value);
  if (sensitivePath) {
    throw new Error(
      `Inline secret-like configuration is not allowed at ${sensitivePath}; use a secretReference or credentialReference`,
    );
  }
}

export function assertOpaqueSecretReference(
  value: string | null | undefined,
): void {
  if (!value) return;
  if (
    !/^(?:env|vault|secret|aws-sm|gcp-sm|azure-kv):\/\/[A-Za-z0-9][A-Za-z0-9._/:@-]*$/.test(
      value,
    )
  ) {
    throw new Error(
      "Credential must be an opaque secret reference (env://, vault://, secret://, aws-sm://, gcp-sm://, or azure-kv://)",
    );
  }
}

export function redactSensitiveValues(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveValues);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      isSensitiveKey(key) ? "[REDACTED]" : redactSensitiveValues(entry),
    ]),
  );
}

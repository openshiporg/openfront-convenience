export type ParsedMachineApiToken = { keyPrefix: string };

/**
 * Parse only the public indexed lookup prefix. Failed-attempt state is stored on
 * the matching ApiKey row so it is shared by every process and cannot grow an
 * attacker-controlled in-memory prefix map.
 */
export function parseMachineApiToken(value: string): ParsedMachineApiToken | null {
  const match = /^ofc_([a-f0-9]{12})_([A-Za-z0-9_-]{24,128})$/.exec(value);
  return match ? { keyPrefix: `ofc_${match[1]}` } : null;
}

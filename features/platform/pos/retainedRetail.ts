export type RetailPurpose = "completePosSale" | "refundPosSale";
export type RetailIdentity = { userId: string; businessId: string; storeId: string };
export type RetailIntent = RetailIdentity & { version: 1; purpose: RetailPurpose; key: string; fields: Record<string, string> };
export type RetailReceipt = { id: string; status: string; reference: string | null };
export const retailFields = {
  completePosSale: ["cartId", "method", "amountCents", "tenderedCents", "paymentProviderId", "providerPaymentId", "providerAuthority", "cardBrand", "cardLast4", "method2", "amountCents2", "tenderedCents2", "paymentProviderId2", "providerPaymentId2", "providerAuthority2", "cardBrand2", "cardLast42"],
  refundPosSale: ["saleId", "originalTenderId", "refundAllocationCents", "providerRefundId", "providerAuthority", "originalTenderId2", "refundAllocationCents2", "providerRefundId2", "providerAuthority2", "registerSessionId", "employeeId", "reason", "returnReason", "notes", "overrideNonReturnable", "overrideReason", "managerPin", "saleLineId", "quantity", "disposition", "condition"],
} as const;
export function sameRetailIdentity(a: RetailIdentity, b: RetailIdentity) { return a.userId === b.userId && a.businessId === b.businessId && a.storeId === b.storeId; }
function object(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
export function parseRetailIntent(value: unknown): RetailIntent {
  const item = object(value), fields = object(item?.fields);
  if (!item || item.version !== 1 || !["completePosSale", "refundPosSale"].includes(String(item.purpose)) || !fields || Object.keys(item).some(key => !["version","purpose","key","fields","userId","businessId","storeId"].includes(key))) throw new Error("Invalid retained operation");
  const purpose = item.purpose as RetailPurpose;
  for (const key of ["userId", "businessId", "storeId", "key"] as const) if (typeof item[key] !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(item[key])) throw new Error("Invalid retained identity");
  if (Object.keys(fields).some(key => !(retailFields[purpose] as readonly string[]).includes(key)) || Object.values(fields).some(value => typeof value !== "string" || value.length > 20_000) || JSON.stringify(fields).length > 60_000) throw new Error("Invalid retained fields");
  return { version: 1, purpose, key: String(item.key), userId: String(item.userId), businessId: String(item.businessId), storeId: String(item.storeId), fields: fields as Record<string, string> };
}
export function captureRetailIntent(form: FormData, identity: RetailIdentity, purpose: RetailPurpose, key: string): RetailIntent {
  if (form.get("businessId") !== identity.businessId || form.get("storeId") !== identity.storeId) throw new Error("Original store changed");
  return parseRetailIntent({ version: 1, ...identity, purpose, key, fields: Object.fromEntries(retailFields[purpose].map(name => [name, String(form.get(name) ?? "")])) });
}
export function retailIntentForm(intent: RetailIntent) {
  const form = new FormData();
  form.set("__intent", JSON.stringify(parseRetailIntent(intent)));
  return form;
}
export function confirmedRetailReceipt(value: unknown, intent: RetailIntent): RetailReceipt | null {
  const result = object(value);
  if (!result || result.state !== "succeeded" || result.retryable !== false || typeof result.id !== "string" || !result.id || typeof result.status !== "string" || result.status !== "completed" || result.purpose !== intent.purpose || result.key !== intent.key || !(result.reference === null || typeof result.reference === "string")) return null;
  return { id: result.id, status: result.status, reference: result.reference };
}

type Vault = { load(): Promise<RetailIntent | null>; save(intent: RetailIntent): Promise<void>; confirm(intent: RetailIntent, receipt: RetailReceipt): Promise<void> };
type Ports = { read(intent: RetailIntent): Promise<unknown>; submit(intent: RetailIntent): Promise<unknown> };
/** Register-close pattern: roundtrip BEFORE network; never infer rollback or rekey. */
export async function performRetainedRetail(vault: Vault, identity: RetailIdentity, mode: "new" | "read" | "retry", candidate: RetailIntent | null, ports: Ports) {
  const stored = await vault.load();
  const intent = mode === "new" ? candidate : stored;
  if (!intent || (mode === "new" && stored) || !sameRetailIdentity(intent, identity) || (candidate && JSON.stringify(candidate) !== JSON.stringify(intent))) throw new Error("Original operation is unavailable or changed");
  await vault.save(intent);
  if (JSON.stringify(await vault.load()) !== JSON.stringify(intent)) throw new Error("Private storage did not roundtrip");
  let outcome: unknown;
  try { outcome = await ports.read(intent); } catch { outcome = null; }
  let receipt = confirmedRetailReceipt(outcome, intent);
  if (!receipt && mode !== "read") {
    try { await ports.submit(intent); } catch { /* ambiguous; retain original */ }
    try { outcome = await ports.read(intent); } catch { outcome = null; }
    receipt = confirmedRetailReceipt(outcome, intent);
  }
  if (receipt) await vault.confirm(intent, receipt);
  return { intent, receipt };
}

// Role permissions in the words a store owner uses: one row per area of the store,
// a "View" and a "Change" box each, then the few switches that stand alone.
// Every key in features/keystone/access.ts permissionKeys appears exactly once.

export type PermissionArea = { label: string; hint: string; read?: string; manage?: string };

export const PERMISSION_AREAS: PermissionArea[] = [
  { label: "Sales and refunds", hint: "Ring up sales, refunds and returns", read: "canReadSales", manage: "canManageSales" },
  { label: "Cash and tills", hint: "Open and close tills, cash drops and counts", read: "canReadCash", manage: "canManageCash" },
  { label: "Payments", hint: "Card providers, voids and payment refunds", read: "canReadPayments", manage: "canManagePayments" },
  { label: "Products", hint: "Items, barcodes and variants", read: "canReadCatalog", manage: "canManageCatalog" },
  { label: "Prices and tax", hint: "Price books and tax rates", read: "canReadPricing", manage: "canManagePricing" },
  { label: "Promotions", hint: "Discounts and deals", read: "canReadPromotions", manage: "canManagePromotions" },
  { label: "Stock", hint: "Counts, corrections and waste", read: "canReadInventory", manage: "canManageInventory" },
  { label: "Purchasing", hint: "Vendors, orders and deliveries", read: "canReadPurchasing", manage: "canManagePurchasing" },
  { label: "Customers and rewards", hint: "Members and points", read: "canReadLoyalty", manage: "canManageLoyalty" },
  { label: "ID checks", hint: "Age-restricted sales and refusals", read: "canReadCompliance", manage: "canManageCompliance" },
  { label: "Prepared food", hint: "Recipes, batches and hold times", read: "canReadPreparedFood", manage: "canManagePreparedFood" },
  { label: "Fuel", hint: "Grades, prices and tank readings", read: "canReadFuel", manage: "canManageFuel" },
  { label: "Lottery", hint: "Packs, sales and settlements", read: "canReadLottery", manage: "canManageLottery" },
  { label: "Money services", hint: "Money orders and bill payments", read: "canReadMoneyServices", manage: "canManageMoneyServices" },
  { label: "Staff", hint: "People, shifts and store access", read: "canReadPeople", manage: "canManagePeople" },
  { label: "Reports", hint: "Sales and day-close reports", read: "canReadReporting", manage: "canManageReporting" },
  { label: "Exports", hint: "Accounting and tax exports", read: "canReadExports", manage: "canManageExports" },
  { label: "Alerts", hint: "Exceptions and their review", read: "canReadAlerts", manage: "canManageAlerts" },
  { label: "Offline sales", hint: "Sales rung while the internet was down", read: "canReadOfflineOperations", manage: "canManageOfflineOperations" },
  { label: "Integrations", hint: "Connected services", read: "canReadIntegrations", manage: "canManageIntegrations" },
];

export const PERMISSION_SWITCHES: Array<{ key: string; label: string; hint: string }> = [
  { key: "canAccessDashboard", label: "Sign in to the dashboard", hint: "Without it the person can't use any of the above" },
  { key: "canUseAssistant", label: "Use the assistant", hint: "Ask questions about the store's data" },
  { key: "canReadAudit", label: "See the activity log", hint: "Who changed what, and when" },
  { key: "canManageRoles", label: "Manage roles", hint: "Create roles and change what they allow" },
  { key: "canManageBusiness", label: "Business settings", hint: "Store details, hours and receipts" },
  { key: "canManageOnboarding", label: "Store set-up", hint: "Run the set-up steps again" },
  { key: "canManageApiKeys", label: "API keys", hint: "Keys for other software to connect" },
];

export const ALL_PERMISSION_KEYS: string[] = [
  ...PERMISSION_AREAS.flatMap((area) => [area.read, area.manage].filter((key): key is string => Boolean(key))),
  ...PERMISSION_SWITCHES.map((entry) => entry.key),
];

/** "Sales, Cash and tills, +6 more": what a role can change, in one line. */
export function roleSummary(role: Record<string, unknown>): string {
  const changes = PERMISSION_AREAS.filter((area) => area.manage && role[area.manage]).map((area) => area.label);
  const views = PERMISSION_AREAS.filter((area) => area.read && role[area.read] && !(area.manage && role[area.manage])).length;
  if (!changes.length) return views ? `View only · ${views} areas` : "No access";
  const shown = changes.slice(0, 3).join(", ");
  return `${changes.length > 3 ? `${shown}, +${changes.length - 3} more` : shown}${views ? ` · views ${views} more` : ""}`;
}

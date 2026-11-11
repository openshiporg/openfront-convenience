/**
 * Sidebar filtering from capabilities the session already has: the role's
 * canAccessDashboard flag and Keystone's per-session list `isHidden` from admin meta.
 * Plain module: no 'use server' / 'use client', no @/ imports.
 */

type SidebarList = { path: string; isHidden?: boolean | null }
type SidebarUser = { role?: { canAccessDashboard?: boolean | null; permissions?: string[] | null } | null } | null | undefined

/** Only an explicit false hides navigation; an unknown user is left to the middleware. */
export function canUseDashboardNav(user: SidebarUser) {
  return user?.role?.canAccessDashboard !== false
}

export function visibleSidebarLists<T extends SidebarList>(lists: T[], user: SidebarUser): T[] {
  if (!canUseDashboardNav(user)) return []
  return lists.filter((list) => !list.isHidden)
}

/**
 * Permissions each platform page checks (the same keys its data projection or list requires),
 * keyed by the first path segment after /platform ('' is the overview).
 */
const REPORTING_CASH_PEOPLE = ['canReadReporting', 'canReadCash', 'canReadPeople']
const platformPagePermissions: Record<string, string[]> = {
  '': REPORTING_CASH_PEOPLE,
  pos: ['canReadSales', 'canReadCash'],
  'store-settings': ['canManageBusiness'],
  sales: ['canReadSales'],
  tills: ['canReadCash'],
  staff: ['canReadPeople'],
  fuel: ['canReadFuel', 'canReadPurchasing', 'canReadPeople'],
  reconciliation: REPORTING_CASH_PEOPLE,
  exceptions: ['canReadAlerts', 'canReadPeople'],
  recovery: ['canReadOfflineOperations', 'canReadIntegrations', 'canManageApiKeys', 'canReadPeople'],
  products: ['canReadCatalog'],
  stock: ['canReadInventory'],
  inventory: ['canReadInventory', 'canReadCatalog', 'canReadPeople'],
  purchasing: ['canReadPurchasing', 'canReadCatalog', 'canReadInventory', 'canReadPeople'],
  vendors: ['canReadPurchasing'],
  'purchase-orders': ['canReadPurchasing'],
  pricing: ['canReadPricing', 'canReadPromotions', 'canReadCatalog'],
  promotions: ['canReadPromotions'],
  foodservice: ['canReadPreparedFood', 'canReadInventory', 'canReadCatalog', 'canReadPeople'],
  'restricted-sales': ['canReadCompliance', 'canReadSales', 'canReadCatalog', 'canReadPeople'],
  lottery: ['canReadLottery', 'canReadCash', 'canReadPeople'],
  'money-services': ['canReadMoneyServices', 'canReadCash', 'canReadPeople'],
  payments: ['canReadPayments', 'canReadIntegrations', 'canReadPeople'],
  customers: ['canReadLoyalty'],
  loyalty: ['canReadLoyalty', 'canReadPeople'],
  reports: ['canReadReporting'],
  exports: ['canReadExports', 'canReadPeople'],
}

/**
 * A platform page whose first segment is a list path follows that list's visibility;
 * pages that are not tied to one list stay visible to dashboard users.
 */
export function visiblePlatformItems<T extends { href: string }>(
  items: T[],
  lists: SidebarList[],
  user: SidebarUser
): T[] {
  if (!canUseDashboardNav(user)) return []
  const hiddenPaths = new Set(lists.filter((list) => list.isHidden).map((list) => list.path))
  return items.filter((item) => {
    const slug = item.href.split('/platform/')[1]?.split(/[/?#]/)[0] ?? ''
    if (slug && hiddenPaths.has(slug)) return false
    // Unknown permissions (older session payload) never hide anything.
    const held = user?.role?.permissions
    const needed = platformPagePermissions[slug]
    return !held || !needed || needed.every((permission) => held.includes(permission))
  })
}

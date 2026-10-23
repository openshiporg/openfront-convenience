import type { Context } from ".keystone/types";

import { storefrontHoursFromMetadata } from "../../storefront/lib/storefront-settings";
import { effectiveTenderRefundedCents } from "../lib/refundAccounting";
import { normalizePurchasingVariantSearch } from "../lib/purchasingSelectorSearch";
import { normalizePurchasingVendorItemSearch } from "../lib/purchasingVendorItemSearch";
import { normalizePurchasingOrderLineSearch } from "../lib/purchasingPurchaseOrderLineSearch";
import { normalizePosCartSearch } from "../lib/posCartSearch";
import { normalizePosReceiptSearch } from "../lib/posReceiptSearch";
import { normalizePosVariantSearch } from "../lib/posVariantSearch";
import { normalizePosVoidReceiptSearch } from "../lib/posVoidReceiptSearch";
import { normalizeRefundHistorySearch } from "../lib/refundHistorySearch";
import { normalizeInventoryCountSearch } from "../lib/inventoryCountSearch";
import { normalizeInventoryLocationSearch } from "../lib/inventoryLocationSearch";
import { normalizeInventoryVariantSearch } from "../lib/inventoryVariantSearch";
import { normalizeInventoryTransferSearch } from "../lib/inventoryTransferSearch";
import { normalizeLoyaltyAccountSearch } from "../lib/loyaltyAccountSearch";
import { normalizeFoodserviceRecipeSearch } from "../lib/foodserviceRecipeSearch";
import { normalizeFoodserviceSkuSearch } from "../lib/foodserviceSkuSearch";
import { normalizeFoodserviceLocationCodeSearch } from "../lib/foodserviceLocationCodeSearch";
import { normalizeFoodservicePrepBatchSearch } from "../lib/foodservicePrepBatchSearch";
import { normalizeFoodserviceEmployeeNumberSearch } from "../lib/foodserviceEmployeeNumberSearch";
import { normalizePurchasingVendorSearch } from "../lib/purchasingVendorSearch";
import { normalizePurchasingOrderSearch } from "../lib/purchasingOrderSearch";
import {
  assertBusinessPermission,
  assertStorePermission,
  businessIdsForPermission,
  canAccessStore,
  hasUnrestrictedStoreAccess,
  isHumanPlatformAdmin,
  storeIdsForPermission,
  type PermissionKey,
  type Session,
} from "../access";
import { quantityText, shortRef } from "../../platform/lib/labels";
import { zonedIso, zonedNowInput } from "../../platform/lib/form-values";

export const platformSurfaces = [
  "overview",
  "store_settings",
  "pos",
  "fuel",
  "inventory",
  "purchasing",
  "pricing",
  "compliance",
  "foodservice",
  "loyalty",
  "payments",
  "lottery",
  "money_services",
  "reconciliation",
  "reports",
  "exports",
  "recovery",
  "exceptions",
] as const;

export type PlatformSurface = (typeof platformSurfaces)[number];

type Metric = { label: string; value: string; detail: string; tone: string };
type Row = {
  id: string;
  title: string;
  detail: string;
  status: string;
  metric: string;
  occurredAt: string | null;
};
type Option = { id: string; label: string; detail?: string };

type Projection = {
  surface: PlatformSurface;
  businessId: string | null;
  storeId: string | null;
  generatedAt: string;
  limit: number;
  timezone: string | null;
  currencyCode: string | null;
  brand: {
    name: string;
    tagline: string;
    mark: string;
    logoIcon: string;
    logoColor: string;
    primaryColor: string;
    accentColor: string;
    storefrontMode: "demo" | "live";
    storefrontStatus: "draft" | "published";
    store: {
      id: string;
      name: string;
      addressLine1: string;
      addressLine2: string;
      city: string;
      stateProvince: string;
      postalCode: string;
      countryCode: string;
      phone: string;
      hours: ReturnType<typeof storefrontHoursFromMetadata>;
    } | null;
  } | null;
  businesses: Option[];
  stores: Option[];
  metrics: Metric[];
  rows: Row[];
  controls: Record<string, Option[]>;
};

const surfacePermissions: Record<PlatformSurface, readonly PermissionKey[]> = {
  overview: ["canReadReporting", "canReadCash", "canReadPeople"],
  store_settings: ["canManageBusiness"],
  // Sales and cash are the workstation's required operating domains. Catalog
  // fallback, external providers, promotions, loyalty, and staff directory are
  // optional controls and are queried only when separately authorized.
  pos: ["canReadSales", "canReadCash"],
  fuel: ["canReadFuel", "canReadPurchasing", "canReadPeople"],
  inventory: ["canReadInventory", "canReadCatalog", "canReadPeople"],
  purchasing: [
    "canReadPurchasing",
    "canReadCatalog",
    "canReadInventory",
    "canReadPeople",
  ],
  pricing: ["canReadPricing", "canReadPromotions", "canReadCatalog"],
  compliance: [
    "canReadCompliance",
    "canReadSales",
    "canReadCatalog",
    "canReadPeople",
  ],
  foodservice: [
    "canReadPreparedFood",
    "canReadInventory",
    "canReadCatalog",
    "canReadPeople",
  ],
  loyalty: ["canReadLoyalty", "canReadPeople"],
  payments: ["canReadPayments", "canReadIntegrations", "canReadPeople"],
  lottery: ["canReadLottery", "canReadCash", "canReadPeople"],
  money_services: ["canReadMoneyServices", "canReadCash", "canReadPeople"],
  reconciliation: ["canReadReporting", "canReadCash", "canReadPeople"],
  reports: ["canReadReporting"],
  exports: ["canReadExports", "canReadPeople"],
  recovery: [
    "canReadOfflineOperations",
    "canReadIntegrations",
    "canManageApiKeys",
    "canReadPeople",
  ],
  exceptions: ["canReadAlerts", "canReadPeople"],
};

/** "Whole Milk — 1 quart": the product name first, so cashiers can tell items apart. */
function formatCents(cents: number | bigint | string, currency: string): string {
  const value = Number(cents);
  if (!Number.isFinite(value)) return String(cents);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value / 100);
  } catch {
    return (value / 100).toFixed(2);
  }
}

function humanStatus(status: string | null | undefined): string {
  const text = (status ?? "").replaceAll("_", " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

function variantLabel(entry: { title: string; product?: { title: string } | null }): string {
  const product = entry.product?.title?.trim();
  if (!product) return entry.title;
  if (!entry.title.trim() || entry.title.trim().toLowerCase() === product.toLowerCase()) return product;
  return `${product} — ${entry.title}`;
}

function intersection(groups: string[][]): string[] {
  if (!groups.length) return [];
  return groups[0]
    .filter((id) => groups.every((group) => group.includes(id)))
    .sort();
}

function boundedLimit(value: number | null | undefined): number {
  if (value == null) return 20;
  if (!Number.isSafeInteger(value) || value < 1 || value > 50) {
    throw new Error("Projection limit must be an integer from 1 to 50");
  }
  return value;
}

function date(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null;
}

function metric(
  label: string,
  value: number | string,
  detail: string,
  tone = "neutral",
): Metric {
  return { label, value: String(value), detail, tone };
}

function businessIdsForSurface(
  session: Session | undefined,
  surface: PlatformSurface,
): string[] | null {
  if (isHumanPlatformAdmin(session)) return null;
  const permissions = surfacePermissions[surface];
  const candidateIds = intersection(
    permissions.map((permission) =>
      businessIdsForPermission(session, permission),
    ),
  );
  if (surface === "store_settings" || hasUnrestrictedStoreAccess(session)) {
    return candidateIds;
  }
  return candidateIds.filter(
    (businessId) =>
      intersection(
        permissions.map((permission) =>
          storeIdsForPermission(session, permission, businessId),
        ),
      ).length > 0,
  );
}

function hasBusinessScope(
  session: Session | undefined,
  permission: PermissionKey,
): boolean {
  return (
    isHumanPlatformAdmin(session) ||
    businessIdsForPermission(session, permission).length > 0
  );
}

function hasStoreScope(
  session: Session | undefined,
  permission: PermissionKey,
): boolean {
  if (isHumanPlatformAdmin(session)) return true;
  const businessIds = businessIdsForPermission(session, permission);
  if (hasUnrestrictedStoreAccess(session)) return businessIds.length > 0;
  return businessIds.some(
    (businessId) =>
      storeIdsForPermission(session, permission, businessId).length > 0,
  );
}

export type PlatformNavigationProjection = {
  surfaces: PlatformSurface[];
  canReadPeople: boolean;
  canManageRoles: boolean;
  canReadCatalog: boolean;
  canReadPricing: boolean;
  canReadPricingAtStore: boolean;
  canReadPromotions: boolean;
};

export function conveniencePlatformNavigation(
  _root: unknown,
  _args: unknown,
  context: Context,
): PlatformNavigationProjection {
  const session = context.session as Session | undefined;
  return {
    surfaces: platformSurfaces.filter((surface) => {
      const allowedBusinesses = businessIdsForSurface(session, surface);
      return allowedBusinesses === null || allowedBusinesses.length > 0;
    }),
    canReadPeople: hasStoreScope(session, "canReadPeople"),
    canManageRoles: hasBusinessScope(session, "canManageRoles"),
    canReadCatalog: hasBusinessScope(session, "canReadCatalog"),
    canReadPricing: hasBusinessScope(session, "canReadPricing"),
    canReadPricingAtStore: hasStoreScope(session, "canReadPricing"),
    canReadPromotions: hasStoreScope(session, "canReadPromotions"),
  };
}

export async function conveniencePlatformProjection(
  _root: unknown,
  args: {
    input: {
      surface: PlatformSurface;
      businessId?: string | null;
      storeId?: string | null;
      limit?: number | null;
      variantSearch?: string | null;
      vendorItemSearch?: string | null;
      purchaseOrderLineSearch?: string | null;
      receiptSearch?: string | null;
      refundHistorySearch?: string | null;
      voidReceiptSearch?: string | null;
      posVariantSearch?: string | null;
      posCartSearch?: string | null;
      loyaltyAccountSearch?: string | null;
      recipeCodeSearch?: string | null;
      foodserviceSkuSearch?: string | null;
      foodserviceLocationCodeSearch?: string | null;
      foodserviceBatchNumberSearch?: string | null;
      foodserviceEmployeeNumberSearch?: string | null;
      inventoryCountSearch?: string | null;
      inventoryLocationSearch?: string | null;
      vendorSearch?: string | null;
      purchaseOrderSearch?: string | null;
      inventoryVariantSearch?: string | null;
      inventoryTransferSearch?: string | null;
    };
  },
  context: Context,
): Promise<Projection> {
  const surface = args.input.surface;
  if (!platformSurfaces.includes(surface))
    throw new Error("Unsupported platform projection surface");
  const variantSearch = normalizePurchasingVariantSearch(
    args.input.variantSearch,
  );
  const vendorItemSearch = normalizePurchasingVendorItemSearch(
    args.input.vendorItemSearch,
  );
  const purchaseOrderLineSearch = normalizePurchasingOrderLineSearch(
    args.input.purchaseOrderLineSearch,
  );
  const receiptSearch = normalizePosReceiptSearch(args.input.receiptSearch);
  const refundHistorySearch = normalizeRefundHistorySearch(
    args.input.refundHistorySearch,
  );
  const voidReceiptSearch = normalizePosVoidReceiptSearch(
    args.input.voidReceiptSearch,
  );
  const posVariantSearch = normalizePosVariantSearch(
    args.input.posVariantSearch,
  );
  const posCartSearch = normalizePosCartSearch(args.input.posCartSearch);
  const loyaltyAccountSearch = normalizeLoyaltyAccountSearch(
    args.input.loyaltyAccountSearch,
  );
  const recipeCodeSearch = normalizeFoodserviceRecipeSearch(
    args.input.recipeCodeSearch,
  );
  const foodserviceSkuSearch = normalizeFoodserviceSkuSearch(
    args.input.foodserviceSkuSearch,
  );
  const foodserviceLocationCodeSearch = normalizeFoodserviceLocationCodeSearch(
    args.input.foodserviceLocationCodeSearch,
  );
  const foodserviceBatchNumberSearch = normalizeFoodservicePrepBatchSearch(
    args.input.foodserviceBatchNumberSearch,
  );
  const foodserviceEmployeeNumberSearch =
    normalizeFoodserviceEmployeeNumberSearch(
      args.input.foodserviceEmployeeNumberSearch,
    );
  const inventoryCountSearch = normalizeInventoryCountSearch(
    args.input.inventoryCountSearch,
  );
  const inventoryLocationSearch = normalizeInventoryLocationSearch(
    args.input.inventoryLocationSearch,
  );
  const vendorSearch = normalizePurchasingVendorSearch(args.input.vendorSearch);
  const purchaseOrderSearch = normalizePurchasingOrderSearch(
    args.input.purchaseOrderSearch,
  );
  const inventoryVariantSearch = normalizeInventoryVariantSearch(
    args.input.inventoryVariantSearch,
  );
  const inventoryTransferSearch = normalizeInventoryTransferSearch(
    args.input.inventoryTransferSearch,
  );
  if (variantSearch && surface !== "purchasing") {
    throw new Error(
      "Variant search is only available on purchasing projections",
    );
  }
  if (vendorItemSearch && surface !== "purchasing") {
    throw new Error(
      "Vendor-item search is only available on purchasing projections",
    );
  }
  if (purchaseOrderLineSearch && surface !== "purchasing") {
    throw new Error(
      "Receiving-line search is only available on purchasing projections",
    );
  }
  if (receiptSearch && surface !== "pos") {
    throw new Error("Receipt search is only available on POS projections");
  }
  if (refundHistorySearch && surface !== "pos") {
    throw new Error(
      "Refund history search is only available on POS projections",
    );
  }
  if (voidReceiptSearch && surface !== "pos") {
    throw new Error("Void receipt search is only available on POS projections");
  }
  if (posVariantSearch && surface !== "pos") {
    throw new Error("POS item search is only available on POS projections");
  }
  if (posCartSearch && surface !== "pos") {
    throw new Error("POS cart search is only available on POS projections");
  }
  if (loyaltyAccountSearch && surface !== "loyalty") {
    throw new Error(
      "Loyalty account search is only available on loyalty projections",
    );
  }
  if (recipeCodeSearch && surface !== "foodservice") {
    throw new Error(
      "Recipe-code search is only available on foodservice projections",
    );
  }
  if (foodserviceSkuSearch && surface !== "foodservice") {
    throw new Error(
      "Foodservice SKU search is only available on foodservice projections",
    );
  }
  if (foodserviceLocationCodeSearch && surface !== "foodservice") {
    throw new Error(
      "Foodservice location search is only available on foodservice projections",
    );
  }
  if (foodserviceBatchNumberSearch && surface !== "foodservice") {
    throw new Error(
      "Prep-batch search is only available on foodservice projections",
    );
  }
  if (foodserviceEmployeeNumberSearch && surface !== "foodservice") {
    throw new Error(
      "Employee-number search is only available on foodservice projections",
    );
  }
  if (inventoryCountSearch && surface !== "inventory") {
    throw new Error(
      "Inventory count search is only available on inventory projections",
    );
  }
  if (inventoryLocationSearch && surface !== "inventory") {
    throw new Error(
      "Inventory location search is only available on inventory projections",
    );
  }
  if (vendorSearch && surface !== "purchasing") {
    throw new Error(
      "Vendor search is only available on purchasing projections",
    );
  }
  if (purchaseOrderSearch && surface !== "purchasing") {
    throw new Error(
      "Purchase-order search is only available on purchasing projections",
    );
  }
  if (inventoryVariantSearch && surface !== "inventory") {
    throw new Error(
      "Inventory variant search is only available on inventory projections",
    );
  }
  if (inventoryTransferSearch && surface !== "inventory") {
    throw new Error(
      "Inventory transfer search is only available on inventory projections",
    );
  }
  const permissions = surfacePermissions[surface];
  const session = context.session as Session | undefined;
  const limit = boundedLimit(args.input.limit);
  const allowedIds = businessIdsForSurface(session, surface);
  if (args.input.businessId) {
    for (const permission of permissions) {
      assertBusinessPermission(session, args.input.businessId, permission);
    }
  }
  // Store settings include the current storefront location's address/contact
  // data. Resolve and enforce an explicitly selected location before reading
  // the nested business/settings projection.
  const settingsStoreBusinessId =
    surface === "store_settings" && args.input.storeId
      ? (args.input.businessId ??
        allowedIds?.find((candidateBusinessId) =>
          permissions.every((permission) =>
            canAccessStore(
              session,
              candidateBusinessId,
              args.input.storeId!,
              permission,
            ),
          ),
        ) ??
        null)
      : null;
  if (
    surface === "store_settings" &&
    args.input.storeId &&
    allowedIds !== null &&
    !settingsStoreBusinessId
  ) {
    throw new Error("Access denied for this store");
  }
  if (args.input.storeId && settingsStoreBusinessId) {
    for (const permission of permissions) {
      assertStorePermission(
        session,
        settingsStoreBusinessId,
        args.input.storeId,
        permission,
      );
    }
  }

  const businesses = await context.prisma.business.findMany({
    where: {
      status: "active",
      ...(allowedIds ? { id: { in: allowedIds } } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      brandName: true,
      brandTagline: true,
      brandMark: true,
      logoIcon: true,
      logoColor: true,
      brandPrimaryColor: true,
      brandAccentColor: true,
      storefrontMode: true,
      storefrontStatus: true,
      storefrontStore: {
        select: {
          id: true,
          name: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          stateProvince: true,
          postalCode: true,
          countryCode: true,
          phone: true,
          metadata: true,
        },
      },
    },
    orderBy: { name: "asc" },
    take: 25,
  });
  const businessId =
    args.input.businessId ||
    settingsStoreBusinessId ||
    businesses[0]?.id ||
    null;
  if (!businessId) {
    return {
      surface,
      businessId: null,
      storeId: null,
      generatedAt: new Date().toISOString(),
      limit,
      timezone: null,
      currencyCode: null,
      brand: null,
      businesses: [],
      stores: [],
      metrics: [],
      rows: [],
      controls: {},
    };
  }
  for (const permission of permissions) {
    assertBusinessPermission(session, businessId, permission);
  }
  const selectedBusiness = businesses.find(
    (business) => business.id === businessId,
  );
  if (!selectedBusiness) {
    throw new Error("Selected business is outside the bounded projection set");
  }

  const unrestrictedStores = hasUnrestrictedStoreAccess(session);
  const allowedStoreIds = unrestrictedStores
    ? null
    : intersection(
        permissions.map((permission) =>
          storeIdsForPermission(session, permission, businessId),
        ),
      );
  const businessOnlySurface = surface === "store_settings";
  if (!businessOnlySurface && !unrestrictedStores && !allowedStoreIds?.length) {
    throw new Error("Access denied: this surface requires an assigned store");
  }
  const stores = await context.prisma.store.findMany({
    where: {
      businessId,
      status: "active",
      ...(allowedStoreIds ? { id: { in: allowedStoreIds } } : {}),
    },
    select: { id: true, name: true, code: true, timezone: true, currencyCode: true },
    orderBy: { name: "asc" },
    take: 50,
  });
  // Default to the first store the principal is actually authorized to use;
  // public storefront placement is not an operator permission grant.
  const storeId = args.input.storeId || stores[0]?.id || null;
  if (
    !businessOnlySurface &&
    (!storeId || !stores.some((store) => store.id === storeId))
  ) {
    throw new Error("Selected store is outside the authorized business scope");
  }
  if (storeId) {
    for (const permission of permissions) {
      assertStorePermission(session, businessId, storeId, permission);
    }
  }
  const scope = { businessId, storeId: storeId ?? "" };
  const selectedStore = stores.find((store) => store.id === storeId) ?? stores[0] ?? null;
  const cents = (value: number | bigint | string | null | undefined) =>
    formatCents(value ?? 0, selectedStore?.currencyCode ?? "USD");
  const controls: Record<string, Option[]> = {};
  const canReadPosPeople =
    surface !== "pos" ||
    canAccessStore(session, businessId, storeId ?? "", "canReadPeople");
  if (
    !businessOnlySurface &&
    !["overview", "pricing", "reports"].includes(surface) &&
    canReadPosPeople
  ) {
    controls.employees = (
      await context.prisma.employee.findMany({
        where: {
          businessId,
          status: "active",
          ...(storeId
            ? {
                stores: {
                  some: { id: storeId },
                  ...(unrestrictedStores
                    ? {}
                    : { every: { id: { in: allowedStoreIds ?? [] } } }),
                },
              }
            : {}),
        },
        select: {
          id: true,
          employeeNumber: true,
          user: { select: { name: true } },
        },
        orderBy: { employeeNumber: "asc" },
        take: 50,
      })
    ).map((employee) => ({
      id: employee.id,
      label: employee.user?.name?.trim() || employee.employeeNumber,
      detail: employee.user?.name?.trim() ? "" : employee.employeeNumber,
    }));
  } else if (surface === "pos") {
    const ownEmployee = session?.data.employees?.find(
      (employee) =>
        employee.status === "active" &&
        employee.business?.id === businessId &&
        employee.stores?.some((store) => store.id === storeId),
    );
    controls.employees = ownEmployee
      ? [
          {
            id: ownEmployee.id,
            label: "Signed-in cashier",
            detail: "Current employee",
          },
        ]
      : [];
  }

  let metrics: Metric[] = [];
  let rows: Row[] = [];

  if (surface === "overview") {
    // Live figures for an owner checking mid-shift, before the day is closed.
    const timeZone = selectedStore?.timezone || "UTC";
    const todayStart = new Date(zonedIso(`${zonedNowInput(timeZone).slice(0, 10)}T00:00`, timeZone));
    const todaySales = await context.prisma.sale.aggregate({
      where: {
        ...scope,
        // Gross sales: refunds are shown at reconciliation, voids never counted.
        status: { in: ["completed", "partially_refunded", "refunded"] },
        completedAt: { gte: todayStart },
      },
      _sum: { totalCents: true },
      _count: { _all: true },
    });
    const [openRegisters, openShifts, reviewDays, lockedDays] =
      await Promise.all([
        context.prisma.registerSession.count({
          where: { ...scope, status: { in: ["open", "closing", "suspended"] } },
        }),
        context.prisma.shift.count({
          where: { ...scope, status: { in: ["clocked_in", "on_break"] } },
        }),
        context.prisma.storeDay.count({
          where: { ...scope, status: "in_review" },
        }),
        context.prisma.storeDay.count({
          where: { ...scope, status: "locked" },
        }),
      ]);
    metrics = [
      metric("Sales today", cents(todaySales._sum.totalCents ?? 0), "Completed sales since midnight", "neutral"),
      metric("Transactions today", todaySales._count._all, "Completed sales since midnight"),
      metric(
        "Registers open",
        openRegisters,
        "Active tills",
        openRegisters ? "attention" : "neutral",
      ),
      metric("People on shift", openShifts, "Clocked in or on break"),
      metric(
        "Days to review",
        reviewDays,
        "Awaiting controlled approval",
        reviewDays ? "attention" : "neutral",
      ),
      metric("Days locked", lockedDays, "Immutable close evidence", "positive"),
    ];
    const days = await context.prisma.storeDay.findMany({
      where: scope,
      select: {
        id: true,
        tradingDate: true,
        status: true,
        netReceiptsCents: true,
        exceptionCount: true,
        generatedAt: true,
      },
      orderBy: { generatedAt: "desc" },
      take: limit,
    });
    rows = days.map((day) => ({
      id: day.id,
      title: day.tradingDate,
      detail: `${day.exceptionCount} exception${day.exceptionCount === 1 ? "" : "s"}`,
      status: day.status,
      metric: `${cents(day.netReceiptsCents)} net`,
      occurredAt: date(day.generatedAt),
    }));
  }

  if (surface === "pos") {
    const posCartSearchRecord = posCartSearch
      ? await context.prisma.cart.findFirst({
          where: {
            ...scope,
            cartNumber: { equals: posCartSearch },
            status: { in: ["open", "held"] },
          },
          select: { id: true, cartNumber: true, status: true },
        })
      : null;
    const refundHistorySale = refundHistorySearch
      ? await context.prisma.sale.findFirst({
          where: {
            ...scope,
            receiptNumber: {
              equals: refundHistorySearch,
              mode: "insensitive" as const,
            },
          },
          select: {
            id: true,
            receiptNumber: true,
            status: true,
            totalCents: true,
            completedAt: true,
          },
        })
      : null;
    const voidReceiptSaleCandidate =
      voidReceiptSearch &&
      canAccessStore(session, businessId, storeId ?? "", "canManagePayments")
        ? await context.prisma.sale.findFirst({
            where: {
              ...scope,
              receiptNumber: {
                equals: voidReceiptSearch,
                mode: "insensitive" as const,
              },
              status: "completed",
              refundedCents: 0,
              registerSession: {
                is: {
                  businessId,
                  storeId: storeId ?? "",
                  status: "open",
                },
              },
              refunds: { none: {} },
              tenders: { every: { method: "cash", status: "captured" } },
            },
            select: {
              id: true,
              receiptNumber: true,
              status: true,
              totalCents: true,
              refundedCents: true,
              startedAt: true,
              completedAt: true,
              registerSession: {
                select: {
                  id: true,
                  sessionNumber: true,
                  status: true,
                  openedAt: true,
                  expectedCashCents: true,
                  register: { select: { name: true } },
                },
              },
              tenders: {
                select: {
                  id: true,
                  method: true,
                  status: true,
                  amountCents: true,
                  processedAt: true,
                },
                orderBy: [{ processedAt: "asc" }, { id: "asc" }],
                take: 21,
              },
            },
          })
        : null;
    const voidReceiptTenders = voidReceiptSaleCandidate?.tenders ?? [];
    const voidReceiptCashTotalCents = voidReceiptTenders.reduce(
      (total, tender) => total + tender.amountCents,
      0,
    );
    const voidReceiptBaseEligible = Boolean(
      voidReceiptSaleCandidate &&
      voidReceiptSaleCandidate.status === "completed" &&
      voidReceiptSaleCandidate.refundedCents === 0 &&
      voidReceiptSaleCandidate.registerSession?.status === "open" &&
      voidReceiptTenders.length > 0 &&
      voidReceiptTenders.length <= 20 &&
      voidReceiptTenders.every(
        (tender) => tender.method === "cash" && tender.status === "captured",
      ) &&
      Number.isSafeInteger(voidReceiptCashTotalCents) &&
      voidReceiptSaleCandidate.registerSession.expectedCashCents >=
        voidReceiptCashTotalCents,
    );
    const voidReceiptFenceNow = new Date();
    const voidReceiptFenceTimes = voidReceiptSaleCandidate
      ? [
          voidReceiptSaleCandidate.completedAt ??
            voidReceiptSaleCandidate.startedAt,
          voidReceiptSaleCandidate.registerSession?.openedAt,
          ...voidReceiptTenders.map((tender) => tender.processedAt),
          voidReceiptFenceNow,
        ].filter((value): value is Date => value instanceof Date)
      : [];
    const [voidReceiptFuelCount, voidReceiptLockedDay] =
      voidReceiptBaseEligible && voidReceiptSaleCandidate
        ? await Promise.all([
            context.prisma.fuelTransaction.count({
              where: {
                saleId: voidReceiptSaleCandidate.id,
                status: "completed",
              },
            }),
            context.prisma.storeDay.findFirst({
              where: {
                ...scope,
                status: "locked",
                OR: voidReceiptFenceTimes.map((occurredAt) => ({
                  periodStartedAt: { lte: occurredAt },
                  periodEndedAt: { gt: occurredAt },
                })),
              },
              select: { id: true },
            }),
          ])
        : [0, null];
    const voidReceiptHistorySale =
      voidReceiptBaseEligible &&
      voidReceiptFuelCount === 0 &&
      !voidReceiptLockedDay
        ? voidReceiptSaleCandidate
        : null;
    const [
      registers,
      sessions,
      shifts,
      openSessionCount,
      openShiftCount,
      carts,
      cartLines,
      variants,
      providers,
      sales,
      tenders,
      saleLines,
      promotions,
      loyaltyAccounts,
      offlineDevices,
    ] = await Promise.all([
      context.prisma.register.findMany({
        where: { ...scope, status: "active" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
      context.prisma.registerSession.findMany({
        where: scope,
        include: {
          register: { select: { name: true } },
        },
        orderBy: { openedAt: "desc" },
        take: limit,
      }),
      context.prisma.shift.findMany({
        where: scope,
        select: { id: true, shiftNumber: true, status: true },
        orderBy: { startsAt: "desc" },
        take: 50,
      }),
      context.prisma.registerSession.count({
        where: { ...scope, status: { in: ["open", "closing", "suspended"] } },
      }),
      context.prisma.shift.count({
        where: { ...scope, status: { in: ["clocked_in", "on_break"] } },
      }),
      context.prisma.cart.findMany({
        where: { ...scope, status: { in: ["open", "held"] } },
        select: { id: true, cartNumber: true, status: true, totalCents: true },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      context.prisma.cartLine.findMany({
        where: { ...scope, cart: { status: { in: ["open", "held"] } } },
        select: {
          id: true,
          titleSnapshot: true,
          quantity: true,
          totalCents: true,
          cartId: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      }),
      canAccessStore(session, businessId, storeId ?? "", "canReadCatalog")
        ? context.prisma.productVariant.findMany({
            where: {
              businessId,
              status: "active",
              ...(posVariantSearch
                ? {
                    product: {
                      is: { businessId, status: "active" },
                    },
                    OR: [
                      {
                        title: {
                          contains: posVariantSearch,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        product: {
                          is: { title: { contains: posVariantSearch, mode: "insensitive" as const } },
                        },
                      },
                      {
                        sku: {
                          contains: posVariantSearch,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  }
                : {}),
            },
            select: {
              product: { select: { title: true } },
              id: true,
              title: true,
              sku: true,
              barcodes: {
                where: { status: "active" },
                select: { value: true },
                orderBy: [{ isPrimary: "desc" }, { value: "asc" }],
                take: 5,
              },
            },
            orderBy: posVariantSearch
              ? [{ title: "asc" }, { sku: "asc" }, { id: "asc" }]
              : { title: "asc" },
            take: 100,
          })
        : Promise.resolve([]),
      canAccessStore(session, businessId, storeId ?? "", "canReadPayments") &&
      canAccessStore(session, businessId, storeId ?? "", "canReadIntegrations")
        ? context.prisma.paymentProvider.findMany({
            where: { businessId, status: "active" },
            select: { id: true, name: true, code: true },
            orderBy: { name: "asc" },
            take: 50,
          })
        : Promise.resolve([]),
      context.prisma.sale.findMany({
        where: scope,
        select: {
          id: true,
          receiptNumber: true,
          status: true,
          totalCents: true,
          completedAt: true,
        },
        orderBy: { completedAt: "desc" },
        take: 50,
      }),
      canAccessStore(session, businessId, storeId ?? "", "canReadPayments")
        ? context.prisma.tender.findMany({
            where: scope,
            select: {
              id: true,
              method: true,
              amountCents: true,
              refundedCents: true,
              saleId: true,
            },
            orderBy: { processedAt: "desc" },
            take: 100,
          })
        : Promise.resolve([]),
      context.prisma.saleLine.findMany({
        where: scope,
        select: {
          id: true,
          titleSnapshot: true,
          quantity: true,
          totalCents: true,
          saleId: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      canAccessStore(session, businessId, storeId ?? "", "canReadPromotions")
        ? context.prisma.promotion.findMany({
            where: {
              businessId,
              status: "active",
              OR: [
                { stores: { none: {} } },
                ...(storeId ? [{ stores: { some: { id: storeId } } }] : []),
              ],
            },
            select: { id: true, name: true, code: true },
            orderBy: { priority: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
      canAccessStore(session, businessId, storeId ?? "", "canReadLoyalty")
        ? context.prisma.loyaltyAccount.findMany({
            where: { businessId, status: "active" },
            select: { id: true, accountNumber: true, pointsBalance: true },
            orderBy: { updatedAt: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
      canAccessStore(
        session,
        businessId,
        storeId ?? "",
        "canReadOfflineOperations",
      )
        ? context.prisma.offlineDevice.findMany({
            where: { businessId, storeId, status: "active" },
            select: { id: true, name: true, lastSequence: true },
            orderBy: { name: "asc" },
            take: 20,
          })
        : Promise.resolve([]),
    ]);
    const [refundHistoryLines, refundHistoryTenderRecords] = refundHistorySale
      ? await Promise.all([
          context.prisma.saleLine.findMany({
            where: {
              ...scope,
              saleId: refundHistorySale.id,
            },
            select: {
              id: true,
              titleSnapshot: true,
              quantity: true,
              totalCents: true,
              saleId: true,
            },
            orderBy: [{ lineNumber: "asc" }, { id: "asc" }],
            take: 251,
          }),
          canAccessStore(session, businessId, storeId ?? "", "canReadPayments")
            ? context.prisma.tender.findMany({
                where: {
                  ...scope,
                  saleId: refundHistorySale.id,
                },
                select: {
                  id: true,
                  method: true,
                  amountCents: true,
                  refundedCents: true,
                  saleId: true,
                },
                orderBy: [{ processedAt: "asc" }, { id: "asc" }],
                take: 51,
              })
            : Promise.resolve([]),
        ])
      : [[], []];
    // Match receipt evidence bounds and fail closed instead of exposing partial
    // line/tender choices for an older sale.
    if (refundHistoryLines.length > 250) {
      throw new Error(
        "Refund selector sale exceeds the bounded 250-line evidence limit",
      );
    }
    if (refundHistoryTenderRecords.length > 50) {
      throw new Error(
        "Refund selector sale exceeds the bounded 50-tender evidence limit",
      );
    }
    const receiptLookupSales = receiptSearch
      ? await context.prisma.sale.findMany({
          where: {
            ...scope,
            receiptNumber: {
              contains: receiptSearch,
              mode: "insensitive" as const,
            },
          },
          select: { id: true, receiptNumber: true, status: true },
          orderBy: [{ completedAt: "desc" }, { id: "desc" }],
          take: 100,
        })
      : sales;
    const refundSales = refundHistorySearch
      ? refundHistorySale
        ? [refundHistorySale]
        : []
      : sales;
    const refundSaleLines = refundHistorySearch
      ? refundHistoryLines
      : saleLines;
    const refundTenders = refundHistorySearch
      ? refundHistoryTenderRecords
      : tenders;
    const tenderRecordsForRefundTotals = Array.from(
      new Map(
        [...tenders, ...refundHistoryTenderRecords].map(
          (entry) => [entry.id, entry] as const,
        ),
      ).values(),
    );
    const tenderRefundTotals = tenderRecordsForRefundTotals.length
      ? await context.prisma.refundTenderAllocation.groupBy({
          by: ["tenderId"],
          where: {
            businessId,
            storeId: storeId ?? "",
            tenderId: {
              in: tenderRecordsForRefundTotals.map((entry) => entry.id),
            },
            status: "completed",
            refund: { status: "completed" },
          },
          _sum: { amountCents: true },
        })
      : [];
    const tenderRefundedById = new Map(
      tenderRefundTotals.map((entry) => [
        entry.tenderId,
        entry._sum.amountCents ?? 0,
      ]),
    );
    controls.registers = registers.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.code,
    }));
    controls.registerSessions = sessions
      .filter((entry) => entry.status === "open")
      .map((entry) => ({
        id: entry.id,
        label: entry.register?.name ?? "Till",
        detail: shortRef(entry.sessionNumber),
      }));
    controls.shifts = shifts
      .filter((entry) => ["clocked_in", "on_break"].includes(entry.status))
      .map((entry) => ({
        id: entry.id,
        label: shortRef(entry.shiftNumber),
        detail: humanStatus(entry.status),
      }));
    controls.carts = carts.map((entry) => ({
      id: entry.id,
      label: shortRef(entry.cartNumber),
      detail: `${cents(entry.totalCents)} · ${humanStatus(entry.status)}`,
    }));
    controls.posCartLookup = posCartSearchRecord
      ? [
          {
            id: posCartSearchRecord.id,
            label: posCartSearchRecord.cartNumber,
            detail: posCartSearchRecord.status,
          },
        ]
      : [];
    controls.cartLines = cartLines.map((entry) => ({
      id: entry.id,
      label: entry.titleSnapshot,
      detail: `Qty ${quantityText(entry.quantity)} · ${cents(entry.totalCents)}`,
    }));
    controls.productVariants = variants.map((entry) => ({
      id: entry.id,
      label: variantLabel(entry),
      detail: [entry.sku, ...entry.barcodes.map((barcode) => barcode.value)]
        .filter(Boolean)
        .join(" · "),
    }));
    controls.paymentProviders = providers.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.code,
    }));
    controls.sales = sales.map((entry) => ({
      id: entry.id,
      label: entry.receiptNumber,
      detail: `${cents(entry.totalCents)} · ${entry.status}`,
    }));
    controls.posVoidHistorySales = voidReceiptHistorySale
      ? [
          {
            id: voidReceiptHistorySale.id,
            label: voidReceiptHistorySale.receiptNumber,
            detail: "Completed · cash · original register open",
          },
        ]
      : [];
    controls.posVoidRegisterSessions = voidReceiptHistorySale?.registerSession
      ? [
          {
            id: voidReceiptHistorySale.registerSession.id,
            label: voidReceiptHistorySale.registerSession.sessionNumber,
            detail:
              voidReceiptHistorySale.registerSession.register?.name ??
              "Open register",
          },
        ]
      : [];
    controls.refundSales = refundSales.map((entry) => ({
      id: entry.id,
      label: entry.receiptNumber,
      detail: `${cents(entry.totalCents)} · ${entry.status}`,
    }));
    controls.receiptLookupSales = receiptLookupSales.map((entry) => ({
      id: entry.id,
      label: entry.receiptNumber,
      detail: entry.status,
    }));
    controls.refundSaleLines = refundSaleLines.map((entry) => ({
      id: entry.id,
      label: entry.titleSnapshot,
      detail: `Qty ${quantityText(entry.quantity)} · ${cents(entry.totalCents)}`,
    }));
    controls.tenders = tenders
      .map((entry) => {
        const refundedCents = effectiveTenderRefundedCents(
          entry.amountCents,
          entry.refundedCents,
          tenderRefundedById.get(entry.id) ?? 0,
        );
        return {
          id: entry.id,
          availableCents: entry.amountCents - refundedCents,
          method: entry.method,
          saleId: entry.saleId,
        };
      })
      .filter((entry) => entry.availableCents > 0)
      .map((entry) => ({
        id: entry.id,
        label: `${humanStatus(entry.method)} · ${cents(entry.availableCents)} available`,
        detail: "",
      }));
    controls.refundTenders = refundTenders
      .map((entry) => {
        const refundedCents = effectiveTenderRefundedCents(
          entry.amountCents,
          entry.refundedCents,
          tenderRefundedById.get(entry.id) ?? 0,
        );
        return {
          id: entry.id,
          availableCents: entry.amountCents - refundedCents,
          method: entry.method,
          saleId: entry.saleId,
        };
      })
      .filter((entry) => entry.availableCents > 0)
      .map((entry) => ({
        id: entry.id,
        label: `${humanStatus(entry.method)} · ${cents(entry.availableCents)} available`,
        detail: "",
      }));
    controls.saleLines = saleLines.map((entry) => ({
      id: entry.id,
      label: entry.titleSnapshot,
      detail: `Qty ${quantityText(entry.quantity)} · ${cents(entry.totalCents)}`,
    }));
    controls.promotions = promotions.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.code,
    }));
    controls.loyaltyAccounts = loyaltyAccounts.map((entry) => ({
      id: entry.id,
      label: entry.accountNumber,
      detail: `${entry.pointsBalance ?? 0} points`,
    }));
    controls.offlineDevices = offlineDevices.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: String(entry.lastSequence),
    }));
    metrics = [
      metric(
        "Open registers",
        openSessionCount,
        "Cash is live",
        openSessionCount ? "positive" : "neutral",
      ),
      metric("Open shifts", openShiftCount, "Employees clocked in"),
      metric(
        "Open carts",
        carts.length,
        "Ready for scan, promotion, or checkout",
      ),
      metric("Recent sales", sales.length, "Available for controlled refund"),
    ];
    rows = sales.map((entry) => ({
      id: entry.id,
      title: entry.receiptNumber,
      detail: "Immutable sale receipt",
      status: entry.status,
      metric: `${cents(entry.totalCents)}`,
      occurredAt: date(entry.completedAt),
    }));
  }

  if (surface === "fuel") {
    const [
      sites,
      grades,
      tanks,
      readings,
      reconciliations,
      pumps,
      nozzles,
      vendors,
      registerSessions,
      paymentProviders,
      completedSales,
      capturedTenders,
      linkedFuelTenders,
    ] = await Promise.all([
      context.prisma.fuelSite.findMany({
        where: { ...scope, enabled: true },
        select: { id: true, name: true, status: true },
        take: 50,
      }),
      context.prisma.fuelGrade.findMany({
        where: { ...scope, status: "active" },
        select: { id: true, name: true, siteId: true },
        take: 50,
      }),
      context.prisma.fuelTank.findMany({
        where: scope,
        select: {
          id: true,
          tankNumber: true,
          status: true,
          currentVolumeGallons: true,
          capacityGallons: true,
          siteId: true,
        },
        orderBy: { tankNumber: "asc" },
        take: 50,
      }),
      context.prisma.fuelTankReading.findMany({
        where: scope,
        select: {
          id: true,
          readingNumber: true,
          tankId: true,
          source: true,
          volumeGallons: true,
          measuredAt: true,
        },
        orderBy: { measuredAt: "desc" },
        take: limit,
      }),
      context.prisma.fuelReconciliation.findMany({
        where: scope,
        select: {
          id: true,
          reconciliationNumber: true,
          status: true,
          varianceGallons: true,
          periodEndedAt: true,
        },
        orderBy: { generatedAt: "desc" },
        take: limit,
      }),
      context.prisma.fuelPump.findMany({
        where: scope,
        select: { id: true, pumpNumber: true, status: true },
        orderBy: { pumpNumber: "asc" },
        take: 50,
      }),
      context.prisma.fuelNozzle.findMany({
        where: scope,
        select: { id: true, nozzleNumber: true, status: true, pumpId: true },
        orderBy: { nozzleNumber: "asc" },
        take: 100,
      }),
      context.prisma.vendor.findMany({
        where: { businessId, status: "active" },
        select: { id: true, name: true, vendorNumber: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
      context.prisma.registerSession.findMany({
        where: { ...scope, status: "open" },
        select: { id: true, sessionNumber: true, expectedCashCents: true },
        orderBy: { openedAt: "desc" },
        take: 50,
      }),
      context.prisma.paymentProvider.findMany({
        where: { businessId, status: "active" },
        select: { id: true, name: true, adapterKey: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
      context.prisma.sale.findMany({
        where: { ...scope, status: "completed" },
        select: {
          id: true,
          receiptNumber: true,
          totalCents: true,
          metadata: true,
        },
        orderBy: { completedAt: "desc" },
        take: 100,
      }),
      context.prisma.tender.findMany({
        where: {
          ...scope,
          status: "captured",
          refundedCents: 0,
          sale: {
            status: "completed",
            metadata: {
              path: ["purpose"],
              equals: "fuel_authorization",
            },
          },
        },
        select: { id: true, saleId: true, method: true, amountCents: true },
        orderBy: { processedAt: "desc" },
        take: 200,
      }),
      context.prisma.fuelTransaction.findMany({
        where: { ...scope, tenderId: { not: null } },
        select: { tenderId: true },
        orderBy: { completedAt: "desc" },
        take: 1_000,
      }),
    ]);
    // Price board: what each grade and tier sells at now, and what is scheduled next.
    const priceBoard = await context.prisma.fuelPrice.findMany({
      where: { ...scope, status: { in: ["active", "scheduled"] } },
      select: {
        id: true,
        priceTier: true,
        priceMillsPerGallon: true,
        status: true,
        startsAt: true,
        grade: { select: { name: true } },
      },
      orderBy: [{ startsAt: "desc" }],
      take: 50,
    });
    controls.fuelPriceBoard = priceBoard.map((entry) => ({
      id: entry.id,
      label: `${entry.grade?.name ?? "Grade"} · ${humanStatus(entry.priceTier)}`,
      detail: [
        `$${(entry.priceMillsPerGallon / 1000).toFixed(3)}/gal`,
        entry.status === "active" ? "Current" : "Scheduled",
        entry.startsAt.toISOString(),
      ].join("|"),
    }));
    controls.fuelSites = sites.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.status,
    }));
    controls.fuelGrades = grades.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: "",
    }));
    controls.fuelTanks = tanks.map((entry) => ({
      id: entry.id,
      label: `Tank ${entry.tankNumber}`,
      detail: entry.status,
    }));
    controls.fuelReadings = readings.map((entry) => ({
      id: entry.id,
      label: entry.readingNumber,
      detail: `${entry.volumeGallons} gal`,
    }));
    controls.fuelReconciliations = reconciliations
      .filter((entry) => ["in_review", "approved"].includes(entry.status))
      .map((entry) => ({
        id: entry.id,
        label: entry.reconciliationNumber,
        detail: entry.status,
      }));
    controls.fuelPumps = pumps.map((entry) => ({
      id: entry.id,
      label: `Pump ${entry.pumpNumber}`,
      detail: entry.status,
    }));
    controls.fuelNozzles = nozzles.map((entry) => ({
      id: entry.id,
      label: `Nozzle ${entry.nozzleNumber}`,
      detail: humanStatus(entry.status),
    }));
    controls.vendors = vendors.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.vendorNumber,
    }));
    controls.registerSessions = registerSessions.map((entry) => ({
      id: entry.id,
      label: shortRef(entry.sessionNumber),
      detail: `${cents(entry.expectedCashCents)} expected`,
    }));
    controls.paymentProviders = paymentProviders.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.adapterKey,
    }));
    const usedTenderIds = new Set(
      linkedFuelTenders
        .map((entry) => entry.tenderId)
        .filter((id): id is string => Boolean(id)),
    );
    const availableTenders = capturedTenders.filter(
      (entry) => !usedTenderIds.has(entry.id),
    );
    const saleIdsWithTender = new Set(
      availableTenders
        .map((entry) => entry.saleId)
        .filter((id): id is string => Boolean(id)),
    );
    controls.fuelSales = completedSales
      .filter((entry) => {
        const metadata =
          entry.metadata &&
          typeof entry.metadata === "object" &&
          !Array.isArray(entry.metadata)
            ? (entry.metadata as Record<string, unknown>)
            : {};
        return (
          saleIdsWithTender.has(entry.id) &&
          metadata.purpose === "fuel_authorization"
        );
      })
      .map((entry) => ({
        id: entry.id,
        label: entry.receiptNumber,
        detail: `${cents(entry.totalCents)}`,
      }));
    controls.fuelTenders = availableTenders.map((entry) => ({
      id: entry.id,
      label: `${humanStatus(entry.method)} · ${cents(entry.amountCents)}`,
      detail: "",
    }));
    metrics = [
      metric("Fuel sites", sites.length, "Enabled controller boundaries"),
      metric(
        "Tanks",
        tanks.length,
        `${tanks.filter((tank) => tank.status === "low").length} low`,
        tanks.some((tank) => tank.status === "low") ? "attention" : "neutral",
      ),
      metric("Readings", readings.length, `Latest ${limit} immutable readings`),
      metric(
        "In review",
        reconciliations.filter((entry) => entry.status === "in_review").length,
        "Wet-stock reconciliations",
      ),
    ];
    rows = reconciliations.map((entry) => ({
      id: entry.id,
      title: entry.reconciliationNumber,
      detail: "Fuel reconciliation",
      status: entry.status,
      metric: `${entry.varianceGallons} gal variance`,
      occurredAt: date(entry.periodEndedAt),
    }));
  }

  if (surface === "inventory") {
    const inventoryTransferHistoryRecord = inventoryTransferSearch
      ? await context.prisma.inventoryTransfer.findFirst({
          where: {
            businessId,
            ...(storeId
              ? {
                  OR: [
                    { sourceStoreId: storeId },
                    { destinationStoreId: storeId },
                  ],
                }
              : {}),
            transferNumber: {
              equals: inventoryTransferSearch,
              mode: "insensitive" as const,
            },
          },
          select: {
            id: true,
            transferNumber: true,
            status: true,
          },
        })
      : null;
    const inventoryCountHistoryRecord = inventoryCountSearch
      ? await context.prisma.inventoryCount.findFirst({
          where: {
            ...scope,
            countNumber: {
              equals: inventoryCountSearch,
              mode: "insensitive" as const,
            },
            status: { in: ["draft", "counting", "submitted"] },
          },
          select: { id: true, countNumber: true, status: true },
        })
      : null;
    const [
      locations,
      variants,
      counts,
      stock,
      lots,
      countLines,
      searchedCountLines,
      transfers,
    ] = await Promise.all([
        context.prisma.inventoryLocation.findMany({
          where: {
            businessId,
            storeId: { in: stores.map((entry) => entry.id) },
            status: "active",
            ...(inventoryLocationSearch
              ? {
                  OR: [
                    {
                      code: {
                        equals: inventoryLocationSearch,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      name: {
                        startsWith: inventoryLocationSearch,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      code: {
                        startsWith: inventoryLocationSearch,
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                }
              : {}),
          },
          include: { store: { select: { name: true } } },
          orderBy: inventoryLocationSearch
            ? [{ name: "asc" }, { code: "asc" }, { id: "asc" }]
            : { name: "asc" },
          take: inventoryLocationSearch ? 100 : 200,
        }),
        // Variants are business-owned; store access was authorized above and
        // stock mutations revalidate the selected store/location independently.
        context.prisma.productVariant.findMany({
          where: {
            businessId,
            status: "active",
            trackInventory: true,
            ...(inventoryVariantSearch
              ? {
                  OR: [
                    {
                      title: {
                        contains: inventoryVariantSearch,
                        mode: "insensitive" as const,
                      },
                    },
                    {
                      product: {
                        is: { title: { contains: inventoryVariantSearch, mode: "insensitive" as const } },
                      },
                    },
                    {
                      sku: {
                        contains: inventoryVariantSearch,
                        mode: "insensitive" as const,
                      },
                    },
                  ],
                }
              : {}),
          },
          select: { id: true, title: true, sku: true, product: { select: { title: true } } },
          orderBy: inventoryVariantSearch
            ? [{ title: "asc" }, { sku: "asc" }, { id: "asc" }]
            : { title: "asc" },
          take: inventoryVariantSearch ? 100 : 50,
        }),
        context.prisma.inventoryCount.findMany({
          where: scope,
          select: {
            id: true,
            countNumber: true,
            status: true,
            type: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        }),
        context.prisma.stockLevel.findMany({
          where: scope,
          include: { variant: { select: { title: true, sku: true } } },
          orderBy: { updatedAt: "desc" },
          take: limit,
        }),
        context.prisma.inventoryLot.findMany({
          where: { ...scope, status: "active" },
          select: {
            id: true,
            lotNumber: true,
            quantityRemaining: true,
            expiresAt: true,
          },
          orderBy: { expiresAt: "asc" },
          take: limit,
        }),
        context.prisma.inventoryCountLine.findMany({
          where: { ...scope, count: { status: "counting" } },
          include: {
            variant: { select: { title: true, sku: true } },
            count: { select: { countNumber: true } },
          },
          orderBy: { updatedAt: "asc" },
          take: 1_000,
        }),
        inventoryCountSearch &&
        inventoryCountHistoryRecord?.status === "counting"
          ? context.prisma.inventoryCountLine.findMany({
              where: {
                ...scope,
                countId: inventoryCountHistoryRecord.id,
                count: { status: "counting" },
              },
              select: {
                id: true,
                expectedQuantity: true,
                variant: { select: { title: true } },
                count: { select: { countNumber: true } },
              },
              orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
              take: 1_001,
            })
          : Promise.resolve([]),
        context.prisma.inventoryTransfer.findMany({
          where: {
            businessId,
            ...(storeId
              ? {
                  OR: [
                    { sourceStoreId: storeId },
                    { destinationStoreId: storeId },
                  ],
                }
              : {}),
          },
          select: {
            id: true,
            transferNumber: true,
            status: true,
            sourceStoreId: true,
            destinationStoreId: true,
            requestedAt: true,
          },
          orderBy: { requestedAt: "desc" },
          take: limit,
        }),
      ]);
    controls.inventoryLocations = locations.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: `${entry.store?.name ?? "Store"} · ${entry.code}`,
    }));
    controls.productVariants = variants.map((entry) => ({
      id: entry.id,
      label: variantLabel(entry),
      detail: entry.sku,
    }));
    const actionableCounts = counts.filter((entry) =>
      ["draft", "counting", "submitted"].includes(entry.status),
    );
    const inventoryCountHistory = inventoryCountSearch
      ? inventoryCountHistoryRecord
        ? [inventoryCountHistoryRecord]
        : []
      : actionableCounts;
    controls.inventoryCounts = actionableCounts.map((entry) => ({
      id: entry.id,
      label: entry.countNumber,
      detail: entry.status,
    }));
    controls.inventoryCountHistory = inventoryCountHistory.map((entry) => ({
      id: entry.id,
      label: entry.countNumber,
      detail: entry.status,
    }));
    controls.inventoryCountLines = countLines.map((entry) => ({
      id: entry.id,
      label: entry.variant?.title ?? entry.id,
      detail: `${entry.count?.countNumber ?? "Count"} · expected ${entry.expectedQuantity}`,
    }));
    const countLineLookupState = !inventoryCountSearch
      ? null
      : !inventoryCountHistoryRecord
        ? "not_found"
        : inventoryCountHistoryRecord.status !== "counting"
          ? "not_counting"
          : searchedCountLines.length > 1_000
            ? "unavailable"
            : searchedCountLines.length === 0
              ? "empty"
              : "loaded";
    controls.inventoryCountLineLookup =
      countLineLookupState === "loaded"
        ? searchedCountLines.map((entry) => ({
            id: entry.id,
            label: entry.variant?.title ?? entry.id,
            detail: `${entry.count?.countNumber ?? "Count"} · expected ${entry.expectedQuantity}`,
          }))
        : [];
    controls.inventoryCountLineHydrationStatus = countLineLookupState
      ? [
          {
            id: countLineLookupState,
            label: countLineLookupState,
            ...(countLineLookupState === "loaded"
              ? { detail: String(searchedCountLines.length) }
              : {}),
          },
        ]
      : [];
    const actionableTransfers = transfers.filter(
      (entry) => !["received", "cancelled"].includes(entry.status),
    );
    const inventoryTransferHistory = inventoryTransferSearch
      ? inventoryTransferHistoryRecord &&
        !["received", "cancelled"].includes(
          inventoryTransferHistoryRecord.status,
        )
        ? [inventoryTransferHistoryRecord]
        : []
      : actionableTransfers;
    controls.inventoryTransfers = actionableTransfers.map((entry) => ({
      id: entry.id,
      label: entry.transferNumber,
      detail: entry.status,
    }));
    controls.inventoryTransferHistory = inventoryTransferHistory.map(
      (entry) => ({
        id: entry.id,
        label: entry.transferNumber,
        detail: entry.status,
      }),
    );
    metrics = [
      metric("Stock positions", stock.length, `Latest ${limit} positions`),
      metric("Active lots", lots.length, "Expiry-tracked evidence"),
      metric(
        "Counts open",
        counts.filter(
          (entry) => !["approved", "cancelled"].includes(entry.status),
        ).length,
        "Cycle and full counts",
      ),
      metric(
        "Transfers open",
        transfers.filter(
          (entry) => !["received", "cancelled"].includes(entry.status),
        ).length,
        "Inter-store custody",
      ),
      metric(
        "Expiring",
        lots.filter(
          (entry) =>
            entry.expiresAt &&
            entry.expiresAt.getTime() < Date.now() + 7 * 86400000,
        ).length,
        "Within seven days",
        "attention",
      ),
    ];
    rows = stock.map((entry) => ({
      id: entry.id,
      title: entry.variant?.title ?? "Inventory item",
      detail: entry.variant?.sku ?? "",
      status:
        Number(entry.onHandQuantity) <= Number(entry.reorderPoint)
          ? "reorder"
          : "in_stock",
      metric: `${entry.onHandQuantity} on hand`,
      occurredAt: date(entry.updatedAt),
    }));
  }

  if (surface === "purchasing") {
    const purchaseOrderHistoryRecord = purchaseOrderSearch
      ? await context.prisma.purchaseOrder.findFirst({
          where: {
            ...scope,
            poNumber: {
              equals: purchaseOrderSearch,
              mode: "insensitive" as const,
            },
          },
          select: { id: true, poNumber: true, status: true },
        })
      : null;
    const [
      vendors,
      orders,
      receipts,
      variants,
      vendorItems,
      purchaseOrderLines,
      locations,
    ] = await Promise.all([
      context.prisma.vendor.findMany({
        where: {
          businessId,
          status: "active",
          ...(vendorSearch
            ? {
                OR: [
                  {
                    name: {
                      contains: vendorSearch,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    vendorNumber: {
                      contains: vendorSearch,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
        },
        select: { id: true, name: true, vendorNumber: true },
        orderBy: vendorSearch
          ? [{ name: "asc" }, { vendorNumber: "asc" }, { id: "asc" }]
          : { name: "asc" },
        take: vendorSearch ? 100 : 50,
      }),
      context.prisma.purchaseOrder.findMany({
        where: scope,
        include: { vendor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      context.prisma.receiving.findMany({
        where: scope,
        select: {
          id: true,
          receivingNumber: true,
          status: true,
          vendorDocumentNumber: true,
          receivedAt: true,
        },
        orderBy: { receivedAt: "desc" },
        take: limit,
      }),
      // Variants are business-owned; selected-store permission was enforced
      // above, and each purchasing mutation validates the chosen id again.
      context.prisma.productVariant.findMany({
        where: {
          businessId,
          status: "active",
          ...(variantSearch
            ? {
                OR: [
                  {
                    title: {
                      contains: variantSearch,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    product: {
                      is: { title: { contains: variantSearch, mode: "insensitive" as const } },
                    },
                  },
                  {
                    sku: {
                      contains: variantSearch,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
        },
        select: { id: true, title: true, sku: true, product: { select: { title: true } } },
        orderBy: [{ title: "asc" }, { sku: "asc" }, { id: "asc" }],
        take: 100,
      }),
      // Vendor items are business-owned; selected-store access was enforced
      // above, and PO creation revalidates vendor, variant, and item identity.
      context.prisma.vendorItem.findMany({
        where: {
          businessId,
          status: "active",
          ...(vendorItemSearch
            ? {
                vendorSku: {
                  contains: vendorItemSearch,
                  mode: "insensitive" as const,
                },
              }
            : {}),
        },
        select: {
          id: true,
          vendorSku: true,
          unitCostCents: true,
          vendorId: true,
          variantId: true,
        },
        orderBy: [{ vendorSku: "asc" }, { id: "asc" }],
        take: 100,
      }),
      context.prisma.purchaseOrderLine.findMany({
        where: {
          ...scope,
          purchaseOrder: { status: { in: ["approved", "partially_received"] } },
          ...(purchaseOrderLineSearch
            ? {
                OR: [
                  {
                    descriptionSnapshot: {
                      contains: purchaseOrderLineSearch,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    vendorSkuSnapshot: {
                      contains: purchaseOrderLineSearch,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
        },
        select: {
          id: true,
          descriptionSnapshot: true,
          quantityOrdered: true,
          quantityReceived: true,
          purchaseOrderId: true,
          purchaseOrder: {
            select: { id: true, poNumber: true, status: true },
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: purchaseOrderLineSearch ? 100 : 500,
      }),
      context.prisma.inventoryLocation.findMany({
        where: { ...scope, status: "active" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
    ]);
    controls.vendors = vendors.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.vendorNumber,
    }));
    const purchaseOrderOptions = new Map(
      orders.map(
        (entry) =>
          [
            entry.id,
            { id: entry.id, poNumber: entry.poNumber, status: entry.status },
          ] as const,
      ),
    );
    if (purchaseOrderLineSearch) {
      for (const line of purchaseOrderLines) {
        if (line.purchaseOrder) {
          purchaseOrderOptions.set(line.purchaseOrder.id, {
            id: line.purchaseOrder.id,
            poNumber: line.purchaseOrder.poNumber,
            status: line.purchaseOrder.status,
          });
        }
      }
    }
    const purchaseOrderTransitionRecords = purchaseOrderSearch
      ? purchaseOrderHistoryRecord
        ? [purchaseOrderHistoryRecord]
        : []
      : Array.from(purchaseOrderOptions.values());
    controls.purchaseOrderTransitionOptions =
      purchaseOrderTransitionRecords.map((entry) => ({
        id: entry.id,
        label: entry.poNumber,
        detail: entry.status,
      }));
    controls.purchaseOrders = Array.from(purchaseOrderOptions.values()).map(
      (entry) => ({
        id: entry.id,
        label: entry.poNumber,
        detail: entry.status,
      }),
    );
    controls.productVariants = variants.map((entry) => ({
      id: entry.id,
      label: variantLabel(entry),
      detail: entry.sku,
    }));
    controls.vendorItems = vendorItems.map((entry) => ({
      id: entry.id,
      label: entry.vendorSku,
      detail: cents(entry.unitCostCents),
    }));
    controls.purchaseOrderLines = purchaseOrderLines.map((entry) => ({
      id: entry.id,
      label: entry.descriptionSnapshot,
      detail: `${entry.quantityReceived}/${entry.quantityOrdered} received · ${entry.purchaseOrder?.poNumber ?? entry.purchaseOrderId ?? ""}`,
    }));
    controls.inventoryLocations = locations.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.code,
    }));
    metrics = [
      metric(
        vendorSearch ? "Matching vendors" : "Active vendors",
        vendors.length,
        vendorSearch
          ? "Search results · max 100"
          : "Approved supply relationships",
      ),
      metric(
        "Orders open",
        orders.filter(
          (entry) =>
            !["received", "cancelled", "closed"].includes(entry.status),
        ).length,
        "Awaiting lifecycle completion",
      ),
      metric("Receipts", receipts.length, `Latest ${limit} immutable postings`),
    ];
    rows = orders.map((entry) => ({
      id: entry.id,
      title: entry.poNumber,
      detail: entry.vendor?.name ?? "No vendor",
      status: entry.status,
      metric: `${cents(entry.totalCents)}`,
      occurredAt: date(entry.orderedAt ?? entry.createdAt),
    }));
  }

  if (surface === "pricing") {
    const [
      books,
      entries,
      promotions,
      variants,
      taxCategories,
      productCategories,
      products,
    ] = await Promise.all([
      context.prisma.priceBook.findMany({
        where: {
          businessId,
          ...(storeId ? { stores: { some: { id: storeId } } } : {}),
        },
        select: { id: true, name: true, status: true },
        orderBy: { priority: "desc" },
        take: 50,
      }),
      context.prisma.priceBookEntry.findMany({
        where: {
          businessId,
          ...(storeId
            ? { priceBook: { stores: { some: { id: storeId } } } }
            : {}),
        },
        include: {
          variant: { select: { title: true, sku: true } },
          priceBook: { select: { name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
      context.prisma.promotion.findMany({
        where: {
          businessId,
          ...(storeId ? { stores: { some: { id: storeId } } } : {}),
        },
        select: {
          id: true,
          name: true,
          code: true,
          status: true,
          startsAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
      context.prisma.productVariant.findMany({
        where: { businessId, status: "active" },
        select: { id: true, title: true, sku: true, product: { select: { title: true } } },
        orderBy: { title: "asc" },
        take: 100,
      }),
      context.prisma.taxCategory.findMany({
        where: { businessId },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
      context.prisma.productCategory.findMany({
        where: { businessId, status: "active" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
      context.prisma.product.findMany({
        where: { businessId, status: "active" },
        select: { id: true, title: true, handle: true },
        orderBy: { title: "asc" },
        take: 100,
      }),
    ]);
    metrics = [
      metric("Price books", books.length, "Business price boundaries"),
      metric("Price entries", entries.length, `Latest ${limit}`),
      metric(
        "Promotions active",
        promotions.filter((entry) => entry.status === "active").length,
        "Currently eligible",
      ),
    ];
    rows = entries.map((entry) => ({
      id: entry.id,
      title: entry.variant?.title ?? "Price entry",
      detail: `${entry.priceBook?.name ?? "Price book"} · ${entry.variant?.sku ?? ""}`,
      status: entry.status,
      metric: `${cents(entry.amountCents)}`,
      occurredAt: date(entry.updatedAt),
    }));
    controls.promotions = promotions
      .filter((entry) => entry.status === "active")
      .map((entry) => ({
        id: entry.id,
        label: entry.name,
        detail: entry.code,
      }));
    controls.priceBooks = books
      .filter((entry) => entry.status === "active")
      .map((entry) => ({
        id: entry.id,
        label: entry.name,
        detail: entry.status,
      }));
    controls.productVariants = variants.map((entry) => ({
      id: entry.id,
      label: variantLabel(entry),
      detail: entry.sku,
    }));
    controls.taxCategories = taxCategories.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.code,
    }));
    controls.productCategories = productCategories.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.code,
    }));
    controls.products = products.map((entry) => ({
      id: entry.id,
      label: entry.title,
      detail: entry.handle,
    }));
  }

  if (surface === "compliance") {
    const [
      policies,
      carts,
      sales,
      verifications,
      products,
      categories,
      incidents,
    ] = await Promise.all([
      context.prisma.compliancePolicy.findMany({
        where: { businessId, status: "active", policyType: "age_restriction" },
        select: { id: true, name: true, minimumAge: true },
        take: 50,
      }),
      context.prisma.cart.findMany({
        where: { ...scope, status: { in: ["open", "held"] } },
        select: { id: true, cartNumber: true, status: true },
        take: 50,
      }),
      context.prisma.sale.findMany({
        where: scope,
        select: { id: true, receiptNumber: true, status: true },
        orderBy: { startedAt: "desc" },
        take: 50,
      }),
      context.prisma.ageVerification.findMany({
        where: scope,
        select: {
          id: true,
          verificationNumber: true,
          outcome: true,
          method: true,
          ageAtVerification: true,
          verifiedAt: true,
        },
        orderBy: { verifiedAt: "desc" },
        take: limit,
      }),
      context.prisma.product.findMany({
        where: { businessId, status: "active" },
        select: { id: true, title: true, handle: true },
        orderBy: { title: "asc" },
        take: 100,
      }),
      context.prisma.productCategory.findMany({
        where: { businessId, status: "active" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
      context.prisma.complianceIncident.findMany({
        where: scope,
        select: {
          id: true,
          incidentNumber: true,
          incidentType: true,
          severity: true,
          status: true,
          description: true,
          reportedAt: true,
        },
        orderBy: { reportedAt: "desc" },
        take: limit,
      }),
    ]);
    controls.compliancePolicies = policies.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.minimumAge ? `Age ${entry.minimumAge}+` : "Age policy",
    }));
    controls.carts = carts.map((entry) => ({
      id: entry.id,
      label: entry.cartNumber,
      detail: entry.status,
    }));
    controls.sales = sales.map((entry) => ({
      id: entry.id,
      label: entry.receiptNumber,
      detail: entry.status,
    }));
    controls.products = products.map((entry) => ({
      id: entry.id,
      label: entry.title,
      detail: entry.handle,
    }));
    controls.productCategories = categories.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.code,
    }));
    controls.complianceIncidents = incidents
      .filter((entry) => !["closed"].includes(entry.status))
      .map((entry) => ({
        id: entry.id,
        label: entry.incidentNumber,
        detail: `${entry.severity} · ${entry.status}`,
      }));
    metrics = [
      metric("Policies active", policies.length, "Age-restriction controls"),
      metric("Evidence records", verifications.length, `Latest ${limit}`),
      metric(
        "Not passed",
        verifications.filter((entry) => entry.outcome !== "passed").length,
        "Declines, failures, overrides",
        "attention",
      ),
      metric(
        "Incidents open",
        incidents.filter((entry) => entry.status !== "closed").length,
        "Controlled disposition required",
        incidents.some((entry) => entry.status === "open")
          ? "attention"
          : "neutral",
      ),
    ];
    rows = [
      ...incidents.map((entry) => ({
        id: entry.id,
        title: entry.incidentNumber,
        detail: entry.description,
        status: `${entry.severity} · ${entry.status}`,
        metric: entry.incidentType.replaceAll("_", " "),
        occurredAt: date(entry.reportedAt),
      })),
      ...verifications.map((entry) => ({
        id: entry.id,
        title: entry.verificationNumber,
        detail: `${entry.method} · age ${entry.ageAtVerification}`,
        status: entry.outcome,
        metric: "Verification evidence",
        occurredAt: date(entry.verifiedAt),
      })),
    ]
      .sort((left, right) =>
        (right.occurredAt ?? "").localeCompare(left.occurredAt ?? ""),
      )
      .slice(0, limit);
  }

  if (surface === "foodservice") {
    const [
      locations,
      variants,
      recipes,
      batches,
      waste,
      recipeSearchRecords,
      variantSearchRecords,
      locationSearchRecords,
      openBatchSearchRecords,
      prepBatchSearchRecords,
      employeeSearchRecords,
    ] = await Promise.all([
      context.prisma.inventoryLocation.findMany({
        where: { ...scope, status: "active" },
        select: { id: true, name: true, code: true },
        take: 50,
      }),
      context.prisma.productVariant.findMany({
        where: { businessId, status: "active", trackInventory: true },
        select: {
          product: { select: { title: true } },
          id: true,
          title: true,
          sku: true,
          unitOfMeasure: true,
        },
        orderBy: { title: "asc" },
        take: 50,
      }),
      context.prisma.recipe.findMany({
        where: { businessId, status: "active", active: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
      context.prisma.prepBatch.findMany({
        where: scope,
        select: {
          id: true,
          batchNumber: true,
          status: true,
          quantityPlanned: true,
          quantityMade: true,
          expiresAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      context.prisma.wasteEvent.findMany({
        where: scope,
        select: {
          id: true,
          eventNumber: true,
          reason: true,
          quantity: true,
          costCents: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: "desc" },
        take: limit,
      }),
      recipeCodeSearch &&
      canAccessStore(session, businessId, storeId ?? "", "canReadPreparedFood")
        ? context.prisma.recipe.findMany({
            where: {
              businessId,
              status: "active",
              active: true,
              code: { equals: recipeCodeSearch },
            },
            select: { id: true, name: true, code: true },
            orderBy: { id: "asc" },
            take: 2,
          })
        : Promise.resolve([]),
      foodserviceSkuSearch &&
      canAccessStore(session, businessId, storeId ?? "", "canReadCatalog")
        ? context.prisma.productVariant.findMany({
            where: {
              businessId,
              status: "active",
              trackInventory: true,
              sku: { equals: foodserviceSkuSearch },
            },
            select: {
              product: { select: { title: true } },
              id: true,
              title: true,
              sku: true,
              unitOfMeasure: true,
            },
            orderBy: { id: "asc" },
            take: 2,
          })
        : Promise.resolve([]),
      foodserviceLocationCodeSearch &&
      canAccessStore(session, businessId, storeId ?? "", "canReadInventory")
        ? context.prisma.inventoryLocation.findMany({
            where: {
              ...scope,
              status: "active",
              code: { equals: foodserviceLocationCodeSearch },
            },
            select: { id: true, name: true, code: true },
            orderBy: { id: "asc" },
            take: 2,
          })
        : Promise.resolve([]),
      foodserviceBatchNumberSearch &&
      canAccessStore(session, businessId, storeId ?? "", "canReadPreparedFood")
        ? context.prisma.prepBatch.findMany({
            where: {
              ...scope,
              status: { in: ["planned", "in_progress"] },
              batchNumber: { equals: foodserviceBatchNumberSearch },
            },
            select: { id: true, batchNumber: true, status: true },
            orderBy: { id: "asc" },
            take: 2,
          })
        : Promise.resolve([]),
      foodserviceBatchNumberSearch &&
      canAccessStore(session, businessId, storeId ?? "", "canReadPreparedFood")
        ? context.prisma.prepBatch.findMany({
            where: {
              ...scope,
              status: { in: ["planned", "in_progress", "completed"] },
              batchNumber: { equals: foodserviceBatchNumberSearch },
            },
            select: { id: true, batchNumber: true, status: true },
            orderBy: { id: "asc" },
            take: 2,
          })
        : Promise.resolve([]),
      foodserviceEmployeeNumberSearch &&
      storeId &&
      canAccessStore(session, businessId, storeId, "canReadPeople")
        ? context.prisma.employee.findMany({
            where: {
              businessId,
              status: "active",
              employeeNumber: { equals: foodserviceEmployeeNumberSearch },
              stores: {
                some: { id: storeId },
                ...(unrestrictedStores
                  ? {}
                  : { every: { id: { in: allowedStoreIds ?? [] } } }),
              },
            },
            select: {
              id: true,
              employeeNumber: true,
              user: { select: { name: true } },
            },
            orderBy: { id: "asc" },
            take: 2,
          })
        : Promise.resolve([]),
    ]);
    controls.inventoryLocations = locations.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.code,
    }));
    controls.foodserviceLocationLookup =
      locationSearchRecords.length === 1
        ? [
            {
              id: locationSearchRecords[0].id,
              label: locationSearchRecords[0].name,
              detail: locationSearchRecords[0].code,
            },
          ]
        : [];
    controls.employeeLookup =
      employeeSearchRecords.length === 1
        ? [
            {
              id: employeeSearchRecords[0].id,
              label:
                employeeSearchRecords[0].user?.name?.trim() ||
                employeeSearchRecords[0].employeeNumber,
              detail: employeeSearchRecords[0].employeeNumber,
            },
          ]
        : [];
    controls.productVariants = variants.map((entry) => ({
      id: entry.id,
      label: variantLabel(entry),
      detail: `${entry.sku} · unit ${entry.unitOfMeasure}`,
    }));
    controls.foodserviceVariantLookup =
      variantSearchRecords.length === 1
        ? [
            {
              id: variantSearchRecords[0].id,
              label: variantSearchRecords[0].title,
              detail: `${variantSearchRecords[0].sku} · unit ${variantSearchRecords[0].unitOfMeasure}`,
            },
          ]
        : [];
    controls.recipes = recipes.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.code,
    }));
    controls.recipeLookup =
      recipeSearchRecords.length === 1
        ? [
            {
              id: recipeSearchRecords[0].id,
              label: recipeSearchRecords[0].name,
              detail: recipeSearchRecords[0].code,
            },
          ]
        : [];
    controls.openPrepBatches = batches
      .filter((entry) => ["planned", "in_progress"].includes(entry.status))
      .map((entry) => ({
        id: entry.id,
        label: entry.batchNumber,
        detail: entry.status,
      }));
    controls.prepBatches = batches
      .filter((entry) =>
        ["planned", "in_progress", "completed"].includes(entry.status),
      )
      .map((entry) => ({
        id: entry.id,
        label: entry.batchNumber,
        detail: entry.status,
      }));
    controls.openPrepBatchLookup =
      openBatchSearchRecords.length === 1
        ? [
            {
              id: openBatchSearchRecords[0].id,
              label: openBatchSearchRecords[0].batchNumber,
              detail: openBatchSearchRecords[0].status,
            },
          ]
        : [];
    controls.prepBatchLookup =
      prepBatchSearchRecords.length === 1
        ? [
            {
              id: prepBatchSearchRecords[0].id,
              label: prepBatchSearchRecords[0].batchNumber,
              detail: prepBatchSearchRecords[0].status,
            },
          ]
        : [];
    metrics = [
      metric(
        "Batches open",
        batches.filter((entry) =>
          ["planned", "in_progress"].includes(entry.status),
        ).length,
        "Ready for production",
      ),
      metric("Waste events", waste.length, `Latest ${limit}`),
      metric(
        "Waste cost",
        waste.reduce((sum, entry) => sum + entry.costCents, 0),
        "Cents in projection",
        "attention",
      ),
    ];
    rows = batches.map((entry) => ({
      id: entry.id,
      title: entry.batchNumber,
      detail: `${entry.quantityMade} / ${entry.quantityPlanned} made`,
      status: entry.status,
      metric: entry.expiresAt
        ? `Expires ${entry.expiresAt.toISOString().slice(0, 10)}`
        : "No expiry",
      occurredAt: date(entry.createdAt),
    }));
  }

  if (surface === "loyalty") {
    const [accounts, entries, programs, accountSearchRecords] =
      await Promise.all([
        context.prisma.loyaltyAccount.findMany({
          where: { businessId, status: "active" },
          select: {
            id: true,
            accountNumber: true,
            tier: true,
            pointsBalance: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 50,
        }),
        context.prisma.loyaltyLedgerEntry.findMany({
          where: {
            businessId,
            ...(storeId ? { OR: [{ storeId }, { storeId: null }] } : {}),
          },
          include: { account: { select: { accountNumber: true } } },
          orderBy: { occurredAt: "desc" },
          take: limit,
        }),
        context.prisma.loyaltyProgram.findMany({
          where: { businessId, status: "active" },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
          take: 50,
        }),
        loyaltyAccountSearch &&
        canAccessStore(session, businessId, storeId ?? "", "canReadLoyalty")
          ? context.prisma.loyaltyAccount.findMany({
              where: {
                businessId,
                status: "active",
                accountNumber: { equals: loyaltyAccountSearch },
              },
              select: {
                id: true,
                accountNumber: true,
                tier: true,
                pointsBalance: true,
              },
              orderBy: { id: "asc" },
              take: 2,
            })
          : Promise.resolve([]),
      ]);
    controls.loyaltyAccounts = accounts.map((entry) => ({
      id: entry.id,
      label: entry.accountNumber,
      detail: `${entry.pointsBalance ?? 0} points`,
    }));
    controls.loyaltyAccountLookup =
      accountSearchRecords.length === 1
        ? [
            {
              id: accountSearchRecords[0].id,
              label: accountSearchRecords[0].accountNumber,
              detail: `${accountSearchRecords[0].tier} · ${accountSearchRecords[0].pointsBalance ?? 0} points`,
            },
          ]
        : [];
    controls.loyaltyPrograms = programs.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.code,
    }));
    metrics = [
      metric("Active accounts", accounts.length, "Bounded account selector"),
      metric("Ledger entries", entries.length, `Latest ${limit}`),
      metric(
        "Points in view",
        accounts.reduce((sum, entry) => sum + (entry.pointsBalance ?? 0), 0),
        "Across selected accounts",
      ),
    ];
    rows = entries.map((entry) => ({
      id: entry.id,
      title: entry.account?.accountNumber ?? "Loyalty entry",
      detail: entry.description,
      status: entry.type,
      metric: `${entry.pointsDelta > 0 ? "+" : ""}${entry.pointsDelta} points`,
      occurredAt: date(entry.occurredAt),
    }));
  }

  if (surface === "payments") {
    const [providers, tenders, reconciliations, webhookEvents] =
      await Promise.all([
        context.prisma.paymentProvider.findMany({
          where: { businessId },
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            adapterKey: true,
          },
          orderBy: { name: "asc" },
          take: 100,
        }),
        context.prisma.tender.findMany({
          where: { ...scope, method: { not: "cash" } },
          select: {
            id: true,
            method: true,
            status: true,
            amountCents: true,
            refundedCents: true,
            providerPaymentId: true,
            processedAt: true,
          },
          orderBy: { processedAt: "desc" },
          take: limit,
        }),
        context.prisma.paymentReconciliation.findMany({
          where: scope,
          select: {
            id: true,
            reconciliationNumber: true,
            status: true,
            varianceCents: true,
            periodEndedAt: true,
          },
          orderBy: { periodEndedAt: "desc" },
          take: limit,
        }),
        context.prisma.webhookEvent.findMany({
          where: { businessId },
          select: {
            id: true,
            externalEventId: true,
            eventType: true,
            status: true,
            receivedAt: true,
          },
          orderBy: { receivedAt: "desc" },
          take: limit,
        }),
      ]);
    controls.paymentProviders = providers
      .filter((entry) => entry.status === "active")
      .map((entry) => ({
        id: entry.id,
        label: entry.name,
        detail: `${entry.adapterKey} · ${entry.code}`,
      }));
    controls.paymentReconciliations = reconciliations
      .filter((entry) => ["in_review", "reopened"].includes(entry.status))
      .map((entry) => ({
        id: entry.id,
        label: entry.reconciliationNumber,
        detail: entry.status,
      }));
    metrics = [
      metric(
        "Active providers",
        providers.filter((entry) => entry.status === "active").length,
        "Registered adapter boundaries",
      ),
      metric("Non-cash tenders", tenders.length, `Latest ${limit}`),
      metric(
        "Settlement exceptions",
        reconciliations.filter((entry) => entry.varianceCents !== 0).length,
        "Requires disposition",
        "attention",
      ),
      metric(
        "Webhook failures",
        webhookEvents.filter((entry) => entry.status === "failed").length,
        "Signed event mismatches",
        "critical",
      ),
    ];
    rows = reconciliations.length
      ? reconciliations.map((entry) => ({
          id: entry.id,
          title: entry.reconciliationNumber,
          detail: "Provider settlement reconciliation",
          status: entry.status,
          metric: `${cents(entry.varianceCents)} variance`,
          occurredAt: date(entry.periodEndedAt),
        }))
      : webhookEvents.map((entry) => ({
          id: entry.id,
          title: entry.externalEventId,
          detail: entry.eventType,
          status: entry.status,
          metric: "Signed webhook",
          occurredAt: date(entry.receivedAt),
        }));
  }

  if (surface === "lottery") {
    const [games, packs, settlements, registerSessions] = await Promise.all([
      context.prisma.lotteryGame.findMany({
        where: { businessId },
        select: { id: true, name: true, gameCode: true, status: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
      context.prisma.lotteryPack.findMany({
        where: scope,
        include: { game: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: limit,
      }),
      context.prisma.lotterySettlement.findMany({
        where: scope,
        select: {
          id: true,
          settlementNumber: true,
          status: true,
          varianceCents: true,
          generatedAt: true,
        },
        orderBy: { generatedAt: "desc" },
        take: limit,
      }),
      context.prisma.registerSession.findMany({
        where: { ...scope, status: "open" },
        select: { id: true, sessionNumber: true },
        orderBy: { openedAt: "desc" },
        take: 50,
      }),
    ]);
    controls.lotteryGames = games
      .filter((entry) => entry.status === "active")
      .map((entry) => ({
        id: entry.id,
        label: entry.name,
        detail: entry.gameCode,
      }));
    controls.lotteryPacks = packs
      .filter((entry) =>
        ["received", "activated", "in_sale"].includes(entry.status),
      )
      .map((entry) => ({
        id: entry.id,
        label: entry.packNumber,
        detail: `${entry.game?.name ?? "Game"} · ${entry.status} · next ${entry.currentTicketNumber}`,
      }));
    controls.lotterySettlements = settlements
      .filter((entry) => ["in_review", "disputed"].includes(entry.status))
      .map((entry) => ({
        id: entry.id,
        label: entry.settlementNumber,
        detail: entry.status,
      }));
    controls.registerSessions = registerSessions.map((entry) => ({
      id: entry.id,
      label: entry.sessionNumber,
      detail: "open",
    }));
    metrics = [
      metric(
        "Active games",
        games.filter((entry) => entry.status === "active").length,
        "Operator-supplied game configuration",
      ),
      metric(
        "Packs in custody",
        packs.filter((entry) => !["settled", "returned"].includes(entry.status))
          .length,
        "Received through closed",
      ),
      metric(
        "Packs selling",
        packs.filter((entry) => ["activated", "in_sale"].includes(entry.status))
          .length,
        "Contiguous ticket tracking",
      ),
      metric(
        "Settlements in review",
        settlements.filter((entry) => entry.status === "in_review").length,
        "Operational reconciliation",
        "attention",
      ),
    ];
    rows = packs.map((entry) => ({
      id: entry.id,
      title: entry.packNumber,
      detail: `${entry.game?.name ?? "Lottery game"} · ${entry.ticketsSold}/${entry.ticketsReceived} sold`,
      status: entry.status,
      metric: `${cents(entry.varianceCents)} variance`,
      occurredAt: date(entry.updatedAt),
    }));
  }

  if (surface === "money_services") {
    const [providers, transactions, settlements, registerSessions] =
      await Promise.all([
        context.prisma.moneyServiceProvider.findMany({
          where: {
            businessId,
            status: "active",
            ...(storeId ? { stores: { some: { id: storeId } } } : {}),
          },
          select: { id: true, name: true, code: true, serviceType: true },
          orderBy: { name: "asc" },
          take: 100,
        }),
        context.prisma.moneyServiceTransaction.findMany({
          where: scope,
          select: {
            id: true,
            transactionNumber: true,
            status: true,
            serviceType: true,
            faceAmountCents: true,
            occurredAt: true,
          },
          orderBy: { occurredAt: "desc" },
          take: limit,
        }),
        context.prisma.moneyServiceSettlement.findMany({
          where: scope,
          select: {
            id: true,
            settlementNumber: true,
            status: true,
            varianceCents: true,
            generatedAt: true,
          },
          orderBy: { generatedAt: "desc" },
          take: limit,
        }),
        context.prisma.registerSession.findMany({
          where: { ...scope, status: "open" },
          select: { id: true, sessionNumber: true },
          orderBy: { openedAt: "desc" },
          take: 50,
        }),
      ]);
    controls.moneyServiceProviders = providers.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: `${entry.serviceType} · ${entry.code}`,
    }));
    controls.moneyServiceTransactions = transactions
      .filter((entry) => entry.status === "confirmed")
      .map((entry) => ({
        id: entry.id,
        label: entry.transactionNumber,
        detail: `${entry.serviceType} · ${cents(entry.faceAmountCents)}`,
      }));
    controls.moneyServiceSettlements = settlements
      .filter((entry) => ["in_review", "disputed"].includes(entry.status))
      .map((entry) => ({
        id: entry.id,
        label: entry.settlementNumber,
        detail: entry.status,
      }));
    controls.registerSessions = registerSessions.map((entry) => ({
      id: entry.id,
      label: entry.sessionNumber,
      detail: "open",
    }));
    metrics = [
      metric(
        "Active providers",
        providers.length,
        "Externally executed service boundaries",
      ),
      metric("Recent transactions", transactions.length, `Latest ${limit}`),
      metric(
        "Confirmed",
        transactions.filter((entry) => entry.status === "confirmed").length,
        "Awaiting settlement",
      ),
      metric(
        "Settlement exceptions",
        settlements.filter((entry) => entry.varianceCents !== 0).length,
        "Requires review",
        "attention",
      ),
    ];
    rows = transactions.map((entry) => ({
      id: entry.id,
      title: entry.transactionNumber,
      detail: entry.serviceType.replaceAll("_", " "),
      status: entry.status,
      metric: `${cents(entry.faceAmountCents)} face`,
      occurredAt: date(entry.occurredAt),
    }));
  }

  if (surface === "exports") {
    const [destinations, batches] = await Promise.all([
      context.prisma.exportDestination.findMany({
        where: {
          businessId,
          status: "active",
          ...(storeId ? { stores: { some: { id: storeId } } } : {}),
        },
        select: { id: true, name: true, code: true, type: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
      context.prisma.exportBatch.findMany({
        where: scope,
        select: {
          id: true,
          batchNumber: true,
          status: true,
          type: true,
          rowCount: true,
          generatedAt: true,
        },
        orderBy: { generatedAt: "desc" },
        take: limit,
      }),
    ]);
    controls.exportDestinations = destinations.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: `${entry.type} · ${entry.code}`,
    }));
    controls.exportBatches = batches
      .filter((entry) =>
        ["ready", "delivering", "failed"].includes(entry.status),
      )
      .map((entry) => ({
        id: entry.id,
        label: entry.batchNumber,
        detail: `${entry.type} · ${entry.status}`,
      }));
    metrics = [
      metric("Destinations", destinations.length, "Active adapter boundaries"),
      metric(
        "Ready",
        batches.filter((entry) => entry.status === "ready").length,
        "Awaiting delivery",
      ),
      metric(
        "Failed",
        batches.filter((entry) => entry.status === "failed").length,
        "Eligible for controlled retry",
        "attention",
      ),
      metric(
        "Delivered",
        batches.filter((entry) => entry.status === "delivered").length,
        `Latest ${limit}`,
        "positive",
      ),
    ];
    rows = batches.map((entry) => ({
      id: entry.id,
      title: entry.batchNumber,
      detail: `${entry.type.replaceAll("_", " ")} · ${entry.rowCount} lines`,
      status: entry.status,
      metric: entry.batchNumber,
      occurredAt: date(entry.generatedAt),
    }));
  }

  if (surface === "recovery") {
    const [devices, batches, outbox, apiKeys] = await Promise.all([
      context.prisma.offlineDevice.findMany({
        where: scope,
        select: {
          id: true,
          name: true,
          deviceCode: true,
          status: true,
          lastSequence: true,
          lastSeenAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      }),
      context.prisma.offlineOperationBatch.findMany({
        where: scope,
        select: {
          id: true,
          batchNumber: true,
          status: true,
          operationCount: true,
          conflictCount: true,
          receivedAt: true,
        },
        orderBy: { receivedAt: "desc" },
        take: limit,
      }),
      context.prisma.outboxEvent.findMany({
        where: {
          businessId,
          ...(unrestrictedStores
            ? { OR: [{ storeId }, { storeId: null }] }
            : { storeId }),
        },
        select: {
          id: true,
          eventKey: true,
          topic: true,
          status: true,
          lastError: true,
        },
        orderBy: { occurredAt: "desc" },
        take: 500,
      }),
      context.prisma.apiKey.findMany({
        where: {
          businessId,
          status: "active",
          ...(unrestrictedStores
            ? {}
            : {
                allStores: false,
                stores: {
                  some: { id: { in: allowedStoreIds ?? [] } },
                  every: { id: { in: allowedStoreIds ?? [] } },
                },
              }),
        },
        select: { id: true, name: true, keyPrefix: true },
        orderBy: { name: "asc" },
        take: 100,
      }),
    ]);
    controls.offlineDevices = devices.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: `${entry.deviceCode} · ${entry.status} · seq ${entry.lastSequence}`,
    }));
    controls.apiKeys = apiKeys.map((entry) => ({
      id: entry.id,
      label: entry.name,
      detail: entry.keyPrefix,
    }));
    controls.outboxEvents = outbox
      .filter((entry) => entry.status === "dead_letter")
      .map((entry) => ({
        id: entry.id,
        label: entry.eventKey,
        detail: `${entry.topic} · ${entry.lastError || "delivery failed"}`,
      }));
    metrics = [
      metric(
        "Active devices",
        devices.filter((entry) => entry.status === "active").length,
        "Store-scoped offline identities",
      ),
      metric("Replay batches", batches.length, `Latest ${limit}`),
      metric(
        "Conflicts",
        batches.reduce((sum, entry) => sum + entry.conflictCount, 0),
        "Server-evidence mismatches",
        "critical",
      ),
      metric(
        "Outbox dead letters",
        outbox.filter((entry) => entry.status === "dead_letter").length,
        "Eligible for controlled replay",
        "attention",
      ),
    ];
    rows = batches.map((entry) => ({
      id: entry.id,
      title: entry.batchNumber,
      detail: `${entry.operationCount} operations · ${entry.conflictCount} conflicts`,
      status: entry.status,
      metric: "Replay evidence",
      occurredAt: date(entry.receivedAt),
    }));
  }

  if (surface === "reconciliation" || surface === "reports") {
    const [days, deposits] = await Promise.all([
      context.prisma.storeDay.findMany({
        where: scope,
        select: {
          id: true,
          tradingDate: true,
          status: true,
          netReceiptsCents: true,
          cashOverShortCents: true,
          exceptionCount: true,
          generatedAt: true,
        },
        orderBy: { tradingDate: "desc" },
        take: limit,
      }),
      context.prisma.bankDeposit.findMany({
        where: scope,
        select: {
          id: true,
          depositNumber: true,
          status: true,
          amountCents: true,
          varianceCents: true,
          preparedAt: true,
        },
        orderBy: { preparedAt: "desc" },
        take: limit,
      }),
    ]);
    controls.storeDays = days
      .filter((entry) =>
        ["in_review", "reconciled", "reopened"].includes(entry.status),
      )
      .map((entry) => ({
        id: entry.id,
        label: entry.tradingDate,
        detail: entry.status,
      }));
    controls.bankDeposits = deposits
      .filter((entry) => !["verified", "voided"].includes(entry.status))
      .map((entry) => ({
        id: entry.id,
        label: entry.depositNumber,
        detail: entry.status,
      }));
    metrics = [
      metric(
        "Days in review",
        days.filter((entry) => entry.status === "in_review").length,
        "Awaiting approval",
        "attention",
      ),
      metric(
        "Days locked",
        days.filter((entry) => entry.status === "locked").length,
        "Immutable settlement evidence",
        "positive",
      ),
      metric(
        "Cash variance",
        days.reduce((sum, entry) => sum + entry.cashOverShortCents, 0),
        "Cents across projection",
      ),
      metric(
        "Deposits open",
        deposits.filter(
          (entry) => !["verified", "voided"].includes(entry.status),
        ).length,
        "Prepared or deposited",
      ),
    ];
    rows = days.map((entry) => ({
      id: entry.id,
      title: entry.tradingDate,
      detail: `${entry.exceptionCount} exceptions`,
      status: entry.status,
      metric: `${cents(entry.netReceiptsCents)} net`,
      occurredAt: date(entry.generatedAt),
    }));
  }

  if (surface === "exceptions") {
    const alerts = await context.prisma.operationalAlert.findMany({
      where: { businessId, OR: [{ storeId }, { storeId: null }] },
      select: {
        id: true,
        alertNumber: true,
        title: true,
        message: true,
        status: true,
        severity: true,
        detectedAt: true,
      },
      orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
      take: limit,
    });
    controls.operationalAlerts = alerts
      .filter((entry) => ["open", "acknowledged"].includes(entry.status))
      .map((entry) => ({
        id: entry.id,
        label: entry.title || entry.alertNumber,
        detail: `${entry.severity} · ${entry.status}`,
      }));
    metrics = [
      metric(
        "Open",
        alerts.filter((entry) => entry.status === "open").length,
        "Unacknowledged exceptions",
        "critical",
      ),
      metric(
        "Acknowledged",
        alerts.filter((entry) => entry.status === "acknowledged").length,
        "Owned by an operator",
      ),
      metric(
        "Critical",
        alerts.filter((entry) => entry.severity === "critical").length,
        "Immediate attention",
        "critical",
      ),
      metric("In view", alerts.length, `Bounded to ${limit}`),
    ];
    rows = alerts.map((entry) => ({
      id: entry.id,
      title: entry.title || entry.alertNumber,
      detail: entry.message,
      status: `${entry.severity} · ${entry.status}`,
      metric: entry.alertNumber,
      occurredAt: date(entry.detectedAt),
    }));
  }

  return {
    surface,
    businessId,
    storeId,
    generatedAt: new Date().toISOString(),
    limit,
    timezone: selectedStore?.timezone ?? null,
    currencyCode: selectedStore?.currencyCode ?? null,
    brand: {
      name: selectedBusiness.brandName,
      tagline: selectedBusiness.brandTagline,
      mark: selectedBusiness.brandMark,
      logoIcon: selectedBusiness.logoIcon,
      logoColor: selectedBusiness.logoColor,
      primaryColor: selectedBusiness.brandPrimaryColor,
      accentColor: selectedBusiness.brandAccentColor,
      storefrontMode: selectedBusiness.storefrontMode,
      storefrontStatus: selectedBusiness.storefrontStatus,
      store: selectedBusiness.storefrontStore
        ? {
            id: selectedBusiness.storefrontStore.id,
            name: selectedBusiness.storefrontStore.name,
            addressLine1: selectedBusiness.storefrontStore.addressLine1,
            addressLine2: selectedBusiness.storefrontStore.addressLine2,
            city: selectedBusiness.storefrontStore.city,
            stateProvince: selectedBusiness.storefrontStore.stateProvince,
            postalCode: selectedBusiness.storefrontStore.postalCode,
            countryCode: selectedBusiness.storefrontStore.countryCode,
            phone: selectedBusiness.storefrontStore.phone,
            hours: storefrontHoursFromMetadata(
              selectedBusiness.storefrontStore.metadata,
            ),
          }
        : null,
    },
    businesses: businesses.map((business) => ({
      id: business.id,
      label: business.name,
      detail: business.code,
    })),
    stores: stores.map((store) => ({
      id: store.id,
      label: store.name,
      detail: `${store.code} · ${store.timezone}`,
    })),
    metrics,
    rows,
    controls,
  };
}

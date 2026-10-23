import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { normalizePurchasingVariantSearch } from "@/features/keystone/lib/purchasingSelectorSearch";
import { normalizePurchasingVendorItemSearch } from "@/features/keystone/lib/purchasingVendorItemSearch";
import { normalizePurchasingOrderLineSearch } from "@/features/keystone/lib/purchasingPurchaseOrderLineSearch";
import { normalizePurchasingVendorSearch } from "@/features/keystone/lib/purchasingVendorSearch";
import { normalizePurchasingOrderSearch } from "@/features/keystone/lib/purchasingOrderSearch";
import { normalizePosCartSearch } from "@/features/keystone/lib/posCartSearch";
import { normalizePosReceiptSearch } from "@/features/keystone/lib/posReceiptSearch";
import { normalizePosVariantSearch } from "@/features/keystone/lib/posVariantSearch";
import { normalizePosVoidReceiptSearch } from "@/features/keystone/lib/posVoidReceiptSearch";
import { normalizeRefundHistorySearch } from "@/features/keystone/lib/refundHistorySearch";
import { normalizeInventoryCountSearch } from "@/features/keystone/lib/inventoryCountSearch";
import { normalizeInventoryLocationSearch } from "@/features/keystone/lib/inventoryLocationSearch";
import { normalizeInventoryVariantSearch } from "@/features/keystone/lib/inventoryVariantSearch";
import { normalizeInventoryTransferSearch } from "@/features/keystone/lib/inventoryTransferSearch";
import { normalizeLoyaltyAccountSearch } from "@/features/keystone/lib/loyaltyAccountSearch";
import { normalizeFoodserviceRecipeSearch } from "@/features/keystone/lib/foodserviceRecipeSearch";
import { normalizeFoodserviceSkuSearch } from "@/features/keystone/lib/foodserviceSkuSearch";
import { normalizeFoodserviceLocationCodeSearch } from "@/features/keystone/lib/foodserviceLocationCodeSearch";
import { normalizeFoodservicePrepBatchSearch } from "@/features/keystone/lib/foodservicePrepBatchSearch";
import { normalizeFoodserviceEmployeeNumberSearch } from "@/features/keystone/lib/foodserviceEmployeeNumberSearch";

export type PlatformSurface =
  | "overview"
  | "store_settings"
  | "pos"
  | "fuel"
  | "inventory"
  | "purchasing"
  | "pricing"
  | "compliance"
  | "foodservice"
  | "loyalty"
  | "payments"
  | "lottery"
  | "money_services"
  | "reconciliation"
  | "reports"
  | "exports"
  | "recovery"
  | "exceptions";

export type PlatformOption = {
  id: string;
  label: string;
  detail?: string | null;
};
export type PlatformProjection = {
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
      hours: Record<string, string>;
    } | null;
  } | null;
  businesses: PlatformOption[];
  stores: PlatformOption[];
  metrics: Array<{
    label: string;
    value: string;
    detail: string;
    tone: string;
  }>;
  rows: Array<{
    id: string;
    title: string;
    detail: string;
    status: string;
    metric: string;
    occurredAt: string | null;
  }>;
  controls: Record<string, PlatformOption[]>;
};

export type PlatformSearch = Promise<
  Record<string, string | string[] | undefined>
>;

export function searchValue(
  search: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = search[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export async function getPlatformProjection(
  surface: PlatformSurface,
  searchParams: PlatformSearch,
): Promise<{
  projection: PlatformProjection | null;
  error: string;
  notice: string;
  selectedBusinessId: string;
  selectedStoreId: string;
  variantSearch: string | null;
  vendorItemSearch: string | null;
  purchaseOrderLineSearch: string | null;
  receiptSearch: string | null;
  refundHistorySearch: string | null;
  voidReceiptSearch: string | null;
  posVariantSearch: string | null;
  posCartSearch: string | null;
  loyaltyAccountSearch: string | null;
  recipeCodeSearch: string | null;
  foodserviceSkuSearch: string | null;
  foodserviceLocationCodeSearch: string | null;
  foodserviceBatchNumberSearch: string | null;
  foodserviceEmployeeNumberSearch: string | null;
  inventoryCountSearch: string | null;
  inventoryLocationSearch: string | null;
  vendorSearch: string | null;
  purchaseOrderSearch: string | null;
  inventoryVariantSearch: string | null;
  inventoryTransferSearch: string | null;
}> {
  const search = await searchParams;
  const selectedBusinessId = searchValue(search, "businessId");
  const selectedStoreId = searchValue(search, "storeId");
  let variantSearch: string | null = null;
  let variantSearchError = "";
  let vendorItemSearch: string | null = null;
  let vendorItemSearchError = "";
  let purchaseOrderLineSearch: string | null = null;
  let purchaseOrderLineSearchError = "";
  let vendorSearch: string | null = null;
  let vendorSearchError = "";
  let purchaseOrderSearch: string | null = null;
  let purchaseOrderSearchError = "";
  let receiptSearch: string | null = null;
  let receiptSearchError = "";
  let refundHistorySearch: string | null = null;
  let refundHistorySearchError = "";
  let voidReceiptSearch: string | null = null;
  let voidReceiptSearchError = "";
  let posVariantSearch: string | null = null;
  let posVariantSearchError = "";
  let posCartSearch: string | null = null;
  let posCartSearchError = "";
  let loyaltyAccountSearch: string | null = null;
  let loyaltyAccountSearchError = "";
  let inventoryCountSearch: string | null = null;
  let inventoryCountSearchError = "";
  let inventoryLocationSearch: string | null = null;
  let inventoryLocationSearchError = "";
  let inventoryVariantSearch: string | null = null;
  let inventoryVariantSearchError = "";
  let inventoryTransferSearch: string | null = null;
  let inventoryTransferSearchError = "";
  if (surface === "purchasing") {
    try {
      variantSearch = normalizePurchasingVariantSearch(search.variantSearch);
    } catch (error) {
      variantSearchError =
        error instanceof Error ? error.message : "Variant search is invalid";
    }
    try {
      vendorItemSearch = normalizePurchasingVendorItemSearch(
        search.vendorItemSearch,
      );
    } catch (error) {
      vendorItemSearchError =
        error instanceof Error
          ? error.message
          : "Vendor-item search is invalid";
    }
    try {
      vendorSearch = normalizePurchasingVendorSearch(search.vendorSearch);
    } catch (error) {
      vendorSearchError =
        error instanceof Error ? error.message : "Vendor search is invalid";
    }
    try {
      purchaseOrderSearch = normalizePurchasingOrderSearch(
        search.purchaseOrderSearch,
      );
    } catch (error) {
      purchaseOrderSearchError =
        error instanceof Error
          ? error.message
          : "Purchase-order search is invalid";
    }
    try {
      purchaseOrderLineSearch = normalizePurchasingOrderLineSearch(
        search.purchaseOrderLineSearch,
      );
    } catch (error) {
      purchaseOrderLineSearchError =
        error instanceof Error
          ? error.message
          : "Receiving-line search is invalid";
    }
  }
  if (surface === "loyalty") {
    try {
      loyaltyAccountSearch = normalizeLoyaltyAccountSearch(
        search.loyaltyAccountSearch,
      );
    } catch (error) {
      loyaltyAccountSearchError =
        error instanceof Error
          ? error.message
          : "Loyalty account search is invalid";
    }
  }
  let recipeCodeSearch: string | null = null;
  let recipeCodeSearchError = "";
  let foodserviceSkuSearch: string | null = null;
  let foodserviceSkuSearchError = "";
  let foodserviceLocationCodeSearch: string | null = null;
  let foodserviceLocationCodeSearchError = "";
  let foodserviceBatchNumberSearch: string | null = null;
  let foodserviceBatchNumberSearchError = "";
  let foodserviceEmployeeNumberSearch: string | null = null;
  let foodserviceEmployeeNumberSearchError = "";
  if (surface === "foodservice") {
    try {
      recipeCodeSearch = normalizeFoodserviceRecipeSearch(
        search.recipeCodeSearch,
      );
    } catch (error) {
      recipeCodeSearchError =
        error instanceof Error
          ? error.message
          : "Recipe-code search is invalid";
    }
    try {
      foodserviceSkuSearch = normalizeFoodserviceSkuSearch(
        search.foodserviceSkuSearch,
      );
    } catch (error) {
      foodserviceSkuSearchError =
        error instanceof Error
          ? error.message
          : "Foodservice SKU search is invalid";
    }
    try {
      foodserviceLocationCodeSearch = normalizeFoodserviceLocationCodeSearch(
        search.foodserviceLocationCodeSearch,
      );
    } catch (error) {
      foodserviceLocationCodeSearchError =
        error instanceof Error
          ? error.message
          : "Foodservice location search is invalid";
    }
    try {
      foodserviceBatchNumberSearch = normalizeFoodservicePrepBatchSearch(
        search.foodserviceBatchNumberSearch,
      );
    } catch (error) {
      foodserviceBatchNumberSearchError =
        error instanceof Error ? error.message : "Prep-batch search is invalid";
    }
    try {
      foodserviceEmployeeNumberSearch =
        normalizeFoodserviceEmployeeNumberSearch(
          search.foodserviceEmployeeNumberSearch,
        );
    } catch (error) {
      foodserviceEmployeeNumberSearchError =
        error instanceof Error
          ? error.message
          : "Employee-number search is invalid";
    }
  }
  if (surface === "inventory") {
    try {
      inventoryCountSearch = normalizeInventoryCountSearch(
        search.inventoryCountSearch,
      );
    } catch (error) {
      inventoryCountSearchError =
        error instanceof Error
          ? error.message
          : "Inventory count search is invalid";
    }
    try {
      inventoryLocationSearch = normalizeInventoryLocationSearch(
        search.inventoryLocationSearch,
      );
    } catch (error) {
      inventoryLocationSearchError =
        error instanceof Error
          ? error.message
          : "Inventory location search is invalid";
    }
    try {
      inventoryVariantSearch = normalizeInventoryVariantSearch(
        search.inventoryVariantSearch,
      );
    } catch (error) {
      inventoryVariantSearchError =
        error instanceof Error
          ? error.message
          : "Inventory variant search is invalid";
    }
    try {
      inventoryTransferSearch = normalizeInventoryTransferSearch(
        search.inventoryTransferSearch,
      );
    } catch (error) {
      inventoryTransferSearchError =
        error instanceof Error
          ? error.message
          : "Inventory transfer search is invalid";
    }
  }
  if (surface === "pos") {
    try {
      receiptSearch = normalizePosReceiptSearch(search.receiptSearch);
    } catch (error) {
      receiptSearchError =
        error instanceof Error ? error.message : "Receipt search is invalid";
    }
    try {
      refundHistorySearch = normalizeRefundHistorySearch(
        search.refundHistorySearch,
      );
    } catch (error) {
      refundHistorySearchError =
        error instanceof Error
          ? error.message
          : "Refund history search is invalid";
    }
    try {
      voidReceiptSearch = normalizePosVoidReceiptSearch(
        search.voidReceiptSearch,
      );
    } catch (error) {
      voidReceiptSearchError =
        error instanceof Error
          ? error.message
          : "Void receipt search is invalid";
    }
    try {
      posVariantSearch = normalizePosVariantSearch(search.posVariantSearch);
    } catch (error) {
      posVariantSearchError =
        error instanceof Error ? error.message : "POS item search is invalid";
    }
    try {
      posCartSearch = normalizePosCartSearch(search.posCartSearch);
    } catch (error) {
      posCartSearchError =
        error instanceof Error ? error.message : "POS cart search is invalid";
    }
  }
  const response = await keystoneClient<{
    conveniencePlatformProjection: PlatformProjection;
  }>(
    `
    query PlatformProjection($input: ConveniencePlatformProjectionInput!) {
      conveniencePlatformProjection(input: $input) {
        surface businessId storeId generatedAt limit timezone currencyCode
        brand {
          name tagline mark logoIcon logoColor primaryColor accentColor
          storefrontMode storefrontStatus
          store {
            id name addressLine1 addressLine2 city stateProvince postalCode
            countryCode phone hours
          }
        }
        businesses { id label detail }
        stores { id label detail }
        metrics { label value detail tone }
        rows { id title detail status metric occurredAt }
        controls
      }
    }
  `,
    {
      input: {
        surface,
        businessId: selectedBusinessId || null,
        storeId: selectedStoreId || null,
        limit: 20,
        variantSearch,
        vendorItemSearch,
        vendorSearch,
        purchaseOrderSearch,
        purchaseOrderLineSearch,
        receiptSearch,
        refundHistorySearch,
        voidReceiptSearch,
        posVariantSearch,
        posCartSearch,
        loyaltyAccountSearch,
        recipeCodeSearch,
        foodserviceSkuSearch,
        foodserviceLocationCodeSearch,
        foodserviceBatchNumberSearch,
        foodserviceEmployeeNumberSearch,
        inventoryCountSearch,
        inventoryLocationSearch,
        inventoryVariantSearch,
        inventoryTransferSearch,
      },
    },
  );
  return {
    projection: response.success
      ? response.data.conveniencePlatformProjection
      : null,
    error:
      searchValue(search, "error") ||
      variantSearchError ||
      vendorItemSearchError ||
      vendorSearchError ||
      purchaseOrderSearchError ||
      purchaseOrderLineSearchError ||
      receiptSearchError ||
      refundHistorySearchError ||
      voidReceiptSearchError ||
      posVariantSearchError ||
      posCartSearchError ||
      loyaltyAccountSearchError ||
      recipeCodeSearchError ||
      foodserviceSkuSearchError ||
      foodserviceLocationCodeSearchError ||
      foodserviceBatchNumberSearchError ||
      foodserviceEmployeeNumberSearchError ||
      inventoryCountSearchError ||
      inventoryLocationSearchError ||
      inventoryVariantSearchError ||
      inventoryTransferSearchError ||
      (response.success ? "" : response.error || "Projection failed"),
    notice: searchValue(search, "notice"),
    selectedBusinessId,
    selectedStoreId,
    variantSearch,
    vendorItemSearch,
    vendorSearch,
    purchaseOrderSearch,
    purchaseOrderLineSearch,
    receiptSearch,
    refundHistorySearch,
    voidReceiptSearch,
    posVariantSearch,
    posCartSearch,
    loyaltyAccountSearch,
    recipeCodeSearch,
    foodserviceSkuSearch,
    foodserviceLocationCodeSearch,
    foodserviceBatchNumberSearch,
    foodserviceEmployeeNumberSearch,
    inventoryCountSearch,
    inventoryLocationSearch,
    inventoryVariantSearch,
    inventoryTransferSearch,
  };
}

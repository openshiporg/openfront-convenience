export type SaleOwnershipScope = {
  businessId: string;
  storeId: string;
  saleId: string;
};

export function posReceiptSaleWhere(scope: SaleOwnershipScope) {
  return {
    id: scope.saleId,
    businessId: scope.businessId,
    storeId: scope.storeId,
  };
}

export function posReceiptChildWhere(scope: SaleOwnershipScope) {
  return {
    businessId: scope.businessId,
    storeId: scope.storeId,
    saleId: scope.saleId,
  };
}

export function posReceiptRefundChildWhere(
  scope: SaleOwnershipScope,
  refundIds: string[],
) {
  return {
    businessId: scope.businessId,
    storeId: scope.storeId,
    refundId: { in: refundIds },
  };
}

export function refundLineAccountingWhere(
  scope: SaleOwnershipScope,
  saleLineId: string,
) {
  return {
    businessId: scope.businessId,
    storeId: scope.storeId,
    saleLineId,
    refund: {
      businessId: scope.businessId,
      storeId: scope.storeId,
      saleId: scope.saleId,
      status: {
        in: ["approved", "processing", "completed"] as (
          "approved" | "processing" | "completed"
        )[],
      },
    },
  };
}

export function refundTenderAllocationTotalsWhere(
  scope: SaleOwnershipScope,
  tenderId: string,
) {
  return {
    businessId: scope.businessId,
    storeId: scope.storeId,
    tenderId,
    status: "completed" as const,
    refund: {
      businessId: scope.businessId,
      storeId: scope.storeId,
      saleId: scope.saleId,
      status: "completed" as const,
    },
  };
}

export function refundOriginalTenderWhere(
  scope: SaleOwnershipScope,
  tenderIds: string[],
) {
  return {
    id: { in: tenderIds },
    businessId: scope.businessId,
    storeId: scope.storeId,
    saleId: scope.saleId,
    status: {
      in: ["captured", "partially_refunded"] as (
        "captured" | "partially_refunded"
      )[],
    },
  };
}

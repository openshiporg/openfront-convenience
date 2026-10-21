"use server";

import { revalidatePath } from "next/cache";
import { normalizeStoreLogoColor } from "./store-settings/lib/store-logo";
import { redirect } from "next/navigation";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { offlineOperationRequestDigest } from "@/features/keystone/lib/offlineReplay";

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function integer(formData: FormData, name: string): number {
  return Number(field(formData, name));
}

function optionalField(formData: FormData, name: string): string | null {
  return field(formData, name) || null;
}

function optionalInteger(formData: FormData, name: string): number | null {
  const value = field(formData, name);
  return value ? Number(value) : null;
}

const operationPaths = new Set([
  "/dashboard/platform/store-settings",
  "/dashboard/platform/pos",
  "/dashboard/platform/fuel",
  "/dashboard/platform/inventory",
  "/dashboard/platform/purchasing",
  "/dashboard/platform/pricing",
  "/dashboard/platform/restricted-sales",
  "/dashboard/platform/foodservice",
  "/dashboard/platform/loyalty",
  "/dashboard/platform/payments",
  "/dashboard/platform/lottery",
  "/dashboard/platform/money-services",
  "/dashboard/platform/reconciliation",
  "/dashboard/platform/exports",
  "/dashboard/platform/recovery",
  "/dashboard/platform/exceptions",
]);

function operationPath(formData: FormData): string {
  const path = field(formData, "returnPath");
  return operationPaths.has(path) ? path : "/dashboard/platform";
}

async function executeOperation(
  formData: FormData,
  mutation: string,
  fieldName: string,
  input: Record<string, unknown>,
  additionalRevalidationPaths: string[] = [],
): Promise<never> {
  const path = operationPath(formData);
  const idempotencyKey = field(formData, "idempotencyKey");
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,199}$/.test(idempotencyKey)) {
    const query = new URLSearchParams({
      error: "A stable operation idempotency key is required",
    });
    redirect(`${path}?${query.toString()}`);
  }
  const response = await keystoneClient<
    Record<
      string,
      {
        id: string;
        status: string;
        replayed: boolean;
        reference?: string | null;
      }
    >
  >(mutation, { input: { ...input, idempotencyKey } });
  const query = new URLSearchParams();
  const businessId = field(formData, "businessId");
  const storeId = field(formData, "storeId");
  if (businessId) query.set("businessId", businessId);
  if (storeId) query.set("storeId", storeId);
  if (response.success) {
    const result = response.data[fieldName];
    query.set(
      "notice",
      `${result.reference || result.id} · ${result.status}${result.replayed ? " · replayed" : ""}`,
    );
  } else {
    query.set("error", response.error || "Operation failed");
  }
  revalidatePath(path);
  for (const revalidationPath of additionalRevalidationPaths) {
    revalidatePath(revalidationPath);
  }
  redirect(`${path}?${query.toString()}`);
}

export async function configureBusinessBrandAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureBusinessBrand($input: ConfigureBusinessBrandInput!) {
      configureBusinessBrand(input: $input) { id status replayed reference }
    }
  `,
    "configureBusinessBrand",
    {
      businessId: field(formData, "businessId"),
      brandName: field(formData, "brandName"),
      brandTagline: field(formData, "brandTagline"),
      storeId: field(formData, "storeId"),
      brandMark: field(formData, "brandMark"),
      logoIcon: field(formData, "logoIcon"),
      logoColor: normalizeStoreLogoColor(field(formData, "logoColor")),
      themePreset: field(formData, "themePreset"),
      storefrontMode: field(formData, "storefrontMode") || "live",
      storefrontStatus: field(formData, "storefrontStatus"),
      addressLine1: field(formData, "addressLine1"),
      addressLine2: field(formData, "addressLine2"),
      city: field(formData, "city"),
      stateProvince: field(formData, "stateProvince"),
      postalCode: field(formData, "postalCode"),
      countryCode: field(formData, "countryCode"),
      phone: field(formData, "phone"),
      publicHours: {
        monday: field(formData, "hoursMonday"),
        tuesday: field(formData, "hoursTuesday"),
        wednesday: field(formData, "hoursWednesday"),
        thursday: field(formData, "hoursThursday"),
        friday: field(formData, "hoursFriday"),
        saturday: field(formData, "hoursSaturday"),
        sunday: field(formData, "hoursSunday"),
      },
    },
    ["/"],
  );
}

export async function setOwnPosPinAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformSetPosPin($input: SetOwnPosPinInput!) {
      setOwnPosPin(input: $input) { id status replayed reference }
    }
  `,
    "setOwnPosPin",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      employeeId: field(formData, "employeeId"),
      newPin: field(formData, "newPin"),
    },
  );
}

export async function openShiftAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformOpenShift($input: OpenEmployeeShiftInput!) {
      openEmployeeShift(input: $input) { id status replayed reference }
    }
  `,
    "openEmployeeShift",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      employeeId: field(formData, "employeeId"),
      startsAt: field(formData, "startsAt"),
      endsAt: field(formData, "endsAt"),
      roleSnapshot: field(formData, "roleSnapshot") || null,
    },
  );
}

export async function openRegisterAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformOpenRegister($input: OpenRegisterSessionInput!) {
      openRegisterSession(input: $input) { id status replayed reference }
    }
  `,
    "openRegisterSession",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      registerId: field(formData, "registerId"),
      employeeId: field(formData, "employeeId"),
      shiftId: field(formData, "shiftId") || null,
      openingCashCents: integer(formData, "openingCashCents"),
    },
  );
}

export async function recordCashAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformCashMovement($input: RecordCashMovementInput!) {
      recordCashMovement(input: $input) { id status replayed reference }
    }
  `,
    "recordCashMovement",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      registerSessionId: field(formData, "registerSessionId"),
      employeeId: field(formData, "employeeId"),
      type: field(formData, "type"),
      direction: field(formData, "direction") || null,
      amountCents: integer(formData, "amountCents"),
      reason: field(formData, "reason"),
    },
  );
}

export async function closeShiftAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformCloseShift($input: CloseEmployeeShiftInput!) {
      closeEmployeeShift(input: $input) { id status replayed reference }
    }
  `,
    "closeEmployeeShift",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      shiftId: field(formData, "shiftId"),
      notes: field(formData, "notes") || null,
    },
  );
}

export async function closeRegisterAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformCloseRegister($input: CloseRegisterSessionInput!) {
      closeRegisterSession(input: $input) { id status replayed reference }
    }
  `,
    "closeRegisterSession",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      registerSessionId: field(formData, "registerSessionId"),
      countedCashCents: integer(formData, "countedCashCents"),
      notes: field(formData, "notes") || null,
    },
    ["/dashboard/platform/reconciliation"],
  );
}

export async function createPosCartAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformCreatePosCart($input: CreatePosCartInput!) {
      createPosCart(input: $input) { id status replayed reference }
    }
  `,
    "createPosCart",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      registerSessionId: field(formData, "registerSessionId"),
      cashierId: field(formData, "employeeId"),
      customerId: field(formData, "customerId") || null,
      loyaltyAccountId: field(formData, "loyaltyAccountId") || null,
    },
  );
}

export async function addPosLineAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformAddPosLine($input: AddPosCartLineInput!) {
      addPosCartLine(input: $input) { id status replayed reference }
    }
  `,
    "addPosCartLine",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      cartId: field(formData, "cartId"),
      barcode: field(formData, "barcode") || null,
      variantId: field(formData, "variantId") || null,
      quantity: field(formData, "quantity"),
    },
  );
}

export async function updatePosLineAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformUpdatePosLine($input: UpdatePosCartLineInput!) {
      updatePosCartLine(input: $input) { id status replayed reference }
    }
  `,
    "updatePosCartLine",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      cartId: field(formData, "cartId"),
      cartLineId: field(formData, "cartLineId"),
      quantity: field(formData, "quantity"),
      employeeId: field(formData, "employeeId"),
      managerPin: field(formData, "managerPin"),
      reason: field(formData, "reason"),
    },
  );
}

export async function removePosLineAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformRemovePosLine($input: RemovePosCartLineInput!) {
      removePosCartLine(input: $input) { id status replayed reference }
    }
  `,
    "removePosCartLine",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      cartId: field(formData, "cartId"),
      cartLineId: field(formData, "cartLineId"),
      employeeId: field(formData, "employeeId"),
      managerPin: field(formData, "managerPin"),
      reason: field(formData, "reason"),
    },
  );
}

export async function transitionPosCartAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformTransitionPosCart($input: TransitionPosCartInput!) {
      transitionPosCart(input: $input) { id status replayed reference }
    }
  `,
    "transitionPosCart",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      cartId: field(formData, "cartId"),
      nextStatus: field(formData, "nextStatus"),
      reason: field(formData, "reason") || null,
    },
  );
}

export async function applyPosPromotionAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformApplyPromotion($input: ApplyPromotionToCartInput!) {
      applyPromotionToCart(input: $input) { id status replayed reference }
    }
  `,
    "applyPromotionToCart",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      cartId: field(formData, "cartId"),
      promotionId: field(formData, "promotionId"),
      code: field(formData, "code") || null,
    },
  );
}

export async function completePosSaleAction(formData: FormData) {
  const tender = (suffix: "" | "2") => {
    const method = field(formData, `method${suffix}`);
    const amountCents = integer(formData, `amountCents${suffix}`);
    return {
      method,
      amountCents,
      tenderedCents:
        method === "cash"
          ? integer(formData, `tenderedCents${suffix}`) || amountCents
          : null,
      paymentProviderId:
        method === "cash"
          ? null
          : field(formData, `paymentProviderId${suffix}`) || null,
      providerPaymentId:
        method === "cash"
          ? null
          : field(formData, `providerPaymentId${suffix}`) || null,
      providerAuthority:
        method === "cash"
          ? null
          : field(formData, `providerAuthority${suffix}`) || null,
      cardBrand:
        method === "cash"
          ? null
          : field(formData, `cardBrand${suffix}`) || null,
      cardLast4:
        method === "cash"
          ? null
          : field(formData, `cardLast4${suffix}`) || null,
    };
  };
  const tenders = [tender("")];
  if (field(formData, "amountCents2")) tenders.push(tender("2"));
  return executeOperation(
    formData,
    `
    mutation PlatformCompletePosSale($input: CompletePosSaleInput!) {
      completePosSale(input: $input) { id status replayed reference }
    }
  `,
    "completePosSale",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      cartId: field(formData, "cartId"),
      tenders,
    },
  );
}

export async function refundPosSaleAction(formData: FormData) {
  const allocationAmount = field(formData, "refundAllocationCents");
  const secondAllocationAmount = field(formData, "refundAllocationCents2");
  const tenderAllocations = allocationAmount
    ? [
        {
          tenderId: field(formData, "originalTenderId"),
          amountCents: Number(allocationAmount),
          providerRefundId: optionalField(formData, "providerRefundId"),
          providerAuthority: optionalField(formData, "providerAuthority"),
        },
        ...(secondAllocationAmount
          ? [
              {
                tenderId: field(formData, "originalTenderId2"),
                amountCents: Number(secondAllocationAmount),
                providerRefundId: optionalField(formData, "providerRefundId2"),
                providerAuthority: optionalField(
                  formData,
                  "providerAuthority2",
                ),
              },
            ]
          : []),
      ]
    : null;
  return executeOperation(
    formData,
    `
    mutation PlatformRefundPosSale($input: RefundPosSaleInput!) {
      refundPosSale(input: $input) { id status replayed reference }
    }
  `,
    "refundPosSale",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      saleId: field(formData, "saleId"),
      originalTenderId: tenderAllocations
        ? null
        : field(formData, "originalTenderId"),
      tenderAllocations,
      registerSessionId: field(formData, "registerSessionId"),
      employeeId: field(formData, "employeeId"),
      reason: field(formData, "reason"),
      returnReason: field(formData, "returnReason") || null,
      providerRefundId: field(formData, "providerRefundId") || null,
      providerAuthority: field(formData, "providerAuthority") || null,
      notes: field(formData, "notes") || null,
      overrideNonReturnable:
        field(formData, "overrideNonReturnable") === "true",
      overrideReason: optionalField(formData, "overrideReason"),
      managerPin: optionalField(formData, "managerPin"),
      lines: [
        {
          saleLineId: field(formData, "saleLineId"),
          quantity: field(formData, "quantity"),
          disposition: field(formData, "disposition"),
          condition: field(formData, "condition") || null,
          note: field(formData, "notes") || null,
        },
      ],
    },
    ["/dashboard/platform/payments", "/dashboard/platform/reconciliation", `/dashboard/platform/pos/receipt/${encodeURIComponent(field(formData, "saleId"))}`],
  );
}

export async function voidCompletedPosSaleAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformVoidCompletedSale($input: VoidCompletedPosSaleInput!) {
      voidCompletedPosSale(input: $input) { id status replayed reference }
    }
  `,
    "voidCompletedPosSale",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      saleId: field(formData, "saleId"),
      registerSessionId: field(formData, "registerSessionId"),
      employeeId: field(formData, "employeeId"),
      reason: field(formData, "reason"),
      managerPin: field(formData, "managerPin"),
    },
  );
}

export async function configureFuelTopologyAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureFuelTopology($input: ConfigureFuelTopologyInput!) {
      configureFuelTopology(input: $input) { id status replayed reference }
    }
  `,
    "configureFuelTopology",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      siteName: field(formData, "siteName"),
      siteCode: field(formData, "siteCode"),
      gradeName: field(formData, "gradeName"),
      gradeCode: field(formData, "gradeCode"),
      octaneRating: field(formData, "octaneRating")
        ? integer(formData, "octaneRating")
        : null,
      tankNumber: field(formData, "tankNumber"),
      tankCapacityGallons: field(formData, "tankCapacityGallons"),
      initialVolumeGallons: field(formData, "initialVolumeGallons") || "0",
      pumpNumber: field(formData, "pumpNumber"),
      nozzleNumber: field(formData, "nozzleNumber"),
    },
  );
}

export async function setFuelPriceAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformFuelPrice($input: SetFuelPriceInput!) {
      setFuelPrice(input: $input) { id status replayed reference }
    }
  `,
    "setFuelPrice",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      siteId: field(formData, "siteId"),
      gradeId: field(formData, "gradeId"),
      employeeId: field(formData, "employeeId"),
      priceTier: field(formData, "priceTier"),
      priceMillsPerGallon: integer(formData, "priceMillsPerGallon"),
      effectiveAt: field(formData, "effectiveAt"),
    },
  );
}

export async function recordTankReadingAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformTankReading($input: RecordFuelTankReadingInput!) {
      recordFuelTankReading(input: $input) { id status replayed reference }
    }
  `,
    "recordFuelTankReading",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      siteId: field(formData, "siteId"),
      tankId: field(formData, "tankId"),
      employeeId: field(formData, "employeeId"),
      source: field(formData, "source"),
      volumeGallons: field(formData, "volumeGallons"),
      waterVolumeGallons: field(formData, "waterVolumeGallons") || "0",
      measuredAt: field(formData, "measuredAt"),
      externalReference: field(formData, "externalReference") || null,
    },
  );
}

export async function recordFuelDeliveryAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformFuelDelivery($input: RecordFuelDeliveryInput!) {
      recordFuelDelivery(input: $input) { id status replayed reference }
    }
  `,
    "recordFuelDelivery",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      siteId: field(formData, "siteId"),
      tankId: field(formData, "tankId"),
      vendorId: field(formData, "vendorId") || null,
      employeeId: field(formData, "employeeId"),
      billOfLadingNumber: field(formData, "billOfLadingNumber") || null,
      grossVolumeGallons: field(formData, "grossVolumeGallons"),
      netVolumeGallons: field(formData, "netVolumeGallons"),
      beforeVolumeGallons: field(formData, "beforeVolumeGallons") || null,
      afterVolumeGallons: field(formData, "afterVolumeGallons") || null,
      unitCostMillsPerGallon: field(formData, "unitCostMillsPerGallon")
        ? integer(formData, "unitCostMillsPerGallon")
        : null,
      notes: field(formData, "notes") || null,
    },
  );
}

export async function authorizeFuelPaymentAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformAuthorizeFuelPayment($input: AuthorizeFuelPaymentInput!) {
      authorizeFuelPayment(input: $input) { id status replayed reference }
    }
  `,
    "authorizeFuelPayment",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      siteId: field(formData, "siteId"),
      registerSessionId: field(formData, "registerSessionId"),
      employeeId: field(formData, "employeeId"),
      method: field(formData, "method"),
      priceTier: field(formData, "priceTier"),
      amountCents: integer(formData, "amountCents"),
      paymentProviderId: field(formData, "paymentProviderId") || null,
      providerPaymentId: field(formData, "providerPaymentId") || null,
      providerAuthority: field(formData, "providerAuthority") || null,
    },
  );
}

export async function cancelFuelPaymentAuthorizationAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformCancelFuelPayment($input: CancelFuelPaymentAuthorizationInput!) {
      cancelFuelPaymentAuthorization(input: $input) { id status replayed reference }
    }
  `,
    "cancelFuelPaymentAuthorization",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      saleId: field(formData, "saleId"),
      employeeId: field(formData, "employeeId"),
      reason: field(formData, "reason"),
      providerRefundId: field(formData, "providerRefundId") || null,
      providerAuthority: field(formData, "providerAuthority") || null,
    },
  );
}

export async function completeFuelTransactionAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformFuelTransaction($input: CompleteFuelTransactionInput!) {
      completeFuelTransaction(input: $input) { id status replayed reference }
    }
  `,
    "completeFuelTransaction",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      siteId: field(formData, "siteId"),
      pumpId: field(formData, "pumpId"),
      nozzleId: field(formData, "nozzleId"),
      gradeId: field(formData, "gradeId"),
      controllerTransactionId: field(formData, "controllerTransactionId"),
      priceTier: field(formData, "priceTier"),
      volumeGallons: field(formData, "volumeGallons"),
      saleId: field(formData, "saleId"),
      tenderId: field(formData, "tenderId"),
      providerRefundId: field(formData, "providerRefundId") || null,
      providerAuthority: field(formData, "providerAuthority") || null,
    },
  );
}

export async function generateFuelReconciliationAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformGenerateFuelReconciliation($input: GenerateFuelReconciliationInput!) {
      generateFuelReconciliation(input: $input) { id status replayed reference }
    }
  `,
    "generateFuelReconciliation",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      siteId: field(formData, "siteId"),
      tankId: field(formData, "tankId"),
      openingReadingId: field(formData, "openingReadingId"),
      closingReadingId: field(formData, "closingReadingId"),
      employeeId: field(formData, "employeeId"),
      periodStartedAt: field(formData, "periodStartedAt"),
      periodEndedAt: field(formData, "periodEndedAt"),
      toleranceGallons: field(formData, "toleranceGallons"),
      notes: field(formData, "notes") || null,
    },
  );
}

export async function approveFuelReconciliationAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformApproveFuelReconciliation($input: ApproveFuelReconciliationInput!) {
      approveFuelReconciliation(input: $input) { id status replayed reference }
    }
  `,
    "approveFuelReconciliation",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      reconciliationId: field(formData, "reconciliationId"),
      employeeId: field(formData, "employeeId"),
      lock: field(formData, "lock") === "true",
      notes: field(formData, "notes") || null,
    },
  );
}

export async function createInventoryCountAction(formData: FormData) {
  const variantId = field(formData, "variantId");
  return executeOperation(
    formData,
    `
    mutation PlatformStartInventoryCount($input: StartInventoryCountInput!) {
      startInventoryCount(input: $input) { id status replayed reference }
    }
  `,
    "startInventoryCount",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      locationId: field(formData, "locationId"),
      employeeId: field(formData, "employeeId"),
      type: field(formData, "type"),
      variantIds: variantId ? [variantId] : [],
      notes: field(formData, "notes") || null,
    },
  );
}

export async function recordInventoryCountLineAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformRecordCountLine($input: RecordInventoryCountLineInput!) {
      recordInventoryCountLine(input: $input) { id status replayed reference }
    }
  `,
    "recordInventoryCountLine",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      countLineId: field(formData, "countLineId"),
      employeeId: field(formData, "employeeId"),
      actualQuantity: field(formData, "actualQuantity"),
      unitCostCents: optionalInteger(formData, "unitCostCents"),
      lotNumber: optionalField(formData, "lotNumber"),
      expiresAt: optionalField(formData, "expiresAt"),
      reason: field(formData, "reason") || null,
    },
  );
}

export async function postInventoryAdjustmentAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformInventoryAdjustment($input: PostInventoryAdjustmentInput!) {
      postInventoryAdjustment(input: $input) { id status replayed reference }
    }
  `,
    "postInventoryAdjustment",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      locationId: field(formData, "locationId"),
      variantId: field(formData, "variantId"),
      employeeId: field(formData, "employeeId"),
      type: field(formData, "type"),
      quantityDelta: field(formData, "quantityDelta"),
      unitCostCents: optionalInteger(formData, "unitCostCents"),
      lotNumber: optionalField(formData, "lotNumber"),
      expiresAt: optionalField(formData, "expiresAt"),
      reason: field(formData, "reason"),
    },
  );
}

export async function transitionInventoryCountAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformInventoryCount($input: TransitionInventoryCountInput!) {
      transitionInventoryCount(input: $input) { id status replayed reference }
    }
  `,
    "transitionInventoryCount",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      countId: field(formData, "countId"),
      employeeId: field(formData, "employeeId"),
      nextStatus: field(formData, "nextStatus"),
    },
  );
}

export async function approveInventoryCountAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformApproveInventoryCount($input: ApproveInventoryCountInput!) {
      approveInventoryCount(input: $input) { id status replayed reference }
    }
  `,
    "approveInventoryCount",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      countId: field(formData, "countId"),
      employeeId: field(formData, "employeeId"),
    },
  );
}

export async function draftInventoryTransferAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformDraftInventoryTransfer($input: DraftInventoryTransferInput!) {
      draftInventoryTransfer(input: $input) { id status replayed reference }
    }
  `,
    "draftInventoryTransfer",
    {
      businessId: field(formData, "businessId"),
      sourceStoreId: field(formData, "storeId"),
      destinationStoreId: field(formData, "destinationStoreId"),
      sourceLocationId: field(formData, "sourceLocationId"),
      destinationLocationId: field(formData, "destinationLocationId"),
      employeeId: field(formData, "employeeId"),
      lines: [
        {
          variantId: field(formData, "variantId"),
          quantity: field(formData, "quantity"),
        },
      ],
      notes: field(formData, "notes") || null,
    },
  );
}

export async function transitionInventoryTransferAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformTransitionInventoryTransfer($input: TransitionInventoryTransferInput!) {
      transitionInventoryTransfer(input: $input) { id status replayed reference }
    }
  `,
    "transitionInventoryTransfer",
    {
      businessId: field(formData, "businessId"),
      transferId: field(formData, "transferId"),
      employeeId: field(formData, "employeeId"),
      nextStatus: field(formData, "nextStatus"),
      notes: field(formData, "notes") || null,
    },
  );
}

export async function configureCatalogItemAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureCatalogItem($input: ConfigureCatalogItemInput!) {
      configureCatalogItem(input: $input) { id status replayed reference }
    }
  `,
    "configureCatalogItem",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      title: field(formData, "title"),
      handle: field(formData, "handle"),
      status: field(formData, "status"),
      regulatedSaleType: field(formData, "regulatedSaleType"),
      minimumAge: field(formData, "minimumAge")
        ? integer(formData, "minimumAge")
        : null,
      preparedFood: field(formData, "preparedFood") === "true",
      discountable: field(formData, "discountable") !== "false",
      returnable: field(formData, "returnable") !== "false",
      taxCategoryId: field(formData, "taxCategoryId") || null,
      categoryName: field(formData, "categoryName") || null,
      categoryCode: field(formData, "categoryCode") || null,
      variantTitle: field(formData, "variantTitle"),
      sku: field(formData, "sku"),
      sellBy: field(formData, "sellBy"),
      unitOfMeasure: field(formData, "unitOfMeasure"),
      defaultPriceCents: integer(formData, "defaultPriceCents"),
      costCents: field(formData, "costCents")
        ? integer(formData, "costCents")
        : null,
      trackInventory: field(formData, "trackInventory") !== "false",
      allowNegativeInventory:
        field(formData, "allowNegativeInventory") === "true",
      barcode: field(formData, "barcode") || null,
      barcodeFormat: field(formData, "barcodeFormat") || null,
      priceBookId: field(formData, "priceBookId") || null,
    },
  );
}

export async function configureStoreTaxRateAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureTaxRate($input: ConfigureStoreTaxRateInput!) {
      configureStoreTaxRate(input: $input) { id status replayed reference }
    }
  `,
    "configureStoreTaxRate",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      categoryName: field(formData, "categoryName"),
      categoryCode: field(formData, "categoryCode"),
      rateName: field(formData, "rateName"),
      jurisdiction: field(formData, "jurisdiction"),
      rateBasisPoints: integer(formData, "rateBasisPoints"),
      inclusive: field(formData, "inclusive") === "true",
    },
  );
}

export async function configurePromotionAction(formData: FormData) {
  const productId = field(formData, "productId");
  const categoryId = field(formData, "categoryId");
  return executeOperation(
    formData,
    `
    mutation PlatformConfigurePromotion($input: ConfigurePromotionInput!) {
      configurePromotion(input: $input) { id status replayed reference }
    }
  `,
    "configurePromotion",
    {
      businessId: field(formData, "businessId"),
      storeIds: [field(formData, "storeId")],
      name: field(formData, "name"),
      code: field(formData, "code") || null,
      status: field(formData, "status"),
      startsAt: field(formData, "startsAt") || null,
      endsAt: field(formData, "endsAt") || null,
      stackable: field(formData, "stackable") === "true",
      ruleType: field(formData, "ruleType"),
      benefitMethod: field(formData, "benefitMethod"),
      valueBasisPoints: field(formData, "valueBasisPoints")
        ? integer(formData, "valueBasisPoints")
        : null,
      valueCents: field(formData, "valueCents")
        ? integer(formData, "valueCents")
        : null,
      minQuantity: field(formData, "minQuantity") || null,
      productIds: productId ? [productId] : [],
      categoryIds: categoryId ? [categoryId] : [],
      usageLimit: optionalInteger(formData, "usageLimit"),
      perCustomerLimit: optionalInteger(formData, "perCustomerLimit"),
    },
  );
}

export async function configureVendorAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureVendor($input: ConfigureVendorInput!) {
      configureVendor(input: $input) { id status replayed reference }
    }
  `,
    "configureVendor",
    {
      businessId: field(formData, "businessId"),
      name: field(formData, "name"),
      vendorNumber: field(formData, "vendorNumber"),
      paymentTerms: field(formData, "paymentTerms"),
      contactName: field(formData, "contactName") || null,
      email: field(formData, "email") || null,
      phone: field(formData, "phone") || null,
      leadTimeDays: integer(formData, "leadTimeDays") || 0,
      minimumOrderCents: integer(formData, "minimumOrderCents") || 0,
    },
  );
}

export async function configureVendorItemAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureVendorItem($input: ConfigureVendorItemInput!) {
      configureVendorItem(input: $input) { id status replayed reference }
    }
  `,
    "configureVendorItem",
    {
      businessId: field(formData, "businessId"),
      vendorId: field(formData, "vendorId"),
      variantId: field(formData, "variantId"),
      vendorSku: field(formData, "vendorSku"),
      casePackQuantity: field(formData, "casePackQuantity"),
      unitsPerCase: integer(formData, "unitsPerCase"),
      unitCostCents: integer(formData, "unitCostCents"),
      leadTimeDays: field(formData, "leadTimeDays")
        ? integer(formData, "leadTimeDays")
        : null,
    },
  );
}

export async function createPurchaseOrderAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformDraftPurchaseOrder($input: DraftPurchaseOrderInput!) {
      draftPurchaseOrder(input: $input) { id status replayed reference }
    }
  `,
    "draftPurchaseOrder",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      vendorId: field(formData, "vendorId"),
      employeeId: field(formData, "employeeId"),
      expectedAt: field(formData, "expectedAt") || null,
      notes: field(formData, "notes") || null,
      lines: [
        {
          variantId: field(formData, "variantId"),
          vendorItemId: field(formData, "vendorItemId") || null,
          quantityOrdered: field(formData, "quantityOrdered"),
          unitCostCents: field(formData, "unitCostCents")
            ? integer(formData, "unitCostCents")
            : null,
        },
      ],
    },
  );
}

export async function receivePurchaseOrderAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformReceivePurchaseOrder($input: ReceivePurchaseOrderInput!) {
      receivePurchaseOrder(input: $input) { id status replayed reference }
    }
  `,
    "receivePurchaseOrder",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      purchaseOrderId: field(formData, "purchaseOrderId"),
      locationId: field(formData, "locationId"),
      employeeId: field(formData, "employeeId"),
      vendorDocumentNumber: field(formData, "vendorDocumentNumber") || null,
      discrepancyNotes: field(formData, "discrepancyNotes") || null,
      lines: [
        {
          purchaseOrderLineId: field(formData, "purchaseOrderLineId"),
          quantityAccepted: field(formData, "quantityAccepted"),
          acceptedUnitCostCents: integer(formData, "acceptedUnitCostCents"),
          quantityRejected: field(formData, "quantityRejected") || "0",
          rejectionReason: field(formData, "rejectionReason") || "none",
          lotNumber: field(formData, "lotNumber") || null,
          expiresAt: field(formData, "expiresAt") || null,
          notes: field(formData, "lineNotes") || null,
        },
      ],
    },
  );
}

export async function transitionPurchaseOrderAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformPurchaseOrder($input: TransitionPurchaseOrderInput!) {
      transitionPurchaseOrder(input: $input) { id status replayed reference }
    }
  `,
    "transitionPurchaseOrder",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      purchaseOrderId: field(formData, "purchaseOrderId"),
      employeeId: field(formData, "employeeId"),
      nextStatus: field(formData, "nextStatus"),
    },
  );
}

export async function setRetailPriceAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformSetRetailPrice($input: SetRetailPriceInput!) {
      setRetailPrice(input: $input) { id status replayed reference }
    }
  `,
    "setRetailPrice",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      priceBookId: field(formData, "priceBookId"),
      variantId: field(formData, "variantId"),
      amountCents: integer(formData, "amountCents"),
      minQuantity: field(formData, "minQuantity") || "1",
      startsAt: field(formData, "startsAt"),
      endsAt: field(formData, "endsAt") || null,
    },
  );
}

export async function configureAgePolicyAction(formData: FormData) {
  const productId = field(formData, "productId");
  const categoryId = field(formData, "categoryId");
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureAgePolicy($input: ConfigureAgeRestrictionPolicyInput!) {
      configureAgeRestrictionPolicy(input: $input) { id status replayed reference }
    }
  `,
    "configureAgeRestrictionPolicy",
    {
      businessId: field(formData, "businessId"),
      storeIds: [field(formData, "storeId")],
      name: field(formData, "name"),
      code: field(formData, "code"),
      jurisdiction: field(formData, "jurisdiction"),
      status: field(formData, "status"),
      minimumAge: integer(formData, "minimumAge"),
      idCheckThresholdAge: field(formData, "idCheckThresholdAge")
        ? integer(formData, "idCheckThresholdAge")
        : null,
      managerOverrideAllowed:
        field(formData, "managerOverrideAllowed") === "true",
      scanRequired: field(formData, "scanRequired") === "true",
      productIds: productId ? [productId] : [],
      categoryIds: categoryId ? [categoryId] : [],
      startsAt: field(formData, "startsAt") || null,
      endsAt: field(formData, "endsAt") || null,
    },
  );
}

export async function verifyAgeAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformVerifyAge($input: VerifyRestrictedSaleAgeInput!) {
      verifyRestrictedSaleAge(input: $input) { id status replayed reference }
    }
  `,
    "verifyRestrictedSaleAge",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      policyId: field(formData, "policyId"),
      cartId: field(formData, "cartId") || null,
      saleId: field(formData, "saleId") || null,
      employeeId: field(formData, "employeeId"),
      outcome: field(formData, "outcome"),
      method: field(formData, "method"),
      ageAtVerification: integer(formData, "ageAtVerification"),
      documentType: field(formData, "documentType") || null,
      documentFingerprint: field(formData, "documentFingerprint") || null,
      overrideReason: field(formData, "overrideReason") || null,
      managerPin: optionalField(formData, "managerPin"),
    },
  );
}

export async function transitionComplianceIncidentAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformTransitionComplianceIncident($input: TransitionComplianceIncidentInput!) {
      transitionComplianceIncident(input: $input) { id status replayed reference }
    }
  `,
    "transitionComplianceIncident",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      incidentId: field(formData, "incidentId"),
      employeeId: field(formData, "employeeId"),
      nextStatus: field(formData, "nextStatus"),
      resolution: field(formData, "resolution"),
    },
  );
}

export async function configurePreparedFoodRecipeAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureRecipe($input: ConfigurePreparedFoodRecipeInput!) {
      configurePreparedFoodRecipe(input: $input) { id status replayed reference }
    }
  `,
    "configurePreparedFoodRecipe",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      name: field(formData, "name"),
      code: field(formData, "code"),
      outputVariantId: field(formData, "outputVariantId"),
      yieldQuantity: field(formData, "yieldQuantity"),
      yieldUnit: field(formData, "yieldUnit"),
      inputVariantId: field(formData, "inputVariantId"),
      ingredientName: field(formData, "ingredientName"),
      ingredientQuantity: field(formData, "ingredientQuantity"),
      ingredientUnit: field(formData, "ingredientUnit"),
      instructions: field(formData, "instructions") || null,
      allergenNotes: field(formData, "allergenNotes") || null,
    },
  );
}

export async function startPrepBatchAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformStartPrep($input: StartPrepBatchInput!) {
      startPrepBatch(input: $input) { id status replayed reference }
    }
  `,
    "startPrepBatch",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      recipeId: field(formData, "recipeId"),
      employeeId: field(formData, "employeeId"),
      quantityPlanned: field(formData, "quantityPlanned"),
      expiresAt: field(formData, "expiresAt") || null,
      notes: field(formData, "notes") || null,
    },
  );
}

export async function completePrepBatchAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformCompletePrep($input: CompletePrepBatchInput!) {
      completePrepBatch(input: $input) { id status replayed reference }
    }
  `,
    "completePrepBatch",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      prepBatchId: field(formData, "prepBatchId"),
      locationId: field(formData, "locationId"),
      employeeId: field(formData, "employeeId"),
      quantityMade: field(formData, "quantityMade"),
      lotNumber: field(formData, "lotNumber") || null,
      expiresAt: field(formData, "expiresAt") || null,
    },
  );
}

export async function recordWasteAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformWaste($input: RecordWasteEventInput!) {
      recordWasteEvent(input: $input) { id status replayed reference }
    }
  `,
    "recordWasteEvent",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      locationId: field(formData, "locationId"),
      variantId: field(formData, "variantId"),
      prepBatchId: field(formData, "prepBatchId") || null,
      employeeId: field(formData, "employeeId"),
      reason: field(formData, "reason"),
      quantity: field(formData, "quantity"),
      notes: field(formData, "notes") || null,
    },
  );
}

export async function configureLoyaltyProgramAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureLoyalty($input: ConfigureLoyaltyProgramInput!) {
      configureLoyaltyProgram(input: $input) { id status replayed reference }
    }
  `,
    "configureLoyaltyProgram",
    {
      businessId: field(formData, "businessId"),
      name: field(formData, "name"),
      code: field(formData, "code"),
      status: field(formData, "status"),
      pointsPerDollar: integer(formData, "pointsPerDollar"),
      redemptionPoints: integer(formData, "redemptionPoints"),
      redemptionValueCents: integer(formData, "redemptionValueCents"),
      pointsExpireAfterDays: field(formData, "pointsExpireAfterDays")
        ? integer(formData, "pointsExpireAfterDays")
        : null,
    },
  );
}

export async function enrollLoyaltyAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformEnrollLoyalty($input: EnrollLoyaltyAccountInput!) {
      enrollLoyaltyAccount(input: $input) { id status replayed reference }
    }
  `,
    "enrollLoyaltyAccount",
    {
      businessId: field(formData, "businessId"),
      programId: field(formData, "programId"),
      email: field(formData, "email") || null,
      phone: field(formData, "phone") || null,
      marketingOptIn: field(formData, "marketingOptIn") === "true",
    },
  );
}

export async function adjustLoyaltyAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformLoyalty($input: AdjustLoyaltyPointsInput!) {
      adjustLoyaltyPoints(input: $input) { id status replayed reference }
    }
  `,
    "adjustLoyaltyPoints",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId") || null,
      accountId: field(formData, "accountId"),
      employeeId: field(formData, "employeeId"),
      pointsDelta: integer(formData, "pointsDelta"),
      description: field(formData, "description"),
    },
  );
}

export async function applyLoyaltyRedemptionAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformApplyLoyaltyRedemption($input: ApplyLoyaltyRedemptionToCartInput!) {
      applyLoyaltyRedemptionToCart(input: $input) { id status replayed reference }
    }
  `,
    "applyLoyaltyRedemptionToCart",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      cartId: field(formData, "cartId"),
      points: integer(formData, "points"),
    },
  );
}

export async function expireLoyaltyPointsAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformExpireLoyalty($input: ExpireLoyaltyPointsInput!) {
      expireLoyaltyPoints(input: $input) { id status replayed reference }
    }
  `,
    "expireLoyaltyPoints",
    {
      businessId: field(formData, "businessId"),
      accountId: field(formData, "accountId"),
      asOf: field(formData, "asOf"),
    },
  );
}

export async function generateStoreDayAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformStoreDay($input: GenerateStoreDayReconciliationInput!) {
      generateStoreDayReconciliation(input: $input) { id status replayed reference }
    }
  `,
    "generateStoreDayReconciliation",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      tradingDate: field(formData, "tradingDate"),
      periodStartedAt: field(formData, "periodStartedAt"),
      periodEndedAt: field(formData, "periodEndedAt"),
    },
  );
}

export async function approveStoreDayAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformApproveDay($input: ApproveStoreDayReconciliationInput!) {
      approveStoreDayReconciliation(input: $input) { id status replayed reference }
    }
  `,
    "approveStoreDayReconciliation",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      storeDayId: field(formData, "storeDayId"),
      employeeId: field(formData, "employeeId"),
      lock: field(formData, "lock") === "true",
      notes: field(formData, "notes") || null,
    },
  );
}

export async function prepareDepositAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformPrepareDeposit($input: PrepareBankDepositInput!) {
      prepareBankDeposit(input: $input) { id status replayed reference }
    }
  `,
    "prepareBankDeposit",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      storeDayId: field(formData, "storeDayId"),
      employeeId: field(formData, "employeeId"),
      amountCents: integer(formData, "amountCents"),
      bagReference: field(formData, "bagReference"),
      notes: field(formData, "notes") || null,
    },
  );
}

export async function transitionDepositAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformTransitionDeposit($input: TransitionBankDepositInput!) {
      transitionBankDeposit(input: $input) { id status replayed reference }
    }
  `,
    "transitionBankDeposit",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      depositId: field(formData, "depositId"),
      employeeId: field(formData, "employeeId"),
      nextStatus: field(formData, "nextStatus"),
      bankReference: field(formData, "bankReference") || null,
      notes: field(formData, "notes") || null,
    },
  );
}

export async function configureLotteryGameAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureLotteryGame($input: ConfigureLotteryGameInput!) {
      configureLotteryGame(input: $input) { id status replayed reference }
    }
  `,
    "configureLotteryGame",
    {
      businessId: field(formData, "businessId"),
      name: field(formData, "name"),
      gameCode: field(formData, "gameCode"),
      jurisdictionCode: field(formData, "jurisdictionCode"),
      operatorName: field(formData, "operatorName"),
      ticketPriceCents: integer(formData, "ticketPriceCents"),
      ticketsPerPack: integer(formData, "ticketsPerPack"),
    },
  );
}

export async function receiveLotteryPackAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformReceiveLotteryPack($input: ReceiveLotteryPackInput!) {
      receiveLotteryPack(input: $input) { id status replayed reference }
    }
  `,
    "receiveLotteryPack",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      gameId: field(formData, "gameId"),
      employeeId: field(formData, "employeeId"),
      packNumber: field(formData, "packNumber"),
      firstTicketNumber: integer(formData, "firstTicketNumber"),
      lastTicketNumber: integer(formData, "lastTicketNumber"),
    },
  );
}

export async function activateLotteryPackAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformActivateLotteryPack($input: ActivateLotteryPackInput!) {
      activateLotteryPack(input: $input) { id status replayed reference }
    }
  `,
    "activateLotteryPack",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      packId: field(formData, "packId"),
      employeeId: field(formData, "employeeId"),
    },
  );
}

export async function recordLotteryPackSaleAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformRecordLotterySale($input: RecordLotteryPackSaleInput!) {
      recordLotteryPackSale(input: $input) { id status replayed reference }
    }
  `,
    "recordLotteryPackSale",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      packId: field(formData, "packId"),
      registerSessionId: field(formData, "registerSessionId"),
      employeeId: field(formData, "employeeId"),
      firstTicketNumber: integer(formData, "firstTicketNumber"),
      lastTicketNumber: integer(formData, "lastTicketNumber"),
      cashAmountCents: integer(formData, "cashAmountCents"),
      occurredAt: field(formData, "occurredAt") || null,
    },
  );
}

export async function closeLotteryPackAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformCloseLotteryPack($input: CloseLotteryPackInput!) {
      closeLotteryPack(input: $input) { id status replayed reference }
    }
  `,
    "closeLotteryPack",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      packId: field(formData, "packId"),
      employeeId: field(formData, "employeeId"),
      disposition: field(formData, "disposition"),
      reason: field(formData, "reason"),
    },
  );
}

export async function generateLotterySettlementAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformGenerateLotterySettlement($input: GenerateLotterySettlementInput!) {
      generateLotterySettlement(input: $input) { id status replayed reference }
    }
  `,
    "generateLotterySettlement",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      tradingDate: field(formData, "tradingDate"),
      operatorName: field(formData, "operatorName"),
      periodStartedAt: field(formData, "periodStartedAt"),
      periodEndedAt: field(formData, "periodEndedAt"),
      onlineSalesCents: integer(formData, "onlineSalesCents") || 0,
      payoutCents: integer(formData, "payoutCents") || 0,
      commissionCents: integer(formData, "commissionCents") || 0,
      reportedSettlementCents: integer(formData, "reportedSettlementCents"),
    },
  );
}

export async function approveLotterySettlementAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformApproveLotterySettlement($input: ApproveLotterySettlementInput!) {
      approveLotterySettlement(input: $input) { id status replayed reference }
    }
  `,
    "approveLotterySettlement",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      settlementId: field(formData, "settlementId"),
      employeeId: field(formData, "employeeId"),
      notes: field(formData, "notes") || null,
    },
  );
}

export async function configureMoneyServiceProviderAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureMoneyProvider($input: ConfigureMoneyServiceProviderInput!) {
      configureMoneyServiceProvider(input: $input) { id status replayed reference }
    }
  `,
    "configureMoneyServiceProvider",
    {
      businessId: field(formData, "businessId"),
      name: field(formData, "name"),
      code: field(formData, "code"),
      serviceType: field(formData, "serviceType"),
      adapterKey: field(formData, "adapterKey"),
      externalAgentReference: field(formData, "externalAgentReference") || null,
      jurisdictionCode: field(formData, "jurisdictionCode") || null,
      credentialReference: field(formData, "credentialReference") || null,
      configuration: {},
      storeIds: [field(formData, "storeId")],
    },
  );
}

export async function recordMoneyServiceTransactionAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformRecordMoneyTransaction($input: RecordExternalMoneyServiceTransactionInput!) {
      recordExternalMoneyServiceTransaction(input: $input) { id status replayed reference }
    }
  `,
    "recordExternalMoneyServiceTransaction",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      providerId: field(formData, "providerId"),
      registerSessionId: field(formData, "registerSessionId") || null,
      employeeId: field(formData, "employeeId"),
      serviceType: field(formData, "serviceType"),
      externalTransactionReference: field(
        formData,
        "externalTransactionReference",
      ),
      cashDirection: field(formData, "cashDirection"),
      faceAmountCents: integer(formData, "faceAmountCents"),
      feeCents: integer(formData, "feeCents") || 0,
      cashAmountCents: integer(formData, "cashAmountCents") || 0,
      providerSettlementCents: integer(formData, "providerSettlementCents"),
      occurredAt: field(formData, "occurredAt"),
    },
  );
}

export async function voidMoneyServiceTransactionAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformVoidMoneyTransaction($input: VoidExternalMoneyServiceTransactionInput!) {
      voidExternalMoneyServiceTransaction(input: $input) { id status replayed reference }
    }
  `,
    "voidExternalMoneyServiceTransaction",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      transactionId: field(formData, "transactionId"),
      employeeId: field(formData, "employeeId"),
      externalVoidReference: field(formData, "externalVoidReference"),
    },
  );
}

export async function generateMoneyServiceSettlementAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformGenerateMoneySettlement($input: GenerateMoneyServiceSettlementInput!) {
      generateMoneyServiceSettlement(input: $input) { id status replayed reference }
    }
  `,
    "generateMoneyServiceSettlement",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      providerId: field(formData, "providerId"),
      tradingDate: field(formData, "tradingDate"),
      periodStartedAt: field(formData, "periodStartedAt"),
      periodEndedAt: field(formData, "periodEndedAt"),
      reportedSettlementCents: integer(formData, "reportedSettlementCents"),
    },
  );
}

export async function approveMoneyServiceSettlementAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformApproveMoneySettlement($input: ApproveMoneyServiceSettlementInput!) {
      approveMoneyServiceSettlement(input: $input) { id status replayed reference }
    }
  `,
    "approveMoneyServiceSettlement",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      settlementId: field(formData, "settlementId"),
      employeeId: field(formData, "employeeId"),
      notes: field(formData, "notes") || null,
    },
  );
}

export async function configureExportDestinationAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigureExport($input: ConfigureExportDestinationInput!) {
      configureExportDestination(input: $input) { id status replayed reference }
    }
  `,
    "configureExportDestination",
    {
      businessId: field(formData, "businessId"),
      name: field(formData, "name"),
      code: field(formData, "code"),
      type: field(formData, "type"),
      adapterKey: field(formData, "adapterKey"),
      credentialReference: field(formData, "credentialReference") || null,
      configuration: {},
      storeIds: [field(formData, "storeId")],
    },
  );
}

export async function generateAccountingExportAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformGenerateAccountingExport($input: GenerateDailyAccountingExportInput!) {
      generateDailyAccountingExport(input: $input) { id status replayed reference }
    }
  `,
    "generateDailyAccountingExport",
    {
      businessId: field(formData, "businessId"),
      destinationId: field(formData, "destinationId"),
      employeeId: field(formData, "employeeId"),
      storeIds: [field(formData, "storeId")],
      periodStartedAt: field(formData, "periodStartedAt"),
      periodEndedAt: field(formData, "periodEndedAt"),
    },
  );
}

export async function transitionExportBatchAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformTransitionExport($input: TransitionExportBatchInput!) {
      transitionExportBatch(input: $input) { id status replayed reference }
    }
  `,
    "transitionExportBatch",
    {
      businessId: field(formData, "businessId"),
      batchId: field(formData, "batchId"),
      nextStatus: field(formData, "nextStatus"),
      externalReference: field(formData, "externalReference") || null,
      failureMessage: field(formData, "failureMessage") || null,
    },
  );
}

export async function replayOutboxEventAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformReplayOutbox($input: ReplayOutboxEventInput!) {
      replayOutboxEvent(input: $input) { id status replayed reference }
    }
  `,
    "replayOutboxEvent",
    {
      businessId: field(formData, "businessId"),
      eventId: field(formData, "eventId"),
    },
  );
}

export async function revokeMachineApiKeyAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformRevokeApiKey($input: RevokeBusinessApiKeyInput!) {
      revokeBusinessApiKey(input: $input) { id status replayed reference }
    }
  `,
    "revokeBusinessApiKey",
    {
      businessId: field(formData, "businessId"),
      apiKeyId: field(formData, "apiKeyId"),
    },
  );
}

export async function registerOfflineDeviceAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformRegisterOfflineDevice($input: RegisterOfflineDeviceInput!) {
      registerOfflineDevice(input: $input) { id status replayed reference }
    }
  `,
    "registerOfflineDevice",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      name: field(formData, "name"),
      deviceCode: field(formData, "deviceCode"),
      apiKeyId: field(formData, "apiKeyId") || null,
    },
  );
}

export async function transitionOfflineDeviceAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformTransitionOfflineDevice($input: TransitionOfflineDeviceInput!) {
      transitionOfflineDevice(input: $input) { id status replayed reference }
    }
  `,
    "transitionOfflineDevice",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      deviceId: field(formData, "deviceId"),
      nextStatus: field(formData, "nextStatus"),
    },
  );
}

export async function recordOfflineReplayBatchAction(formData: FormData) {
  const sequence = integer(formData, "sequence");
  const operationType = field(formData, "operationType");
  const operationIdempotencyKey = field(formData, "operationIdempotencyKey");
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(field(formData, "payload"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error();
    payload = parsed as Record<string, unknown>;
  } catch {
    const path = operationPath(formData);
    redirect(
      `${path}?error=${encodeURIComponent("Offline payload must be a JSON object")}`,
    );
  }
  return executeOperation(
    formData,
    `
    mutation PlatformRecordOfflineBatch($input: RecordOfflineReplayBatchInput!) {
      recordOfflineReplayBatch(input: $input) { id status replayed reference }
    }
  `,
    "recordOfflineReplayBatch",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      deviceId: field(formData, "deviceId"),
      batchNumber: field(formData, "batchNumber"),
      firstSequence: sequence,
      lastSequence: sequence,
      operations: [
        {
          sequence,
          operationType,
          operationIdempotencyKey,
          requestDigest: offlineOperationRequestDigest({
            operationType,
            operationIdempotencyKey,
            payload,
          }),
          payload,
        },
      ],
    },
  );
}

export async function configurePaymentProviderAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformConfigurePaymentProvider($input: ConfigurePaymentProviderInput!) {
      configurePaymentProvider(input: $input) { id status replayed reference }
    }
  `,
    "configurePaymentProvider",
    {
      businessId: field(formData, "businessId"),
      name: field(formData, "name"),
      code: field(formData, "code"),
      adapterKey: field(formData, "adapterKey"),
      credentialReference: field(formData, "credentialReference") || null,
      configuration: {},
      activate: field(formData, "activate") === "true",
    },
  );
}

export async function generatePaymentReconciliationAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformGeneratePaymentReconciliation($input: GeneratePaymentReconciliationInput!) {
      generatePaymentReconciliation(input: $input) { id status replayed reference }
    }
  `,
    "generatePaymentReconciliation",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      paymentProviderId: field(formData, "paymentProviderId"),
      periodStartedAt: field(formData, "periodStartedAt"),
      periodEndedAt: field(formData, "periodEndedAt"),
      reportedFeeCents: integer(formData, "reportedFeeCents"),
      reportedSettlementCents: integer(formData, "reportedSettlementCents"),
      notes: field(formData, "notes") || null,
    },
  );
}

export async function approvePaymentReconciliationAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformApprovePaymentReconciliation($input: ApprovePaymentReconciliationInput!) {
      approvePaymentReconciliation(input: $input) { id status replayed reference }
    }
  `,
    "approvePaymentReconciliation",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId"),
      reconciliationId: field(formData, "reconciliationId"),
      employeeId: field(formData, "employeeId"),
      notes: field(formData, "notes") || null,
    },
  );
}

export async function evaluateAlertsAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformEvaluateAlerts($input: EvaluateOperationalAlertsInput!) {
      evaluateOperationalAlerts(input: $input) { id status replayed reference }
    }
  `,
    "evaluateOperationalAlerts",
    {
      businessId: field(formData, "businessId"),
      storeId: field(formData, "storeId") || null,
      cashVarianceThresholdCents: integer(
        formData,
        "cashVarianceThresholdCents",
      ),
      fuelVarianceThresholdGallons: field(
        formData,
        "fuelVarianceThresholdGallons",
      ),
      expiryWindowDays: integer(formData, "expiryWindowDays"),
    },
  );
}

export async function transitionAlertAction(formData: FormData) {
  return executeOperation(
    formData,
    `
    mutation PlatformTransitionAlert($input: TransitionOperationalAlertInput!) {
      transitionOperationalAlert(input: $input) { id status replayed reference }
    }
  `,
    "transitionOperationalAlert",
    {
      businessId: field(formData, "businessId"),
      alertId: field(formData, "alertId"),
      employeeId: field(formData, "employeeId"),
      nextStatus: field(formData, "nextStatus"),
      notes: field(formData, "notes") || null,
    },
  );
}

import { mergeSchemas } from "@graphql-tools/schema";
import type { GraphQLSchema } from "graphql";
import type { Context } from ".keystone/types";

import { hasPermission, isHumanPlatformAdmin, type Session } from "../access";

import {
  evaluateOperationalAlerts,
  transitionOperationalAlert,
} from "./alertOperations";
import { createBusinessApiKey, revokeBusinessApiKey } from "./apiKeyOperations";
import { configureBusinessBrand } from "./businessOperations";
import {
  closeEmployeeShift,
  closeRegisterSession,
  openEmployeeShift,
  openRegisterSession,
  recordCashMovement,
} from "./cashOperations";
import {
  configureCatalogItem,
  configurePromotion,
  configureStoreTaxRate,
} from "./catalogOperations";
import {
  configureAgeRestrictionPolicy,
  transitionComplianceIncident,
  verifyRestrictedSaleAge,
} from "./complianceOperations";
import {
  configureExportDestination,
  downloadExportArtifact,
  generateDailyAccountingExport,
  transitionExportBatch,
} from "./exportOperations";
import { setOwnPosPin } from "./employeeSecurityOperations";
import {
  completePrepBatch,
  configurePreparedFoodRecipe,
  recordWasteEvent,
  startPrepBatch,
} from "./foodserviceOperations";
import {
  approveFuelReconciliation,
  configureFuelTopology,
  generateFuelReconciliation,
  recordFuelTankReading,
  setFuelPrice,
} from "./fuelControlOperations";
import {
  authorizeFuelPayment,
  cancelFuelPaymentAuthorization,
  completeFuelTransaction,
  recordFuelDelivery,
} from "./fuelOperations";
import { recordOperationalHeartbeat } from "./heartbeatOperations";
import {
  approveInventoryCount,
  startInventoryCount,
  postInventoryAdjustment,
  receivePurchaseOrder,
  recordInventoryCountLine,
  transitionInventoryCount,
} from "./inventoryOperations";
import {
  activateLotteryPack,
  approveLotterySettlement,
  closeLotteryPack,
  configureLotteryGame,
  generateLotterySettlement,
  receiveLotteryPack,
  recordLotteryPackSale,
} from "./lotteryOperations";
import {
  adjustLoyaltyPoints,
  applyLoyaltyRedemptionToCart,
  configureLoyaltyProgram,
  enrollLoyaltyAccount,
  expireLoyaltyPoints,
} from "./loyaltyOperations";
import {
  approveMoneyServiceSettlement,
  configureMoneyServiceProvider,
  generateMoneyServiceSettlement,
  recordExternalMoneyServiceTransaction,
  voidExternalMoneyServiceTransaction,
} from "./moneyServiceOperations";
import onboardConvenienceBusiness from "./onboardConvenienceBusiness";
import { posOperationOutcome } from "./operationRunner";
import {
  recordOfflineReplayBatch,
  registerOfflineDevice,
  transitionOfflineDevice,
} from "./offlineOperations";
import {
  approvePaymentReconciliation,
  configurePaymentProvider,
  generatePaymentReconciliation,
} from "./paymentOperations";
import {
  claimOutboxEvents,
  completeOutboxEvent,
  replayOutboxEvent,
} from "./outboxOperations";
import {
  addPosCartLine,
  completePosSale,
  createPosCart,
  removePosCartLine,
  transitionPosCart,
  updatePosCartLine,
} from "./posOperations";
import {
  conveniencePlatformNavigation,
  conveniencePlatformProjection,
} from "./platformProjection";
import { conveniencePublicStorefrontProjection } from "./publicStorefrontProjection";
import { setRetailPrice } from "./pricingOperations";
import { applyPromotionToCart } from "./promotionOperations";
import {
  configureVendor,
  configureVendorItem,
  draftPurchaseOrder,
  transitionPurchaseOrder,
} from "./purchasingOperations";
import {
  approveStoreDayReconciliation,
  generateStoreDayReconciliation,
  prepareBankDeposit,
  transitionBankDeposit,
} from "./reconciliationOperations";
import { convenienceReportingSummary } from "./reportingOperations";
import { refundPosSale } from "./refundOperations";
import { revokeCurrentUserSessions } from "./sessionOperations";
import {
  posSaleReceipt,
  voidCompletedPosSale,
} from "./saleLifecycleOperations";
import {
  draftInventoryTransfer,
  transitionInventoryTransfer,
} from "./transferOperations";
import redirectToInit from "./redirectToInit";
import { storefrontCatalog, storefrontBasket, updateStorefrontBasket, storefrontHistory } from "./storefrontOperations";

const graphql = String.raw;

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
      type Query {
        storefrontCatalog(search: String, category: String, page: Int, productId: ID): JSON!
        storefrontBasket(cartId: ID!, token: String!): JSON
        storefrontHistory(saleId: ID): JSON!
        redirectToInit: Boolean!
        assistantCapability: Boolean!
        conveniencePlatformProjection(
          input: ConveniencePlatformProjectionInput!
        ): ConveniencePlatformProjection!
        conveniencePlatformNavigation: ConveniencePlatformNavigation!
        conveniencePublicStorefront: ConveniencePublicStorefrontProjection!
        convenienceReportingSummary(
          input: ConvenienceReportingSummaryInput!
        ): ConvenienceReportingSummary!
        posSaleReceipt(input: PosSaleReceiptInput!): JSON!
        posOperationOutcome(
          input: PosOperationOutcomeInput!
        ): PosOperationOutcome!
        downloadExportArtifact(
          input: DownloadExportArtifactInput!
        ): ExportArtifact!
      }

      enum ConveniencePlatformSurface {
        overview
        store_settings
        pos
        fuel
        inventory
        purchasing
        pricing
        compliance
        foodservice
        loyalty
        payments
        lottery
        money_services
        reconciliation
        reports
        exports
        recovery
        exceptions
      }

      type ConveniencePlatformOption {
        id: ID!
        label: String!
        detail: String
      }

      type ConvenienceStorefrontLocation {
        id: ID!
        name: String!
        addressLine1: String!
        addressLine2: String!
        city: String!
        stateProvince: String!
        postalCode: String!
        countryCode: String!
        phone: String!
        hours: JSON!
      }

      type ConvenienceBrand {
        name: String!
        tagline: String!
        mark: String!
        logoIcon: String!
        logoColor: String!
        primaryColor: String!
        accentColor: String!
        storefrontMode: BusinessStorefrontModeType!
        storefrontStatus: BusinessStorefrontStatusType!
        store: ConvenienceStorefrontLocation
      }

      enum ConveniencePublicStorefrontState {
        unset
        unpublished
        published
        unavailable
      }

      type ConveniencePublicStorefrontIdentity {
        name: String!
        tagline: String!
        mark: String!
        logoIcon: String!
        logoColor: String!
        primaryColor: String!
        accentColor: String!
      }

      type ConveniencePublicStorefrontLocation {
        name: String!
        addressLine1: String!
        addressLine2: String!
        city: String!
        stateProvince: String!
        postalCode: String!
        countryCode: String!
        phone: String!
        hours: JSON!
      }

      type ConveniencePublicStorefrontProduct {
        id: ID!
        title: String!
        summary: String!
        preparedFood: Boolean!
      }

      type ConveniencePublicStorefrontCategory {
        id: ID!
        name: String!
        description: String!
        products: [ConveniencePublicStorefrontProduct!]!
      }

      type ConveniencePublicStorefrontProjection {
        state: ConveniencePublicStorefrontState!
        mode: BusinessStorefrontModeType
        identity: ConveniencePublicStorefrontIdentity
        location: ConveniencePublicStorefrontLocation
        categories: [ConveniencePublicStorefrontCategory!]!
      }

      type ConveniencePlatformMetric {
        label: String!
        value: String!
        detail: String!
        tone: String!
      }

      type ConveniencePlatformRow {
        id: ID!
        title: String!
        detail: String!
        status: String!
        metric: String!
        occurredAt: String
      }

      type ConveniencePlatformProjection {
        surface: ConveniencePlatformSurface!
        businessId: ID
        storeId: ID
        generatedAt: String!
        limit: Int!
        brand: ConvenienceBrand
        businesses: [ConveniencePlatformOption!]!
        stores: [ConveniencePlatformOption!]!
        metrics: [ConveniencePlatformMetric!]!
        rows: [ConveniencePlatformRow!]!
        controls: JSON!
      }

      type ConveniencePlatformNavigation {
        surfaces: [ConveniencePlatformSurface!]!
        canReadPeople: Boolean!
        canManageRoles: Boolean!
        canReadCatalog: Boolean!
        canReadPricing: Boolean!
        canReadPricingAtStore: Boolean!
        canReadPromotions: Boolean!
      }

      input ConveniencePlatformProjectionInput {
        surface: ConveniencePlatformSurface!
        businessId: ID
        storeId: ID
        limit: Int
        variantSearch: String
        vendorItemSearch: String
        vendorSearch: String
        purchaseOrderSearch: String
        purchaseOrderLineSearch: String
        receiptSearch: String
        refundHistorySearch: String
        voidReceiptSearch: String
        posVariantSearch: String
        posCartSearch: String
        loyaltyAccountSearch: String
        recipeCodeSearch: String
        foodserviceSkuSearch: String
        foodserviceLocationCodeSearch: String
        foodserviceBatchNumberSearch: String
        foodserviceEmployeeNumberSearch: String
        inventoryCountSearch: String
        inventoryLocationSearch: String
        inventoryVariantSearch: String
        inventoryTransferSearch: String
      }

      type ExportArtifact {
        filename: String!
        contentType: String!
        checksum: String!
        content: String!
      }

      input DownloadExportArtifactInput {
        businessId: ID!
        batchId: ID!
      }

      type OperationalHeartbeatResult {
        kind: String!
        status: String!
        occurredAt: String!
      }

      input RecordOperationalHeartbeatInput {
        businessId: ID!
        kind: String!
        workerId: String!
        status: String!
        details: JSON
      }

      type OperationResult {
        id: ID!
        status: String!
        replayed: Boolean!
        reference: String
      }

      enum PosOperationScope {
        createPosCart
        addPosCartLine
        completePosSale
        refundPosSale
        closeRegisterSession
      }

      input PosOperationOutcomeInput {
        businessId: ID!
        storeId: ID!
        scope: PosOperationScope!
        idempotencyKey: String!
        command: JSON
      }

      type PosOperationOutcome {
        state: String!
        retryable: Boolean!
        id: ID
        status: String
        reference: String
      }

      type OfflineReplayResult {
        id: ID!
        status: String!
        replayed: Boolean!
        reference: String
        acknowledgedSequence: Int!
      }

      type OnboardingResult {
        id: ID!
        status: String!
        replayed: Boolean!
        reference: String!
      }

      type ApiKeyOperationResult {
        id: ID!
        status: String!
        replayed: Boolean!
        reference: String
        token: String
      }

      type ClaimedOutboxEvent {
        id: ID!
        eventKey: String!
        topic: String!
        schemaVersion: Int!
        aggregateType: String!
        aggregateId: String!
        action: String!
        payload: JSON
        payloadHash: String!
        totalAttempts: Int!
      }

      type ClaimOutboxEventsResult {
        workerId: String!
        leaseToken: String!
        events: [ClaimedOutboxEvent!]!
      }

      enum OutboxCompletionOutcome {
        delivered
        retry
        dead_letter
      }

      type ConvenienceStoreReportingSummary {
        storeId: ID!
        storeName: String!
        dayCount: Int!
        grossSalesCents: String!
        discountCents: String!
        taxCents: String!
        totalSalesCents: String!
        refundCents: String!
        netReceiptsCents: String!
        cashTenderCents: String!
        nonCashTenderCents: String!
        fuelSalesCents: String!
        lotteryNetCents: String!
        moneyServiceNetCents: String!
        cashOverShortCents: String!
        depositedCashCents: String!
        saleCount: String!
        refundCount: String!
        exceptionCount: String!
      }

      type ConvenienceReportingSummary {
        businessId: ID!
        startDate: String!
        endDate: String!
        currencyCode: String!
        dayCount: Int!
        grossSalesCents: String!
        discountCents: String!
        taxCents: String!
        totalSalesCents: String!
        refundCents: String!
        netReceiptsCents: String!
        cashTenderCents: String!
        nonCashTenderCents: String!
        fuelSalesCents: String!
        lotteryNetCents: String!
        moneyServiceNetCents: String!
        cashOverShortCents: String!
        depositedCashCents: String!
        saleCount: String!
        refundCount: String!
        exceptionCount: String!
        stores: [ConvenienceStoreReportingSummary!]!
      }

      input PosSaleReceiptInput {
        businessId: ID!
        storeId: ID!
        saleId: ID!
      }

      input ConvenienceReportingSummaryInput {
        businessId: ID!
        startDate: String!
        endDate: String!
        storeIds: [ID!]
        currencyCode: String
      }

      input OnboardConvenienceBusinessInput {
        businessName: String!
        businessCode: String!
        storeName: String!
        storeCode: String!
        timezone: String
        currencyCode: String
        standardTaxBasisPoints: Int
        fuelEnabled: Boolean
        brandName: String
        brandTagline: String
        brandMark: String
        brandPrimaryColor: String
        brandAccentColor: String
        storefrontMode: BusinessStorefrontModeType
        storefrontStatus: BusinessStorefrontStatusType
        idempotencyKey: String!
      }

      input ConfigureBusinessBrandInput {
        businessId: ID!
        storeId: ID!
        brandName: String!
        brandTagline: String!
        brandMark: String!
        logoIcon: String
        logoColor: String
        themePreset: String!
        storefrontMode: BusinessStorefrontModeType!
        storefrontStatus: BusinessStorefrontStatusType!
        addressLine1: String!
        addressLine2: String!
        city: String!
        stateProvince: String!
        postalCode: String!
        countryCode: String!
        phone: String!
        publicHours: JSON!
        idempotencyKey: String!
      }

      input SetOwnPosPinInput {
        businessId: ID!
        storeId: ID!
        employeeId: ID!
        newPin: String!
        idempotencyKey: String!
      }

      input OpenEmployeeShiftInput {
        businessId: ID!
        storeId: ID!
        employeeId: ID!
        startsAt: String!
        endsAt: String!
        roleSnapshot: String
        idempotencyKey: String!
      }

      input CloseEmployeeShiftInput {
        businessId: ID!
        storeId: ID!
        shiftId: ID!
        notes: String
        idempotencyKey: String!
      }

      input OpenRegisterSessionInput {
        businessId: ID!
        storeId: ID!
        registerId: ID!
        employeeId: ID!
        shiftId: ID
        openingCashCents: Int!
        idempotencyKey: String!
      }

      input RecordCashMovementInput {
        businessId: ID!
        storeId: ID!
        registerSessionId: ID!
        employeeId: ID!
        type: CashMovementTypeType!
        direction: CashMovementDirectionType
        amountCents: Int!
        reason: String!
        idempotencyKey: String!
      }

      input CloseRegisterSessionInput {
        businessId: ID!
        storeId: ID!
        registerSessionId: ID!
        countedCashCents: Int!
        notes: String
        idempotencyKey: String!
        originalScope: JSON
      }

      input CreatePosCartInput {
        businessId: ID!
        storeId: ID!
        registerSessionId: ID!
        cashierId: ID!
        customerId: ID
        loyaltyAccountId: ID
        idempotencyKey: String!
      }

      input AddPosCartLineInput {
        businessId: ID!
        storeId: ID!
        cartId: ID!
        barcode: String
        variantId: ID
        quantity: String!
        idempotencyKey: String!
      }

      input UpdatePosCartLineInput {
        businessId: ID!
        storeId: ID!
        cartId: ID!
        cartLineId: ID!
        quantity: String!
        employeeId: ID!
        managerPin: String!
        reason: String!
        idempotencyKey: String!
      }

      input RemovePosCartLineInput {
        businessId: ID!
        storeId: ID!
        cartId: ID!
        cartLineId: ID!
        employeeId: ID!
        managerPin: String!
        reason: String!
        idempotencyKey: String!
      }

      input TransitionPosCartInput {
        businessId: ID!
        storeId: ID!
        cartId: ID!
        nextStatus: CartStatusType!
        reason: String
        idempotencyKey: String!
      }

      input PosTenderInput {
        method: TenderMethodType!
        amountCents: Int!
        tenderedCents: Int
        paymentProviderId: ID
        providerPaymentId: String
        providerAuthority: String
        cardBrand: String
        cardLast4: String
      }

      input CompletePosSaleInput {
        businessId: ID!
        storeId: ID!
        cartId: ID!
        tenders: [PosTenderInput!]!
        idempotencyKey: String!
      }

      input SetRetailPriceInput {
        businessId: ID!
        storeId: ID!
        priceBookId: ID!
        variantId: ID!
        amountCents: Int!
        minQuantity: String
        startsAt: String!
        endsAt: String
        idempotencyKey: String!
      }

      input ApplyPromotionToCartInput {
        businessId: ID!
        storeId: ID!
        cartId: ID!
        promotionId: ID!
        code: String
        idempotencyKey: String!
      }

      input RefundPosSaleLineInput {
        saleLineId: ID!
        quantity: String!
        disposition: ReturnLineDispositionType!
        condition: ReturnLineConditionType
        note: String
      }

      input RefundTenderAllocationInput {
        tenderId: ID!
        amountCents: Int!
        providerRefundId: String
        providerAuthority: String
      }

      input RefundPosSaleInput {
        businessId: ID!
        storeId: ID!
        saleId: ID!
        originalTenderId: ID
        tenderAllocations: [RefundTenderAllocationInput!]
        registerSessionId: ID!
        employeeId: ID!
        reason: RefundReasonType!
        returnReason: ReturnReasonType
        providerRefundId: String
        providerAuthority: String
        notes: String
        overrideNonReturnable: Boolean
        overrideReason: String
        managerPin: String
        lines: [RefundPosSaleLineInput!]!
        idempotencyKey: String!
      }

      input VoidCompletedPosSaleInput {
        businessId: ID!
        storeId: ID!
        saleId: ID!
        registerSessionId: ID!
        employeeId: ID!
        reason: String!
        managerPin: String!
        idempotencyKey: String!
      }

      input ConfigureAgeRestrictionPolicyInput {
        businessId: ID!
        storeIds: [ID!]!
        name: String!
        code: String!
        jurisdiction: String!
        status: CompliancePolicyStatusType!
        minimumAge: Int!
        idCheckThresholdAge: Int
        managerOverrideAllowed: Boolean
        scanRequired: Boolean
        productIds: [ID!]
        categoryIds: [ID!]
        startsAt: String
        endsAt: String
        idempotencyKey: String!
      }

      input VerifyRestrictedSaleAgeInput {
        businessId: ID!
        storeId: ID!
        policyId: ID!
        cartId: ID
        saleId: ID
        employeeId: ID!
        outcome: AgeVerificationOutcomeType!
        method: AgeVerificationMethodType!
        ageAtVerification: Int!
        documentType: String
        documentFingerprint: String
        overrideReason: String
        managerPin: String
        idempotencyKey: String!
      }

      input TransitionComplianceIncidentInput {
        businessId: ID!
        storeId: ID!
        incidentId: ID!
        employeeId: ID!
        nextStatus: ComplianceIncidentStatusType!
        resolution: String!
        idempotencyKey: String!
      }

      input ApplyLoyaltyRedemptionToCartInput {
        businessId: ID!
        storeId: ID!
        cartId: ID!
        points: Int!
        idempotencyKey: String!
      }

      input ExpireLoyaltyPointsInput {
        businessId: ID!
        accountId: ID!
        asOf: String!
        idempotencyKey: String!
      }

      input ConfigureLoyaltyProgramInput {
        businessId: ID!
        name: String!
        code: String!
        status: LoyaltyProgramStatusType!
        pointsPerDollar: Int!
        redemptionPoints: Int!
        redemptionValueCents: Int!
        pointsExpireAfterDays: Int
        idempotencyKey: String!
      }

      input EnrollLoyaltyAccountInput {
        businessId: ID!
        programId: ID!
        userId: ID
        email: String
        phone: String
        marketingOptIn: Boolean
        idempotencyKey: String!
      }

      input AdjustLoyaltyPointsInput {
        businessId: ID!
        storeId: ID
        accountId: ID!
        employeeId: ID!
        pointsDelta: Int!
        description: String!
        idempotencyKey: String!
      }

      input ConfigureCatalogItemInput {
        businessId: ID!
        storeId: ID!
        title: String!
        handle: String!
        status: ProductStatusType!
        regulatedSaleType: ProductRegulatedSaleTypeType!
        minimumAge: Int
        preparedFood: Boolean
        discountable: Boolean
        returnable: Boolean
        taxCategoryId: ID
        categoryName: String
        categoryCode: String
        variantTitle: String!
        sku: String!
        sellBy: ProductVariantSellByType!
        unitOfMeasure: ProductVariantUnitOfMeasureType!
        defaultPriceCents: Int!
        costCents: Int
        trackInventory: Boolean
        allowNegativeInventory: Boolean
        barcode: String
        barcodeFormat: ProductBarcodeFormatType
        priceBookId: ID
        idempotencyKey: String!
      }

      input ConfigureStoreTaxRateInput {
        businessId: ID!
        storeId: ID!
        categoryName: String!
        categoryCode: String!
        rateName: String!
        jurisdiction: String!
        rateBasisPoints: Int!
        inclusive: Boolean
        idempotencyKey: String!
      }

      input ConfigurePromotionInput {
        businessId: ID!
        storeIds: [ID!]!
        name: String!
        code: String
        status: PromotionStatusType!
        startsAt: String
        endsAt: String
        stackable: Boolean
        ruleType: PromotionRuleRuleTypeType!
        benefitMethod: PromotionRuleBenefitMethodType!
        valueBasisPoints: Int
        valueCents: Int
        minQuantity: String
        productIds: [ID!]
        categoryIds: [ID!]
        usageLimit: Int
        perCustomerLimit: Int
        idempotencyKey: String!
      }

      input ConfigureVendorInput {
        businessId: ID!
        name: String!
        vendorNumber: String!
        paymentTerms: VendorPaymentTermType!
        contactName: String
        email: String
        phone: String
        leadTimeDays: Int
        minimumOrderCents: Int
        idempotencyKey: String!
      }

      input ConfigureVendorItemInput {
        businessId: ID!
        vendorId: ID!
        variantId: ID!
        vendorSku: String!
        casePackQuantity: String!
        unitsPerCase: Int!
        unitCostCents: Int!
        leadTimeDays: Int
        idempotencyKey: String!
      }

      input DraftPurchaseOrderLineInput {
        variantId: ID!
        vendorItemId: ID
        quantityOrdered: String!
        unitCostCents: Int
      }

      input DraftPurchaseOrderInput {
        businessId: ID!
        storeId: ID!
        vendorId: ID!
        employeeId: ID!
        expectedAt: String
        notes: String
        lines: [DraftPurchaseOrderLineInput!]!
        idempotencyKey: String!
      }

      input TransitionPurchaseOrderInput {
        businessId: ID!
        storeId: ID!
        purchaseOrderId: ID!
        employeeId: ID!
        nextStatus: PurchaseOrderStatusType!
        idempotencyKey: String!
      }

      input ReceivePurchaseOrderLineInput {
        purchaseOrderLineId: ID!
        quantityAccepted: String!
        quantityRejected: String
        acceptedUnitCostCents: Int!
        rejectionReason: ReceivingLineRejectionReasonType
        lotNumber: String
        expiresAt: String
        notes: String
      }

      input ReceivePurchaseOrderInput {
        businessId: ID!
        storeId: ID!
        purchaseOrderId: ID!
        locationId: ID!
        employeeId: ID!
        vendorDocumentNumber: String
        discrepancyNotes: String
        lines: [ReceivePurchaseOrderLineInput!]!
        idempotencyKey: String!
      }

      input StartInventoryCountInput {
        businessId: ID!
        storeId: ID!
        locationId: ID!
        employeeId: ID!
        type: InventoryCountTypeType!
        variantIds: [ID!]
        notes: String
        idempotencyKey: String!
      }

      input RecordInventoryCountLineInput {
        businessId: ID!
        storeId: ID!
        countLineId: ID!
        employeeId: ID!
        actualQuantity: String!
        unitCostCents: Int
        lotNumber: String
        expiresAt: String
        reason: String
        idempotencyKey: String!
      }

      input PostInventoryAdjustmentInput {
        businessId: ID!
        storeId: ID!
        locationId: ID!
        variantId: ID!
        employeeId: ID!
        type: InventoryLedgerEntryTypeType!
        quantityDelta: String!
        unitCostCents: Int
        lotNumber: String
        expiresAt: String
        reason: String!
        idempotencyKey: String!
      }

      input TransitionInventoryCountInput {
        businessId: ID!
        storeId: ID!
        countId: ID!
        employeeId: ID!
        nextStatus: InventoryCountStatusType!
        idempotencyKey: String!
      }

      input ApproveInventoryCountInput {
        businessId: ID!
        storeId: ID!
        countId: ID!
        employeeId: ID!
        idempotencyKey: String!
      }

      input DraftInventoryTransferLineInput {
        variantId: ID!
        quantity: String!
      }

      input DraftInventoryTransferInput {
        businessId: ID!
        sourceStoreId: ID!
        destinationStoreId: ID!
        sourceLocationId: ID!
        destinationLocationId: ID!
        employeeId: ID!
        lines: [DraftInventoryTransferLineInput!]!
        notes: String
        idempotencyKey: String!
      }

      input TransitionInventoryTransferInput {
        businessId: ID!
        transferId: ID!
        employeeId: ID!
        nextStatus: InventoryTransferStatusType!
        notes: String
        idempotencyKey: String!
      }

      input ConfigurePreparedFoodRecipeInput {
        businessId: ID!
        storeId: ID!
        name: String!
        code: String!
        outputVariantId: ID!
        yieldQuantity: String!
        yieldUnit: String!
        inputVariantId: ID!
        ingredientName: String!
        ingredientQuantity: String!
        ingredientUnit: String!
        instructions: String
        allergenNotes: String
        idempotencyKey: String!
      }

      input StartPrepBatchInput {
        businessId: ID!
        storeId: ID!
        recipeId: ID!
        employeeId: ID!
        quantityPlanned: String!
        expiresAt: String
        notes: String
        idempotencyKey: String!
      }

      input CompletePrepBatchInput {
        businessId: ID!
        storeId: ID!
        prepBatchId: ID!
        locationId: ID!
        employeeId: ID!
        quantityMade: String!
        lotNumber: String
        expiresAt: String
        idempotencyKey: String!
      }

      input RecordWasteEventInput {
        businessId: ID!
        storeId: ID!
        locationId: ID!
        variantId: ID!
        lotId: ID
        prepBatchId: ID
        employeeId: ID!
        reason: WasteEventReasonType!
        quantity: String!
        notes: String
        idempotencyKey: String!
      }

      input RecordFuelDeliveryInput {
        businessId: ID!
        storeId: ID!
        siteId: ID!
        tankId: ID!
        vendorId: ID
        employeeId: ID!
        billOfLadingNumber: String
        grossVolumeGallons: String!
        netVolumeGallons: String!
        beforeVolumeGallons: String
        afterVolumeGallons: String
        unitCostMillsPerGallon: Int
        notes: String
        idempotencyKey: String!
      }

      input AuthorizeFuelPaymentInput {
        businessId: ID!
        storeId: ID!
        siteId: ID!
        registerSessionId: ID!
        employeeId: ID!
        method: TenderMethodType!
        priceTier: FuelPricePriceTierType!
        amountCents: Int!
        paymentProviderId: ID
        providerPaymentId: String
        providerAuthority: String
        idempotencyKey: String!
      }

      input CancelFuelPaymentAuthorizationInput {
        businessId: ID!
        storeId: ID!
        saleId: ID!
        employeeId: ID!
        reason: String!
        providerRefundId: String
        providerAuthority: String
        idempotencyKey: String!
      }

      input CompleteFuelTransactionInput {
        businessId: ID!
        storeId: ID!
        siteId: ID!
        pumpId: ID!
        nozzleId: ID!
        gradeId: ID!
        controllerTransactionId: String!
        priceTier: FuelPricePriceTierType!
        volumeGallons: String!
        saleId: ID!
        tenderId: ID!
        providerRefundId: String
        providerAuthority: String
        idempotencyKey: String!
      }

      input ConfigureFuelTopologyInput {
        businessId: ID!
        storeId: ID!
        siteName: String!
        siteCode: String!
        gradeName: String!
        gradeCode: String!
        octaneRating: Int
        tankNumber: String!
        tankCapacityGallons: String!
        initialVolumeGallons: String
        pumpNumber: String!
        nozzleNumber: String!
        idempotencyKey: String!
      }

      input SetFuelPriceInput {
        businessId: ID!
        storeId: ID!
        siteId: ID!
        gradeId: ID!
        employeeId: ID!
        priceTier: FuelPricePriceTierType!
        priceMillsPerGallon: Int!
        effectiveAt: String!
        idempotencyKey: String!
      }

      input RecordFuelTankReadingInput {
        businessId: ID!
        storeId: ID!
        siteId: ID!
        tankId: ID!
        employeeId: ID!
        source: FuelTankReadingSourceType!
        volumeGallons: String!
        waterVolumeGallons: String
        temperatureFahrenheit: String
        measuredAt: String!
        externalReference: String
        idempotencyKey: String!
      }

      input GenerateFuelReconciliationInput {
        businessId: ID!
        storeId: ID!
        siteId: ID!
        tankId: ID!
        openingReadingId: ID!
        closingReadingId: ID!
        employeeId: ID!
        periodStartedAt: String!
        periodEndedAt: String!
        toleranceGallons: String!
        notes: String
        idempotencyKey: String!
      }

      input ApproveFuelReconciliationInput {
        businessId: ID!
        storeId: ID!
        reconciliationId: ID!
        employeeId: ID!
        lock: Boolean!
        notes: String
        idempotencyKey: String!
      }

      input GenerateStoreDayReconciliationInput {
        businessId: ID!
        storeId: ID!
        tradingDate: String!
        periodStartedAt: String!
        periodEndedAt: String!
        notes: String
        idempotencyKey: String!
      }

      input ApproveStoreDayReconciliationInput {
        businessId: ID!
        storeId: ID!
        storeDayId: ID!
        employeeId: ID!
        lock: Boolean!
        notes: String
        idempotencyKey: String!
      }

      input PrepareBankDepositInput {
        businessId: ID!
        storeId: ID!
        storeDayId: ID!
        employeeId: ID!
        amountCents: Int!
        bagReference: String!
        notes: String
        idempotencyKey: String!
      }

      input TransitionBankDepositInput {
        businessId: ID!
        storeId: ID!
        depositId: ID!
        employeeId: ID!
        nextStatus: BankDepositStatusType!
        bankReference: String
        notes: String
        idempotencyKey: String!
      }

      input ConfigureExportDestinationInput {
        businessId: ID!
        name: String!
        code: String!
        type: ExportDestinationTypeType!
        adapterKey: String!
        credentialReference: String
        configuration: JSON
        storeIds: [ID!]!
        idempotencyKey: String!
      }

      input GenerateDailyAccountingExportInput {
        businessId: ID!
        destinationId: ID!
        employeeId: ID!
        storeIds: [ID!]!
        periodStartedAt: String!
        periodEndedAt: String!
        idempotencyKey: String!
      }

      input TransitionExportBatchInput {
        businessId: ID!
        batchId: ID!
        nextStatus: ExportBatchStatusType!
        externalReference: String
        failureMessage: String
        idempotencyKey: String!
      }

      input EvaluateOperationalAlertsInput {
        businessId: ID!
        storeId: ID
        cashVarianceThresholdCents: Int!
        fuelVarianceThresholdGallons: String!
        expiryWindowDays: Int!
        idempotencyKey: String!
      }

      input TransitionOperationalAlertInput {
        businessId: ID!
        alertId: ID!
        employeeId: ID!
        nextStatus: OperationalAlertStatusType!
        notes: String
        idempotencyKey: String!
      }

      input ConfigureLotteryGameInput {
        businessId: ID!
        name: String!
        gameCode: String!
        jurisdictionCode: String!
        operatorName: String!
        ticketPriceCents: Int!
        ticketsPerPack: Int!
        idempotencyKey: String!
      }

      input ReceiveLotteryPackInput {
        businessId: ID!
        storeId: ID!
        gameId: ID!
        employeeId: ID!
        packNumber: String!
        firstTicketNumber: Int!
        lastTicketNumber: Int!
        idempotencyKey: String!
      }

      input ActivateLotteryPackInput {
        businessId: ID!
        storeId: ID!
        packId: ID!
        employeeId: ID!
        idempotencyKey: String!
      }

      input RecordLotteryPackSaleInput {
        businessId: ID!
        storeId: ID!
        packId: ID!
        registerSessionId: ID!
        employeeId: ID!
        firstTicketNumber: Int!
        lastTicketNumber: Int!
        cashAmountCents: Int!
        occurredAt: String
        idempotencyKey: String!
      }

      enum LotteryPackCloseDisposition {
        returned
        void_remaining
      }

      input CloseLotteryPackInput {
        businessId: ID!
        storeId: ID!
        packId: ID!
        employeeId: ID!
        disposition: LotteryPackCloseDisposition!
        reason: String!
        idempotencyKey: String!
      }

      input GenerateLotterySettlementInput {
        businessId: ID!
        storeId: ID!
        tradingDate: String!
        operatorName: String!
        periodStartedAt: String!
        periodEndedAt: String!
        onlineSalesCents: Int!
        payoutCents: Int!
        commissionCents: Int!
        reportedSettlementCents: Int!
        idempotencyKey: String!
      }

      input ApproveLotterySettlementInput {
        businessId: ID!
        storeId: ID!
        settlementId: ID!
        employeeId: ID!
        notes: String
        idempotencyKey: String!
      }

      input ConfigureMoneyServiceProviderInput {
        businessId: ID!
        name: String!
        code: String!
        serviceType: MoneyServiceProviderServiceTypeType!
        adapterKey: String!
        externalAgentReference: String
        jurisdictionCode: String
        credentialReference: String
        configuration: JSON
        storeIds: [ID!]!
        idempotencyKey: String!
      }

      input RecordExternalMoneyServiceTransactionInput {
        businessId: ID!
        storeId: ID!
        providerId: ID!
        registerSessionId: ID
        employeeId: ID!
        serviceType: MoneyServiceProviderServiceTypeType!
        externalTransactionReference: String!
        cashDirection: MoneyServiceTransactionCashDirectionType!
        faceAmountCents: Int!
        feeCents: Int!
        cashAmountCents: Int!
        providerSettlementCents: Int!
        occurredAt: String!
        idempotencyKey: String!
      }

      input VoidExternalMoneyServiceTransactionInput {
        businessId: ID!
        storeId: ID!
        transactionId: ID!
        employeeId: ID!
        externalVoidReference: String!
        idempotencyKey: String!
      }

      input GenerateMoneyServiceSettlementInput {
        businessId: ID!
        storeId: ID!
        providerId: ID!
        tradingDate: String!
        periodStartedAt: String!
        periodEndedAt: String!
        reportedSettlementCents: Int!
        idempotencyKey: String!
      }

      input ApproveMoneyServiceSettlementInput {
        businessId: ID!
        storeId: ID!
        settlementId: ID!
        employeeId: ID!
        notes: String
        idempotencyKey: String!
      }

      input RegisterOfflineDeviceInput {
        businessId: ID!
        storeId: ID!
        name: String!
        deviceCode: String!
        apiKeyId: ID
        idempotencyKey: String!
      }

      input TransitionOfflineDeviceInput {
        businessId: ID!
        storeId: ID!
        deviceId: ID!
        nextStatus: OfflineDeviceStatusType!
        idempotencyKey: String!
      }

      input OfflineReplayOperationInput {
        sequence: Int!
        operationType: String!
        operationIdempotencyKey: String!
        requestDigest: String!
        payload: JSON!
      }

      input RecordOfflineReplayBatchInput {
        businessId: ID!
        storeId: ID!
        deviceId: ID!
        batchNumber: String!
        firstSequence: Int!
        lastSequence: Int!
        operations: [OfflineReplayOperationInput!]!
        idempotencyKey: String!
      }

      input ConfigurePaymentProviderInput {
        businessId: ID!
        name: String!
        code: String!
        adapterKey: String!
        credentialReference: String
        configuration: JSON
        activate: Boolean
        idempotencyKey: String!
      }

      input GeneratePaymentReconciliationInput {
        businessId: ID!
        storeId: ID!
        paymentProviderId: ID!
        periodStartedAt: String!
        periodEndedAt: String!
        reportedFeeCents: Int!
        reportedSettlementCents: Int!
        notes: String
        idempotencyKey: String!
      }

      input ApprovePaymentReconciliationInput {
        businessId: ID!
        storeId: ID!
        reconciliationId: ID!
        employeeId: ID!
        notes: String
        idempotencyKey: String!
      }

      input ClaimOutboxEventsInput {
        businessId: ID!
        workerId: String!
        limit: Int
      }

      input CompleteOutboxEventInput {
        businessId: ID!
        eventId: ID!
        workerId: String!
        leaseToken: String!
        outcome: OutboxCompletionOutcome!
        error: String
        retryAfterSeconds: Int
        idempotencyKey: String!
      }

      input ReplayOutboxEventInput {
        businessId: ID!
        eventId: ID!
        idempotencyKey: String!
      }

      input CreateBusinessApiKeyInput {
        businessId: ID!
        name: String!
        scopes: [String!]!
        storeIds: [ID!]
        allStores: Boolean
        expiresAt: String
        idempotencyKey: String!
      }

      input RevokeBusinessApiKeyInput {
        businessId: ID!
        apiKeyId: ID!
        idempotencyKey: String!
      }

      input StorefrontBasketInput {
        cartId: ID!
        token: String!
        variantId: ID
        lineId: ID
        quantity: Int!
        claim: Boolean
      }
      type Mutation {
        updateStorefrontBasket(input: StorefrontBasketInput!): JSON!
        revokeCurrentUserSessions: Boolean!
        recordOperationalHeartbeat(
          input: RecordOperationalHeartbeatInput!
        ): OperationalHeartbeatResult!
        onboardConvenienceBusiness(
          input: OnboardConvenienceBusinessInput!
        ): OnboardingResult!
        configureBusinessBrand(
          input: ConfigureBusinessBrandInput!
        ): OperationResult!
        setOwnPosPin(input: SetOwnPosPinInput!): OperationResult!
        openEmployeeShift(input: OpenEmployeeShiftInput!): OperationResult!
        closeEmployeeShift(input: CloseEmployeeShiftInput!): OperationResult!
        openRegisterSession(input: OpenRegisterSessionInput!): OperationResult!
        recordCashMovement(input: RecordCashMovementInput!): OperationResult!
        closeRegisterSession(
          input: CloseRegisterSessionInput!
        ): OperationResult!
        createPosCart(input: CreatePosCartInput!): OperationResult!
        addPosCartLine(input: AddPosCartLineInput!): OperationResult!
        updatePosCartLine(input: UpdatePosCartLineInput!): OperationResult!
        removePosCartLine(input: RemovePosCartLineInput!): OperationResult!
        transitionPosCart(input: TransitionPosCartInput!): OperationResult!
        setRetailPrice(input: SetRetailPriceInput!): OperationResult!
        applyPromotionToCart(
          input: ApplyPromotionToCartInput!
        ): OperationResult!
        completePosSale(input: CompletePosSaleInput!): OperationResult!
        refundPosSale(input: RefundPosSaleInput!): OperationResult!
        voidCompletedPosSale(
          input: VoidCompletedPosSaleInput!
        ): OperationResult!
        configureAgeRestrictionPolicy(
          input: ConfigureAgeRestrictionPolicyInput!
        ): OperationResult!
        verifyRestrictedSaleAge(
          input: VerifyRestrictedSaleAgeInput!
        ): OperationResult!
        transitionComplianceIncident(
          input: TransitionComplianceIncidentInput!
        ): OperationResult!
        configureLoyaltyProgram(
          input: ConfigureLoyaltyProgramInput!
        ): OperationResult!
        enrollLoyaltyAccount(
          input: EnrollLoyaltyAccountInput!
        ): OperationResult!
        adjustLoyaltyPoints(input: AdjustLoyaltyPointsInput!): OperationResult!
        applyLoyaltyRedemptionToCart(
          input: ApplyLoyaltyRedemptionToCartInput!
        ): OperationResult!
        expireLoyaltyPoints(input: ExpireLoyaltyPointsInput!): OperationResult!
        configureCatalogItem(
          input: ConfigureCatalogItemInput!
        ): OperationResult!
        configureStoreTaxRate(
          input: ConfigureStoreTaxRateInput!
        ): OperationResult!
        configurePromotion(input: ConfigurePromotionInput!): OperationResult!
        configureVendor(input: ConfigureVendorInput!): OperationResult!
        configureVendorItem(input: ConfigureVendorItemInput!): OperationResult!
        draftPurchaseOrder(input: DraftPurchaseOrderInput!): OperationResult!
        transitionPurchaseOrder(
          input: TransitionPurchaseOrderInput!
        ): OperationResult!
        receivePurchaseOrder(
          input: ReceivePurchaseOrderInput!
        ): OperationResult!
        startInventoryCount(input: StartInventoryCountInput!): OperationResult!
        recordInventoryCountLine(
          input: RecordInventoryCountLineInput!
        ): OperationResult!
        postInventoryAdjustment(
          input: PostInventoryAdjustmentInput!
        ): OperationResult!
        transitionInventoryCount(
          input: TransitionInventoryCountInput!
        ): OperationResult!
        approveInventoryCount(
          input: ApproveInventoryCountInput!
        ): OperationResult!
        draftInventoryTransfer(
          input: DraftInventoryTransferInput!
        ): OperationResult!
        transitionInventoryTransfer(
          input: TransitionInventoryTransferInput!
        ): OperationResult!
        configurePreparedFoodRecipe(
          input: ConfigurePreparedFoodRecipeInput!
        ): OperationResult!
        startPrepBatch(input: StartPrepBatchInput!): OperationResult!
        completePrepBatch(input: CompletePrepBatchInput!): OperationResult!
        recordWasteEvent(input: RecordWasteEventInput!): OperationResult!
        recordFuelDelivery(input: RecordFuelDeliveryInput!): OperationResult!
        authorizeFuelPayment(
          input: AuthorizeFuelPaymentInput!
        ): OperationResult!
        cancelFuelPaymentAuthorization(
          input: CancelFuelPaymentAuthorizationInput!
        ): OperationResult!
        completeFuelTransaction(
          input: CompleteFuelTransactionInput!
        ): OperationResult!
        configureFuelTopology(
          input: ConfigureFuelTopologyInput!
        ): OperationResult!
        setFuelPrice(input: SetFuelPriceInput!): OperationResult!
        recordFuelTankReading(
          input: RecordFuelTankReadingInput!
        ): OperationResult!
        generateFuelReconciliation(
          input: GenerateFuelReconciliationInput!
        ): OperationResult!
        approveFuelReconciliation(
          input: ApproveFuelReconciliationInput!
        ): OperationResult!
        generateStoreDayReconciliation(
          input: GenerateStoreDayReconciliationInput!
        ): OperationResult!
        approveStoreDayReconciliation(
          input: ApproveStoreDayReconciliationInput!
        ): OperationResult!
        prepareBankDeposit(input: PrepareBankDepositInput!): OperationResult!
        transitionBankDeposit(
          input: TransitionBankDepositInput!
        ): OperationResult!
        configureExportDestination(
          input: ConfigureExportDestinationInput!
        ): OperationResult!
        generateDailyAccountingExport(
          input: GenerateDailyAccountingExportInput!
        ): OperationResult!
        transitionExportBatch(
          input: TransitionExportBatchInput!
        ): OperationResult!
        evaluateOperationalAlerts(
          input: EvaluateOperationalAlertsInput!
        ): OperationResult!
        transitionOperationalAlert(
          input: TransitionOperationalAlertInput!
        ): OperationResult!
        configureLotteryGame(
          input: ConfigureLotteryGameInput!
        ): OperationResult!
        receiveLotteryPack(input: ReceiveLotteryPackInput!): OperationResult!
        activateLotteryPack(input: ActivateLotteryPackInput!): OperationResult!
        recordLotteryPackSale(
          input: RecordLotteryPackSaleInput!
        ): OperationResult!
        closeLotteryPack(input: CloseLotteryPackInput!): OperationResult!
        generateLotterySettlement(
          input: GenerateLotterySettlementInput!
        ): OperationResult!
        approveLotterySettlement(
          input: ApproveLotterySettlementInput!
        ): OperationResult!
        configureMoneyServiceProvider(
          input: ConfigureMoneyServiceProviderInput!
        ): OperationResult!
        recordExternalMoneyServiceTransaction(
          input: RecordExternalMoneyServiceTransactionInput!
        ): OperationResult!
        voidExternalMoneyServiceTransaction(
          input: VoidExternalMoneyServiceTransactionInput!
        ): OperationResult!
        generateMoneyServiceSettlement(
          input: GenerateMoneyServiceSettlementInput!
        ): OperationResult!
        approveMoneyServiceSettlement(
          input: ApproveMoneyServiceSettlementInput!
        ): OperationResult!
        configurePaymentProvider(
          input: ConfigurePaymentProviderInput!
        ): OperationResult!
        generatePaymentReconciliation(
          input: GeneratePaymentReconciliationInput!
        ): OperationResult!
        approvePaymentReconciliation(
          input: ApprovePaymentReconciliationInput!
        ): OperationResult!
        registerOfflineDevice(
          input: RegisterOfflineDeviceInput!
        ): OperationResult!
        transitionOfflineDevice(
          input: TransitionOfflineDeviceInput!
        ): OperationResult!
        recordOfflineReplayBatch(
          input: RecordOfflineReplayBatchInput!
        ): OfflineReplayResult!
        claimOutboxEvents(
          input: ClaimOutboxEventsInput!
        ): ClaimOutboxEventsResult!
        completeOutboxEvent(input: CompleteOutboxEventInput!): OperationResult!
        replayOutboxEvent(input: ReplayOutboxEventInput!): OperationResult!
        createBusinessApiKey(
          input: CreateBusinessApiKeyInput!
        ): ApiKeyOperationResult!
        revokeBusinessApiKey(
          input: RevokeBusinessApiKeyInput!
        ): ApiKeyOperationResult!
      }
    `,
    resolvers: {
      Query: {
        redirectToInit,
        assistantCapability(_root: unknown, _args: unknown, context: Context) {
          const session = context.session as Session | undefined;
          return (
            isHumanPlatformAdmin(session) ||
            hasPermission({ session }, "canUseAssistant")
          );
        },
        conveniencePlatformProjection,
        conveniencePlatformNavigation,
        conveniencePublicStorefront: conveniencePublicStorefrontProjection,
        convenienceReportingSummary,
        storefrontCatalog,
        storefrontBasket,
        storefrontHistory,
        posSaleReceipt,
        posOperationOutcome,
        downloadExportArtifact,
      },
      Mutation: {
        revokeCurrentUserSessions,
        recordOperationalHeartbeat,
        onboardConvenienceBusiness,
        configureBusinessBrand,
        setOwnPosPin,
        openEmployeeShift,
        closeEmployeeShift,
        openRegisterSession,
        recordCashMovement,
        closeRegisterSession,
        updateStorefrontBasket,
        createPosCart,
        addPosCartLine,
        updatePosCartLine,
        removePosCartLine,
        transitionPosCart,
        setRetailPrice,
        applyPromotionToCart,
        completePosSale,
        refundPosSale,
        voidCompletedPosSale,
        configureAgeRestrictionPolicy,
        verifyRestrictedSaleAge,
        transitionComplianceIncident,
        configureLoyaltyProgram,
        enrollLoyaltyAccount,
        adjustLoyaltyPoints,
        applyLoyaltyRedemptionToCart,
        expireLoyaltyPoints,
        configureCatalogItem,
        configureStoreTaxRate,
        configurePromotion,
        configureVendor,
        configureVendorItem,
        draftPurchaseOrder,
        transitionPurchaseOrder,
        receivePurchaseOrder,
        startInventoryCount,
        recordInventoryCountLine,
        postInventoryAdjustment,
        transitionInventoryCount,
        approveInventoryCount,
        draftInventoryTransfer,
        transitionInventoryTransfer,
        configurePreparedFoodRecipe,
        startPrepBatch,
        completePrepBatch,
        recordWasteEvent,
        recordFuelDelivery,
        authorizeFuelPayment,
        cancelFuelPaymentAuthorization,
        completeFuelTransaction,
        configureFuelTopology,
        setFuelPrice,
        recordFuelTankReading,
        generateFuelReconciliation,
        approveFuelReconciliation,
        generateStoreDayReconciliation,
        approveStoreDayReconciliation,
        prepareBankDeposit,
        transitionBankDeposit,
        configureExportDestination,
        generateDailyAccountingExport,
        transitionExportBatch,
        evaluateOperationalAlerts,
        transitionOperationalAlert,
        configureLotteryGame,
        receiveLotteryPack,
        activateLotteryPack,
        recordLotteryPackSale,
        closeLotteryPack,
        generateLotterySettlement,
        approveLotterySettlement,
        configureMoneyServiceProvider,
        recordExternalMoneyServiceTransaction,
        voidExternalMoneyServiceTransaction,
        generateMoneyServiceSettlement,
        approveMoneyServiceSettlement,
        configurePaymentProvider,
        generatePaymentReconciliation,
        approvePaymentReconciliation,
        registerOfflineDevice,
        transitionOfflineDevice,
        recordOfflineReplayBatch,
        claimOutboxEvents,
        completeOutboxEvent,
        replayOutboxEvent,
        createBusinessApiKey,
        revokeBusinessApiKey,
      },
    },
  });
}

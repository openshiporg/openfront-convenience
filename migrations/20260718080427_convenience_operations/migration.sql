BEGIN;

/*
  Warnings:

  - You are about to drop the column `canCreateTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canEditOtherPeople` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canManageAllTodos` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `canSeeOtherPeople` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Todo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TodoImage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_Todo_todoImages` table. If the table is not empty, all the data it contains will be lost.

*/
-- Preserve access for users from the starter's global-role model before that
-- relationship is removed. Existing role-bearing users become platform admins
-- and are directed through tenant onboarding after this migration.
CREATE TABLE "_OpenfrontLegacyUserAccess" AS
SELECT "id" FROM "User" WHERE "role" IS NOT NULL;

-- CreateEnum
CREATE TYPE "BusinessStatusType" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "UserOnboardingStatusType" AS ENUM ('not_started', 'in_progress', 'completed', 'dismissed');

-- CreateEnum
CREATE TYPE "EmployeeStatusType" AS ENUM ('invited', 'active', 'leave', 'suspended', 'terminated');

-- CreateEnum
CREATE TYPE "StoreStatusType" AS ENUM ('active', 'temporarily_closed', 'closed');

-- CreateEnum
CREATE TYPE "RegisterStatusType" AS ENUM ('active', 'offline', 'maintenance', 'retired');

-- CreateEnum
CREATE TYPE "ShiftStatusType" AS ENUM ('scheduled', 'clocked_in', 'on_break', 'completed', 'no_show', 'cancelled');

-- CreateEnum
CREATE TYPE "RegisterSessionStatusType" AS ENUM ('open', 'closing', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "CashMovementTypeType" AS ENUM ('opening_float', 'sale_payment', 'refund', 'paid_in', 'paid_out', 'safe_drop', 'closing_count', 'correction');

-- CreateEnum
CREATE TYPE "CashMovementDirectionType" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "ProductCategoryStatusType" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "ProductStatusType" AS ENUM ('draft', 'active', 'discontinued', 'archived');

-- CreateEnum
CREATE TYPE "ProductRegulatedSaleTypeType" AS ENUM ('none', 'alcohol', 'tobacco', 'lottery', 'otc_medicine', 'other');

-- CreateEnum
CREATE TYPE "ProductVariantStatusType" AS ENUM ('active', 'unavailable', 'discontinued');

-- CreateEnum
CREATE TYPE "ProductVariantSellByType" AS ENUM ('unit', 'weight', 'volume');

-- CreateEnum
CREATE TYPE "ProductVariantUnitOfMeasureType" AS ENUM ('each', 'lb', 'oz', 'kg', 'g', 'gal', 'l', 'ml');

-- CreateEnum
CREATE TYPE "ProductBarcodeFormatType" AS ENUM ('upc_a', 'upc_e', 'ean_13', 'ean_8', 'plu', 'gs1_databar', 'internal');

-- CreateEnum
CREATE TYPE "ProductBarcodeEmbeddedDataTypeType" AS ENUM ('none', 'price', 'weight');

-- CreateEnum
CREATE TYPE "ProductBarcodeStatusType" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "TaxRateStatusType" AS ENUM ('draft', 'active', 'expired');

-- CreateEnum
CREATE TYPE "PriceBookStatusType" AS ENUM ('draft', 'active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "PriceBookEntryStatusType" AS ENUM ('draft', 'active', 'inactive');

-- CreateEnum
CREATE TYPE "PromotionStatusType" AS ENUM ('draft', 'scheduled', 'active', 'paused', 'expired', 'archived');

-- CreateEnum
CREATE TYPE "PromotionRuleRuleTypeType" AS ENUM ('item_discount', 'basket_discount', 'quantity_break', 'buy_x_get_y', 'mix_and_match');

-- CreateEnum
CREATE TYPE "PromotionRuleBenefitMethodType" AS ENUM ('percentage', 'fixed_amount', 'fixed_price', 'free_item');

-- CreateEnum
CREATE TYPE "LoyaltyProgramStatusType" AS ENUM ('draft', 'active', 'paused', 'archived');

-- CreateEnum
CREATE TYPE "LoyaltyAccountStatusType" AS ENUM ('active', 'paused', 'closed');

-- CreateEnum
CREATE TYPE "LoyaltyLedgerEntryTypeType" AS ENUM ('earned', 'redeemed', 'refund_reversal', 'expired', 'manual_adjustment', 'bonus');

-- CreateEnum
CREATE TYPE "InventoryLocationTypeType" AS ENUM ('sales_floor', 'back_room', 'cooler', 'freezer', 'kitchen', 'warehouse');

-- CreateEnum
CREATE TYPE "InventoryLocationStatusType" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "InventoryLotStatusType" AS ENUM ('active', 'quarantined', 'consumed', 'expired', 'recalled');

-- CreateEnum
CREATE TYPE "InventoryLedgerEntryTypeType" AS ENUM ('opening_balance', 'receiving', 'sale', 'return', 'count_adjustment', 'transfer_in', 'transfer_out', 'production_input', 'production_output', 'waste', 'spoilage', 'theft', 'correction');

-- CreateEnum
CREATE TYPE "InventoryCountTypeType" AS ENUM ('full', 'cycle', 'spot');

-- CreateEnum
CREATE TYPE "InventoryCountStatusType" AS ENUM ('draft', 'counting', 'submitted', 'approved', 'cancelled');

-- CreateEnum
CREATE TYPE "VendorStatusType" AS ENUM ('active', 'on_hold', 'archived');

-- CreateEnum
CREATE TYPE "VendorPaymentTermType" AS ENUM ('cod', 'net_7', 'net_15', 'net_30', 'net_60', 'prepaid');

-- CreateEnum
CREATE TYPE "VendorItemStatusType" AS ENUM ('active', 'unavailable', 'discontinued');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatusType" AS ENUM ('draft', 'submitted', 'approved', 'partially_received', 'received', 'cancelled');

-- CreateEnum
CREATE TYPE "ReceivingStatusType" AS ENUM ('draft', 'posted', 'cancelled');

-- CreateEnum
CREATE TYPE "ReceivingLineRejectionReasonType" AS ENUM ('none', 'damaged', 'expired', 'wrong_item', 'overage', 'quality');

-- CreateEnum
CREATE TYPE "CartSourceType" AS ENUM ('pos', 'kiosk', 'storefront', 'mobile', 'api');

-- CreateEnum
CREATE TYPE "CartStatusType" AS ENUM ('open', 'held', 'converted', 'abandoned', 'voided');

-- CreateEnum
CREATE TYPE "CartLinePriceSourceType" AS ENUM ('price_book', 'variant_default', 'embedded_barcode', 'manager_override');

-- CreateEnum
CREATE TYPE "SaleSourceType" AS ENUM ('pos', 'kiosk', 'storefront', 'mobile', 'api');

-- CreateEnum
CREATE TYPE "SaleStatusType" AS ENUM ('open', 'completed', 'partially_refunded', 'refunded', 'voided');

-- CreateEnum
CREATE TYPE "PaymentProviderStatusType" AS ENUM ('configured', 'active', 'disabled', 'error');

-- CreateEnum
CREATE TYPE "TenderMethodType" AS ENUM ('cash', 'credit_card', 'debit_card', 'mobile_wallet', 'gift_card', 'ebt_snap', 'fleet_card', 'house_account', 'other');

-- CreateEnum
CREATE TYPE "TenderStatusType" AS ENUM ('pending', 'authorized', 'captured', 'partially_refunded', 'refunded', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "RefundStatusType" AS ENUM ('requested', 'approved', 'processing', 'completed', 'failed', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "RefundReasonType" AS ENUM ('customer_return', 'price_correction', 'duplicate_charge', 'service_recovery', 'fraud', 'other');

-- CreateEnum
CREATE TYPE "RefundLineReasonType" AS ENUM ('returned', 'damaged', 'price_correction', 'not_received', 'other');

-- CreateEnum
CREATE TYPE "ReturnStatusType" AS ENUM ('requested', 'approved', 'received', 'completed', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "ReturnReasonType" AS ENUM ('unwanted', 'defective', 'expired', 'wrong_item', 'recall', 'other');

-- CreateEnum
CREATE TYPE "ReturnLineDispositionType" AS ENUM ('restock', 'quarantine', 'destroy', 'return_to_vendor', 'no_inventory_action');

-- CreateEnum
CREATE TYPE "ReturnLineConditionType" AS ENUM ('sealed', 'opened', 'damaged', 'expired', 'unknown');

-- CreateEnum
CREATE TYPE "CompliancePolicyPolicyTypeType" AS ENUM ('age_restriction', 'quantity_limit', 'time_of_sale', 'license_required', 'warning');

-- CreateEnum
CREATE TYPE "CompliancePolicyStatusType" AS ENUM ('draft', 'active', 'inactive', 'archived');

-- CreateEnum
CREATE TYPE "AgeVerificationOutcomeType" AS ENUM ('passed', 'failed', 'overridden', 'declined');

-- CreateEnum
CREATE TYPE "AgeVerificationMethodType" AS ENUM ('id_scan', 'visual_check', 'known_customer', 'manager_override');

-- CreateEnum
CREATE TYPE "ComplianceIncidentIncidentTypeType" AS ENUM ('failed_verification', 'override', 'refused_sale', 'policy_violation', 'regulator_inquiry', 'other');

-- CreateEnum
CREATE TYPE "ComplianceIncidentSeverityType" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ComplianceIncidentStatusType" AS ENUM ('open', 'investigating', 'resolved', 'reported', 'closed');

-- CreateEnum
CREATE TYPE "RecipeStatusType" AS ENUM ('draft', 'active', 'archived');

-- CreateEnum
CREATE TYPE "PrepBatchStatusType" AS ENUM ('planned', 'in_progress', 'completed', 'discarded', 'cancelled');

-- CreateEnum
CREATE TYPE "WasteEventReasonType" AS ENUM ('expired', 'spoilage', 'preparation_error', 'overproduction', 'quality', 'damaged', 'other');

-- CreateEnum
CREATE TYPE "FuelSiteStatusType" AS ENUM ('offline', 'online', 'maintenance', 'disabled');

-- CreateEnum
CREATE TYPE "FuelGradeStatusType" AS ENUM ('active', 'unavailable', 'retired');

-- CreateEnum
CREATE TYPE "FuelTankStatusType" AS ENUM ('active', 'low', 'delivery', 'maintenance', 'out_of_service');

-- CreateEnum
CREATE TYPE "FuelPumpStatusType" AS ENUM ('available', 'in_use', 'offline', 'maintenance', 'emergency_stop');

-- CreateEnum
CREATE TYPE "FuelNozzleStatusType" AS ENUM ('available', 'lifted', 'dispensing', 'offline', 'maintenance');

-- CreateEnum
CREATE TYPE "FuelPricePriceTierType" AS ENUM ('cash', 'credit', 'fleet', 'loyalty');

-- CreateEnum
CREATE TYPE "FuelPriceStatusType" AS ENUM ('scheduled', 'active', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "FuelTransactionStatusType" AS ENUM ('requested', 'authorized', 'dispensing', 'completed', 'stopped', 'declined', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "FuelDeliveryStatusType" AS ENUM ('scheduled', 'in_progress', 'received', 'reconciled', 'disputed', 'cancelled');

-- CreateEnum
CREATE TYPE "ApiKeyStatusType" AS ENUM ('active', 'revoked', 'expired');

-- CreateEnum
CREATE TYPE "IdempotencyKeyStateType" AS ENUM ('processing', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "AuditEventResultType" AS ENUM ('succeeded', 'denied', 'failed');

-- CreateEnum
CREATE TYPE "AuditEventActorTypeType" AS ENUM ('user', 'api_key', 'system', 'integration');

-- CreateEnum
CREATE TYPE "WebhookEventStatusType" AS ENUM ('received', 'processing', 'processed', 'ignored', 'failed');

-- DropForeignKey
ALTER TABLE "Todo" DROP CONSTRAINT "Todo_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_role_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_A_fkey";

-- DropForeignKey
ALTER TABLE "_Todo_todoImages" DROP CONSTRAINT "_Todo_todoImages_B_fkey";

-- DropIndex
DROP INDEX "User_role_idx";

-- AlterTable
ALTER TABLE "Role" DROP COLUMN "canCreateTodos",
DROP COLUMN "canEditOtherPeople",
DROP COLUMN "canManageAllTodos",
DROP COLUMN "canSeeOtherPeople",
ADD COLUMN     "business" TEXT,
ADD COLUMN     "canManageApiKeys" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageBusiness" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageCash" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageCatalog" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageCompliance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageFuel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageIntegrations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageLoyalty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageOnboarding" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePreparedFood" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePricing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePromotions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManagePurchasing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canManageSales" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadAudit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadCash" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadCatalog" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadCompliance" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadFuel" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadIntegrations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadInventory" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadLoyalty" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadPayments" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadPeople" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadPreparedFood" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadPricing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadPromotions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadPurchasing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canReadSales" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "role",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isPlatformAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onboardingStatus" "UserOnboardingStatusType" NOT NULL DEFAULT 'not_started',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "User"
SET "isPlatformAdmin" = true
WHERE "id" IN (SELECT "id" FROM "_OpenfrontLegacyUserAccess");

DROP TABLE "_OpenfrontLegacyUserAccess";

-- DropTable
DROP TABLE "Todo";

-- DropTable
DROP TABLE "TodoImage";

-- DropTable
DROP TABLE "_Todo_todoImages";

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "legalName" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "status" "BusinessStatusType" NOT NULL DEFAULT 'active',
    "defaultCurrencyCode" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "taxIdentifier" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "user" TEXT,
    "role" TEXT,
    "employeeNumber" TEXT NOT NULL DEFAULT '',
    "jobTitle" TEXT NOT NULL DEFAULT '',
    "status" "EmployeeStatusType" NOT NULL DEFAULT 'invited',
    "hireDate" TIMESTAMP(3),
    "terminatedAt" TIMESTAMP(3),
    "hourlyRateCents" INTEGER,
    "overtimeEligible" BOOLEAN NOT NULL DEFAULT true,
    "posPin" TEXT,
    "manager" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "StoreStatusType" NOT NULL DEFAULT 'active',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "stateProvince" TEXT NOT NULL DEFAULT '',
    "postalCode" TEXT NOT NULL DEFAULT '',
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "phone" TEXT NOT NULL DEFAULT '',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false,
    "fuelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultPriceBook" TEXT,
    "primaryInventoryLocation" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Store_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Register" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "RegisterStatusType" NOT NULL DEFAULT 'active',
    "deviceIdentifier" TEXT NOT NULL DEFAULT '',
    "lastHeartbeatAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Register_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "employee" TEXT,
    "shiftNumber" TEXT NOT NULL DEFAULT '',
    "roleSnapshot" TEXT NOT NULL DEFAULT '',
    "status" "ShiftStatusType" NOT NULL DEFAULT 'scheduled',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "clockedInAt" TIMESTAMP(3),
    "clockedOutAt" TIMESTAMP(3),
    "breakMinutes" INTEGER DEFAULT 0,
    "hourlyRateCents" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegisterSession" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "register" TEXT,
    "employee" TEXT,
    "shift" TEXT,
    "sessionNumber" TEXT NOT NULL DEFAULT '',
    "status" "RegisterSessionStatusType" NOT NULL DEFAULT 'open',
    "openingCashCents" INTEGER NOT NULL DEFAULT 0,
    "expectedCashCents" INTEGER NOT NULL DEFAULT 0,
    "countedCashCents" INTEGER,
    "overShortCents" INTEGER,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closingStartedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closingNotes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegisterSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "registerSession" TEXT,
    "employee" TEXT,
    "type" "CashMovementTypeType" NOT NULL,
    "direction" "CashMovementDirectionType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "sale" TEXT,
    "tender" TEXT,
    "refund" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" "ProductCategoryStatusType" NOT NULL DEFAULT 'draft',
    "requiresManagerApproval" BOOLEAN NOT NULL DEFAULT false,
    "parent" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "handle" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "description" JSONB NOT NULL DEFAULT '[{"type":"paragraph","children":[{"text":""}]}]',
    "status" "ProductStatusType" NOT NULL DEFAULT 'draft',
    "regulatedSaleType" "ProductRegulatedSaleTypeType" NOT NULL DEFAULT 'none',
    "minimumAge" INTEGER,
    "preparedFood" BOOLEAN NOT NULL DEFAULT false,
    "discountable" BOOLEAN NOT NULL DEFAULT true,
    "returnable" BOOLEAN NOT NULL DEFAULT true,
    "taxCategory" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "product" TEXT,
    "title" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "ProductVariantStatusType" NOT NULL DEFAULT 'active',
    "sellBy" "ProductVariantSellByType" NOT NULL DEFAULT 'unit',
    "unitOfMeasure" "ProductVariantUnitOfMeasureType" NOT NULL DEFAULT 'each',
    "defaultPriceCents" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER,
    "trackInventory" BOOLEAN NOT NULL DEFAULT true,
    "allowNegativeInventory" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBarcode" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "variant" TEXT,
    "value" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "format" "ProductBarcodeFormatType" NOT NULL,
    "embeddedDataType" "ProductBarcodeEmbeddedDataTypeType" NOT NULL DEFAULT 'none',
    "embeddedPrefix" TEXT NOT NULL DEFAULT '',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" "ProductBarcodeStatusType" NOT NULL DEFAULT 'active',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductBarcode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxCategory" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "taxCategory" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "jurisdiction" TEXT NOT NULL DEFAULT '',
    "rateBasisPoints" INTEGER NOT NULL,
    "inclusive" BOOLEAN NOT NULL DEFAULT false,
    "status" "TaxRateStatusType" NOT NULL DEFAULT 'draft',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBook" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "PriceBookStatusType" NOT NULL DEFAULT 'draft',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "priority" INTEGER DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceBookEntry" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "priceBook" TEXT,
    "variant" TEXT,
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER NOT NULL,
    "minQuantity" DECIMAL(18,4) NOT NULL DEFAULT 1.0000,
    "maxQuantity" DECIMAL(18,4),
    "status" "PriceBookEntryStatusType" NOT NULL DEFAULT 'draft',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceBookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "PromotionStatusType" NOT NULL DEFAULT 'draft',
    "priority" INTEGER DEFAULT 0,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "requiresCode" BOOLEAN NOT NULL DEFAULT false,
    "usageLimit" INTEGER,
    "perCustomerLimit" INTEGER,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRule" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "promotion" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "priority" INTEGER DEFAULT 0,
    "ruleType" "PromotionRuleRuleTypeType" NOT NULL,
    "benefitMethod" "PromotionRuleBenefitMethodType" NOT NULL,
    "valueBasisPoints" INTEGER,
    "valueCents" INTEGER,
    "minQuantity" DECIMAL(18,4),
    "buyQuantity" DECIMAL(18,4),
    "getQuantity" DECIMAL(18,4),
    "minSubtotalCents" INTEGER,
    "maxDiscountCents" INTEGER,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromotionRedemption" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "promotion" TEXT,
    "sale" TEXT,
    "loyaltyAccount" TEXT,
    "codeSnapshot" TEXT NOT NULL DEFAULT '',
    "amountCents" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "LoyaltyProgramStatusType" NOT NULL DEFAULT 'draft',
    "pointsPerDollar" INTEGER DEFAULT 1,
    "redemptionPoints" INTEGER DEFAULT 100,
    "redemptionValueCents" INTEGER NOT NULL DEFAULT 100,
    "pointsExpireAfterDays" INTEGER,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "program" TEXT,
    "user" TEXT,
    "accountNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "status" "LoyaltyAccountStatusType" NOT NULL DEFAULT 'active',
    "tier" TEXT NOT NULL DEFAULT 'standard',
    "pointsBalance" INTEGER DEFAULT 0,
    "lifetimePoints" INTEGER DEFAULT 0,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "firstVisitAt" TIMESTAMP(3),
    "lastVisitAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyLedgerEntry" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "account" TEXT,
    "type" "LoyaltyLedgerEntryTypeType" NOT NULL,
    "pointsDelta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sale" TEXT,
    "refund" TEXT,
    "actor" TEXT,
    "expiresAt" TIMESTAMP(3),
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoyaltyLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "type" "InventoryLocationTypeType" NOT NULL DEFAULT 'sales_floor',
    "status" "InventoryLocationStatusType" NOT NULL DEFAULT 'active',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLevel" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "location" TEXT,
    "variant" TEXT,
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "onHandQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "reservedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "parQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "reorderPoint" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "reorderQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "lastCountedAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLot" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "location" TEXT,
    "variant" TEXT,
    "vendor" TEXT,
    "receivingLine" TEXT,
    "lotNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "quantityReceived" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "quantityRemaining" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "unitCostCents" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" "InventoryLotStatusType" NOT NULL DEFAULT 'active',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLedgerEntry" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "stockLevel" TEXT,
    "location" TEXT,
    "variant" TEXT,
    "lot" TEXT,
    "type" "InventoryLedgerEntryTypeType" NOT NULL,
    "quantityDelta" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4) NOT NULL,
    "unitCostCents" INTEGER,
    "reason" TEXT NOT NULL DEFAULT '',
    "sourceType" TEXT NOT NULL DEFAULT '',
    "sourceId" TEXT NOT NULL DEFAULT '',
    "receivingLine" TEXT,
    "saleLine" TEXT,
    "returnLine" TEXT,
    "wasteEvent" TEXT,
    "actor" TEXT,
    "idempotency" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCount" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "location" TEXT,
    "countNumber" TEXT NOT NULL DEFAULT '',
    "type" "InventoryCountTypeType" NOT NULL DEFAULT 'cycle',
    "status" "InventoryCountStatusType" NOT NULL DEFAULT 'draft',
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCountLine" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "count" TEXT,
    "stockLevel" TEXT,
    "variant" TEXT,
    "expectedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "actualQuantity" DECIMAL(18,4),
    "varianceQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "reason" TEXT NOT NULL DEFAULT '',
    "countedBy" TEXT,
    "ledgerEntry" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryCountLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "vendorNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "VendorStatusType" NOT NULL DEFAULT 'active',
    "contactName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "paymentTerms" "VendorPaymentTermType" NOT NULL DEFAULT 'net_30',
    "leadTimeDays" INTEGER DEFAULT 0,
    "minimumOrderCents" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorItem" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "vendor" TEXT,
    "variant" TEXT,
    "vendorSku" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "VendorItemStatusType" NOT NULL DEFAULT 'active',
    "casePackQuantity" DECIMAL(18,4) NOT NULL DEFAULT 1.0000,
    "unitsPerCase" INTEGER DEFAULT 1,
    "unitCostCents" INTEGER NOT NULL DEFAULT 0,
    "leadTimeDays" INTEGER DEFAULT 0,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VendorItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "vendor" TEXT,
    "poNumber" TEXT NOT NULL DEFAULT '',
    "status" "PurchaseOrderStatusType" NOT NULL DEFAULT 'draft',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "shippingCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "orderedAt" TIMESTAMP(3),
    "expectedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderLine" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "purchaseOrder" TEXT,
    "vendorItem" TEXT,
    "variant" TEXT,
    "descriptionSnapshot" TEXT NOT NULL DEFAULT '',
    "vendorSkuSnapshot" TEXT NOT NULL DEFAULT '',
    "quantityOrdered" DECIMAL(18,4) NOT NULL,
    "quantityReceived" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "quantityCancelled" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "unitCostCents" INTEGER NOT NULL,
    "lineTotalCents" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Receiving" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "purchaseOrder" TEXT,
    "vendor" TEXT,
    "receivingNumber" TEXT NOT NULL DEFAULT '',
    "vendorDocumentNumber" TEXT NOT NULL DEFAULT '',
    "status" "ReceivingStatusType" NOT NULL DEFAULT 'draft',
    "receivedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "discrepancyNotes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receiving_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivingLine" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "receiving" TEXT,
    "purchaseOrderLine" TEXT,
    "variant" TEXT,
    "quantityExpected" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "quantityAccepted" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "quantityRejected" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "rejectionReason" "ReceivingLineRejectionReasonType" NOT NULL DEFAULT 'none',
    "unitCostCents" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivingLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cart" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "cartNumber" TEXT NOT NULL DEFAULT '',
    "source" "CartSourceType" NOT NULL DEFAULT 'pos',
    "status" "CartStatusType" NOT NULL DEFAULT 'open',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "registerSession" TEXT,
    "cashier" TEXT,
    "customer" TEXT,
    "loyaltyAccount" TEXT,
    "priceBook" TEXT,
    "guestTokenDigest" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3),
    "sale" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartLine" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "cart" TEXT,
    "variant" TEXT,
    "barcode" TEXT,
    "priceBookEntry" TEXT,
    "titleSnapshot" TEXT NOT NULL DEFAULT '',
    "variantTitleSnapshot" TEXT NOT NULL DEFAULT '',
    "skuSnapshot" TEXT NOT NULL DEFAULT '',
    "barcodeSnapshot" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitOfMeasure" TEXT NOT NULL DEFAULT 'each',
    "unitPriceCents" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxRateBasisPoints" INTEGER DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "priceSource" "CartLinePriceSourceType" NOT NULL DEFAULT 'price_book',
    "ageRestricted" BOOLEAN NOT NULL DEFAULT false,
    "minimumAge" INTEGER,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CartLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "receiptNumber" TEXT NOT NULL DEFAULT '',
    "source" "SaleSourceType" NOT NULL,
    "status" "SaleStatusType" NOT NULL DEFAULT 'open',
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "roundingCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "registerSession" TEXT,
    "cashier" TEXT,
    "customer" TEXT,
    "loyaltyAccount" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "sale" TEXT,
    "lineNumber" INTEGER NOT NULL,
    "titleSnapshot" TEXT NOT NULL DEFAULT '',
    "variantTitleSnapshot" TEXT NOT NULL DEFAULT '',
    "skuSnapshot" TEXT NOT NULL DEFAULT '',
    "barcodeSnapshot" TEXT NOT NULL DEFAULT '',
    "imageUrlSnapshot" TEXT NOT NULL DEFAULT '',
    "productSnapshot" JSONB DEFAULT '{}',
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitOfMeasure" TEXT NOT NULL DEFAULT '',
    "unitPriceCents" INTEGER NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCategorySnapshot" TEXT NOT NULL DEFAULT '',
    "taxRateBasisPoints" INTEGER DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "promotionSnapshot" JSONB DEFAULT '[]',
    "regulatedSaleType" TEXT NOT NULL DEFAULT 'none',
    "minimumAge" INTEGER,
    "ageVerified" BOOLEAN NOT NULL DEFAULT false,
    "product" TEXT,
    "variant" TEXT,
    "barcode" TEXT,
    "ageVerification" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentProvider" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "PaymentProviderStatusType" NOT NULL DEFAULT 'configured',
    "adapterKey" TEXT NOT NULL DEFAULT '',
    "createPaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "capturePaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "refundPaymentFunction" TEXT NOT NULL DEFAULT 'manual',
    "getPaymentStatusFunction" TEXT NOT NULL DEFAULT 'manual',
    "handleWebhookFunction" TEXT NOT NULL DEFAULT 'manual',
    "credentialReference" TEXT NOT NULL DEFAULT '',
    "configuration" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tender" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "sale" TEXT,
    "paymentProvider" TEXT,
    "method" "TenderMethodType" NOT NULL,
    "status" "TenderStatusType" NOT NULL DEFAULT 'pending',
    "amountCents" INTEGER NOT NULL,
    "tenderedCents" INTEGER,
    "changeCents" INTEGER NOT NULL DEFAULT 0,
    "refundedCents" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "providerPaymentId" TEXT NOT NULL DEFAULT '',
    "providerReference" TEXT NOT NULL DEFAULT '',
    "cardBrand" TEXT NOT NULL DEFAULT '',
    "cardLast4" TEXT NOT NULL DEFAULT '',
    "failureCode" TEXT NOT NULL DEFAULT '',
    "failureMessage" TEXT NOT NULL DEFAULT '',
    "providerData" JSONB DEFAULT '{}',
    "processedAt" TIMESTAMP(3),
    "processedBy" TEXT,
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tender_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "sale" TEXT,
    "originalTender" TEXT,
    "refundNumber" TEXT NOT NULL DEFAULT '',
    "status" "RefundStatusType" NOT NULL DEFAULT 'requested',
    "reason" "RefundReasonType" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "providerRefundId" TEXT NOT NULL DEFAULT '',
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "processedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundLine" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "refund" TEXT,
    "saleLine" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "subtotalCents" INTEGER NOT NULL,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "reason" "RefundLineReasonType" NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "returnLine" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Return" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "sale" TEXT,
    "refund" TEXT,
    "returnNumber" TEXT NOT NULL DEFAULT '',
    "status" "ReturnStatusType" NOT NULL DEFAULT 'requested',
    "reason" "ReturnReasonType" NOT NULL,
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "receivedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnLine" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "return" TEXT,
    "saleLine" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "disposition" "ReturnLineDispositionType" NOT NULL,
    "condition" "ReturnLineConditionType" NOT NULL DEFAULT 'unknown',
    "note" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompliancePolicy" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "policyType" "CompliancePolicyPolicyTypeType" NOT NULL,
    "status" "CompliancePolicyStatusType" NOT NULL DEFAULT 'draft',
    "jurisdiction" TEXT NOT NULL DEFAULT '',
    "minimumAge" INTEGER,
    "idCheckThresholdAge" INTEGER,
    "managerOverrideAllowed" BOOLEAN NOT NULL DEFAULT false,
    "scanRequired" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompliancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgeVerification" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "verificationNumber" TEXT NOT NULL DEFAULT '',
    "policy" TEXT,
    "cart" TEXT,
    "sale" TEXT,
    "verifiedBy" TEXT,
    "outcome" "AgeVerificationOutcomeType" NOT NULL,
    "method" "AgeVerificationMethodType" NOT NULL,
    "ageAtVerification" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL DEFAULT '',
    "documentFingerprint" TEXT NOT NULL DEFAULT '',
    "overrideReason" TEXT NOT NULL DEFAULT '',
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgeVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceIncident" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "incidentNumber" TEXT NOT NULL DEFAULT '',
    "incidentType" "ComplianceIncidentIncidentTypeType" NOT NULL,
    "severity" "ComplianceIncidentSeverityType" NOT NULL DEFAULT 'medium',
    "status" "ComplianceIncidentStatusType" NOT NULL DEFAULT 'open',
    "policy" TEXT,
    "ageVerification" TEXT,
    "sale" TEXT,
    "reportedBy" TEXT,
    "resolvedBy" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "resolution" TEXT NOT NULL DEFAULT '',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "outputVariant" TEXT,
    "status" "RecipeStatusType" NOT NULL DEFAULT 'draft',
    "yieldQuantity" DECIMAL(18,4) NOT NULL DEFAULT 1.0000,
    "yieldUnit" TEXT NOT NULL DEFAULT 'each',
    "instructions" TEXT NOT NULL DEFAULT '',
    "allergenNotes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "recipe" TEXT,
    "inputVariant" TEXT,
    "nameSnapshot" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '',
    "wasteBasisPoints" INTEGER DEFAULT 0,
    "optional" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeIngredient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrepBatch" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "batchNumber" TEXT NOT NULL DEFAULT '',
    "recipe" TEXT,
    "status" "PrepBatchStatusType" NOT NULL DEFAULT 'planned',
    "quantityPlanned" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "quantityMade" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "outputLot" TEXT,
    "preparedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrepBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteEvent" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "eventNumber" TEXT NOT NULL DEFAULT '',
    "variant" TEXT,
    "lot" TEXT,
    "prepBatch" TEXT,
    "reason" "WasteEventReasonType" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "loggedBy" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WasteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelSite" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "siteCode" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "status" "FuelSiteStatusType" NOT NULL DEFAULT 'offline',
    "controllerAdapterKey" TEXT NOT NULL DEFAULT '',
    "controllerCredentialReference" TEXT NOT NULL DEFAULT '',
    "configuration" JSONB DEFAULT '{}',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelGrade" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "site" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "octaneRating" INTEGER,
    "productCode" TEXT NOT NULL DEFAULT '',
    "status" "FuelGradeStatusType" NOT NULL DEFAULT 'active',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelTank" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "site" TEXT,
    "grade" TEXT,
    "tankNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "FuelTankStatusType" NOT NULL DEFAULT 'active',
    "capacityGallons" DECIMAL(18,4) NOT NULL,
    "currentVolumeGallons" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "waterVolumeGallons" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "ullageGallons" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "lastReadingAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelTank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelPump" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "site" TEXT,
    "pumpNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "FuelPumpStatusType" NOT NULL DEFAULT 'offline',
    "controllerAddress" TEXT NOT NULL DEFAULT '',
    "serialNumber" TEXT NOT NULL DEFAULT '',
    "lastCommunicationAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelPump_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelNozzle" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "pump" TEXT,
    "tank" TEXT,
    "grade" TEXT,
    "nozzleNumber" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "status" "FuelNozzleStatusType" NOT NULL DEFAULT 'offline',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelNozzle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelPrice" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "site" TEXT,
    "grade" TEXT,
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "priceTier" "FuelPricePriceTierType" NOT NULL DEFAULT 'credit',
    "priceMillsPerGallon" INTEGER NOT NULL,
    "status" "FuelPriceStatusType" NOT NULL DEFAULT 'scheduled',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "authorizedBy" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelTransaction" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "site" TEXT,
    "pump" TEXT,
    "nozzle" TEXT,
    "grade" TEXT,
    "transactionNumber" TEXT NOT NULL DEFAULT '',
    "controllerTransactionId" TEXT NOT NULL DEFAULT '',
    "status" "FuelTransactionStatusType" NOT NULL DEFAULT 'requested',
    "volumeGallons" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "unitPriceMillsPerGallon" INTEGER NOT NULL,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "authorizedCents" INTEGER NOT NULL DEFAULT 0,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "sale" TEXT,
    "tender" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorizedAt" TIMESTAMP(3),
    "dispensingStartedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuelDelivery" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "site" TEXT,
    "tank" TEXT,
    "vendor" TEXT,
    "deliveryNumber" TEXT NOT NULL DEFAULT '',
    "billOfLadingNumber" TEXT NOT NULL DEFAULT '',
    "status" "FuelDeliveryStatusType" NOT NULL DEFAULT 'scheduled',
    "grossVolumeGallons" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "netVolumeGallons" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "beforeVolumeGallons" DECIMAL(18,4),
    "afterVolumeGallons" DECIMAL(18,4),
    "varianceGallons" DECIMAL(18,4),
    "unitCostMillsPerGallon" INTEGER,
    "totalCostCents" INTEGER NOT NULL DEFAULT 0,
    "deliveredAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuelDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "keyPrefix" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "secretHash" TEXT NOT NULL,
    "status" "ApiKeyStatusType" NOT NULL DEFAULT 'active',
    "scopes" JSONB DEFAULT '[]',
    "createdBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "scope" TEXT NOT NULL DEFAULT '',
    "keyDigest" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "requestDigest" TEXT NOT NULL DEFAULT '',
    "state" "IdempotencyKeyStateType" NOT NULL DEFAULT 'processing',
    "responseCode" TEXT NOT NULL DEFAULT '',
    "responseDigest" TEXT NOT NULL DEFAULT '',
    "responseSnapshot" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "actorUser" TEXT,
    "actorApiKey" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "store" TEXT,
    "eventNumber" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL DEFAULT '',
    "resourceType" TEXT NOT NULL DEFAULT '',
    "resourceId" TEXT NOT NULL DEFAULT '',
    "result" "AuditEventResultType" NOT NULL,
    "actorType" "AuditEventActorTypeType" NOT NULL,
    "actorUser" TEXT,
    "actorEmployee" TEXT,
    "actorApiKey" TEXT,
    "requestId" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "changes" JSONB,
    "sourceIpDigest" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "business" TEXT,
    "paymentProvider" TEXT,
    "externalEventId" TEXT NOT NULL DEFAULT '',
    "lookupKey" TEXT NOT NULL DEFAULT '',
    "eventType" TEXT NOT NULL DEFAULT '',
    "payloadDigest" TEXT NOT NULL DEFAULT '',
    "status" "WebhookEventStatusType" NOT NULL DEFAULT 'received',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "lastError" TEXT NOT NULL DEFAULT '',
    "idempotency" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_Employee_stores" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_PromotionRule_categories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Product_categories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_PromotionRule_products" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_PriceBook_stores" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Promotion_stores" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_Cart_promotions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_CartLine_promotions" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_CompliancePolicy_stores" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_CompliancePolicy_products" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_CompliancePolicy_categories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Business_code_key" ON "Business"("code");

-- CreateIndex
CREATE INDEX "Employee_business_idx" ON "Employee"("business");

-- CreateIndex
CREATE INDEX "Employee_user_idx" ON "Employee"("user");

-- CreateIndex
CREATE INDEX "Employee_role_idx" ON "Employee"("role");

-- CreateIndex
CREATE INDEX "Employee_employeeNumber_idx" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE INDEX "Employee_manager_idx" ON "Employee"("manager");

-- CreateIndex
CREATE UNIQUE INDEX "Store_lookupKey_key" ON "Store"("lookupKey");

-- CreateIndex
CREATE INDEX "Store_business_idx" ON "Store"("business");

-- CreateIndex
CREATE INDEX "Store_code_idx" ON "Store"("code");

-- CreateIndex
CREATE INDEX "Store_defaultPriceBook_idx" ON "Store"("defaultPriceBook");

-- CreateIndex
CREATE INDEX "Store_primaryInventoryLocation_idx" ON "Store"("primaryInventoryLocation");

-- CreateIndex
CREATE UNIQUE INDEX "Register_lookupKey_key" ON "Register"("lookupKey");

-- CreateIndex
CREATE INDEX "Register_business_idx" ON "Register"("business");

-- CreateIndex
CREATE INDEX "Register_store_idx" ON "Register"("store");

-- CreateIndex
CREATE INDEX "Register_code_idx" ON "Register"("code");

-- CreateIndex
CREATE INDEX "Register_deviceIdentifier_idx" ON "Register"("deviceIdentifier");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_shiftNumber_key" ON "Shift"("shiftNumber");

-- CreateIndex
CREATE INDEX "Shift_business_idx" ON "Shift"("business");

-- CreateIndex
CREATE INDEX "Shift_store_idx" ON "Shift"("store");

-- CreateIndex
CREATE INDEX "Shift_employee_idx" ON "Shift"("employee");

-- CreateIndex
CREATE UNIQUE INDEX "RegisterSession_sessionNumber_key" ON "RegisterSession"("sessionNumber");

-- CreateIndex
CREATE INDEX "RegisterSession_business_idx" ON "RegisterSession"("business");

-- CreateIndex
CREATE INDEX "RegisterSession_store_idx" ON "RegisterSession"("store");

-- CreateIndex
CREATE INDEX "RegisterSession_register_idx" ON "RegisterSession"("register");

-- CreateIndex
CREATE INDEX "RegisterSession_employee_idx" ON "RegisterSession"("employee");

-- CreateIndex
CREATE INDEX "RegisterSession_shift_idx" ON "RegisterSession"("shift");

-- CreateIndex
CREATE UNIQUE INDEX "CashMovement_tender_key" ON "CashMovement"("tender");

-- CreateIndex
CREATE INDEX "CashMovement_business_idx" ON "CashMovement"("business");

-- CreateIndex
CREATE INDEX "CashMovement_store_idx" ON "CashMovement"("store");

-- CreateIndex
CREATE INDEX "CashMovement_registerSession_idx" ON "CashMovement"("registerSession");

-- CreateIndex
CREATE INDEX "CashMovement_employee_idx" ON "CashMovement"("employee");

-- CreateIndex
CREATE INDEX "CashMovement_sale_idx" ON "CashMovement"("sale");

-- CreateIndex
CREATE INDEX "CashMovement_refund_idx" ON "CashMovement"("refund");

-- CreateIndex
CREATE INDEX "CashMovement_idempotency_idx" ON "CashMovement"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_lookupKey_key" ON "ProductCategory"("lookupKey");

-- CreateIndex
CREATE INDEX "ProductCategory_business_idx" ON "ProductCategory"("business");

-- CreateIndex
CREATE INDEX "ProductCategory_code_idx" ON "ProductCategory"("code");

-- CreateIndex
CREATE INDEX "ProductCategory_parent_idx" ON "ProductCategory"("parent");

-- CreateIndex
CREATE UNIQUE INDEX "Product_lookupKey_key" ON "Product"("lookupKey");

-- CreateIndex
CREATE INDEX "Product_business_idx" ON "Product"("business");

-- CreateIndex
CREATE INDEX "Product_handle_idx" ON "Product"("handle");

-- CreateIndex
CREATE INDEX "Product_taxCategory_idx" ON "Product"("taxCategory");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_lookupKey_key" ON "ProductVariant"("lookupKey");

-- CreateIndex
CREATE INDEX "ProductVariant_business_idx" ON "ProductVariant"("business");

-- CreateIndex
CREATE INDEX "ProductVariant_product_idx" ON "ProductVariant"("product");

-- CreateIndex
CREATE INDEX "ProductVariant_sku_idx" ON "ProductVariant"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBarcode_lookupKey_key" ON "ProductBarcode"("lookupKey");

-- CreateIndex
CREATE INDEX "ProductBarcode_business_idx" ON "ProductBarcode"("business");

-- CreateIndex
CREATE INDEX "ProductBarcode_variant_idx" ON "ProductBarcode"("variant");

-- CreateIndex
CREATE INDEX "ProductBarcode_value_idx" ON "ProductBarcode"("value");

-- CreateIndex
CREATE UNIQUE INDEX "TaxCategory_lookupKey_key" ON "TaxCategory"("lookupKey");

-- CreateIndex
CREATE INDEX "TaxCategory_business_idx" ON "TaxCategory"("business");

-- CreateIndex
CREATE INDEX "TaxCategory_code_idx" ON "TaxCategory"("code");

-- CreateIndex
CREATE INDEX "TaxRate_business_idx" ON "TaxRate"("business");

-- CreateIndex
CREATE INDEX "TaxRate_store_idx" ON "TaxRate"("store");

-- CreateIndex
CREATE INDEX "TaxRate_taxCategory_idx" ON "TaxRate"("taxCategory");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBook_lookupKey_key" ON "PriceBook"("lookupKey");

-- CreateIndex
CREATE INDEX "PriceBook_business_idx" ON "PriceBook"("business");

-- CreateIndex
CREATE INDEX "PriceBook_code_idx" ON "PriceBook"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PriceBookEntry_lookupKey_key" ON "PriceBookEntry"("lookupKey");

-- CreateIndex
CREATE INDEX "PriceBookEntry_business_idx" ON "PriceBookEntry"("business");

-- CreateIndex
CREATE INDEX "PriceBookEntry_priceBook_idx" ON "PriceBookEntry"("priceBook");

-- CreateIndex
CREATE INDEX "PriceBookEntry_variant_idx" ON "PriceBookEntry"("variant");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_lookupKey_key" ON "Promotion"("lookupKey");

-- CreateIndex
CREATE INDEX "Promotion_business_idx" ON "Promotion"("business");

-- CreateIndex
CREATE INDEX "Promotion_code_idx" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "PromotionRule_business_idx" ON "PromotionRule"("business");

-- CreateIndex
CREATE INDEX "PromotionRule_promotion_idx" ON "PromotionRule"("promotion");

-- CreateIndex
CREATE INDEX "PromotionRedemption_business_idx" ON "PromotionRedemption"("business");

-- CreateIndex
CREATE INDEX "PromotionRedemption_store_idx" ON "PromotionRedemption"("store");

-- CreateIndex
CREATE INDEX "PromotionRedemption_promotion_idx" ON "PromotionRedemption"("promotion");

-- CreateIndex
CREATE INDEX "PromotionRedemption_sale_idx" ON "PromotionRedemption"("sale");

-- CreateIndex
CREATE INDEX "PromotionRedemption_loyaltyAccount_idx" ON "PromotionRedemption"("loyaltyAccount");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyProgram_lookupKey_key" ON "LoyaltyProgram"("lookupKey");

-- CreateIndex
CREATE INDEX "LoyaltyProgram_business_idx" ON "LoyaltyProgram"("business");

-- CreateIndex
CREATE INDEX "LoyaltyProgram_code_idx" ON "LoyaltyProgram"("code");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_lookupKey_key" ON "LoyaltyAccount"("lookupKey");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_business_idx" ON "LoyaltyAccount"("business");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_program_idx" ON "LoyaltyAccount"("program");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_user_idx" ON "LoyaltyAccount"("user");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_accountNumber_idx" ON "LoyaltyAccount"("accountNumber");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_email_idx" ON "LoyaltyAccount"("email");

-- CreateIndex
CREATE INDEX "LoyaltyAccount_phone_idx" ON "LoyaltyAccount"("phone");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_business_idx" ON "LoyaltyLedgerEntry"("business");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_store_idx" ON "LoyaltyLedgerEntry"("store");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_account_idx" ON "LoyaltyLedgerEntry"("account");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_sale_idx" ON "LoyaltyLedgerEntry"("sale");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_refund_idx" ON "LoyaltyLedgerEntry"("refund");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_actor_idx" ON "LoyaltyLedgerEntry"("actor");

-- CreateIndex
CREATE INDEX "LoyaltyLedgerEntry_idempotency_idx" ON "LoyaltyLedgerEntry"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLocation_lookupKey_key" ON "InventoryLocation"("lookupKey");

-- CreateIndex
CREATE INDEX "InventoryLocation_business_idx" ON "InventoryLocation"("business");

-- CreateIndex
CREATE INDEX "InventoryLocation_store_idx" ON "InventoryLocation"("store");

-- CreateIndex
CREATE INDEX "InventoryLocation_code_idx" ON "InventoryLocation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StockLevel_lookupKey_key" ON "StockLevel"("lookupKey");

-- CreateIndex
CREATE INDEX "StockLevel_business_idx" ON "StockLevel"("business");

-- CreateIndex
CREATE INDEX "StockLevel_store_idx" ON "StockLevel"("store");

-- CreateIndex
CREATE INDEX "StockLevel_location_idx" ON "StockLevel"("location");

-- CreateIndex
CREATE INDEX "StockLevel_variant_idx" ON "StockLevel"("variant");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLot_lookupKey_key" ON "InventoryLot"("lookupKey");

-- CreateIndex
CREATE INDEX "InventoryLot_business_idx" ON "InventoryLot"("business");

-- CreateIndex
CREATE INDEX "InventoryLot_store_idx" ON "InventoryLot"("store");

-- CreateIndex
CREATE INDEX "InventoryLot_location_idx" ON "InventoryLot"("location");

-- CreateIndex
CREATE INDEX "InventoryLot_variant_idx" ON "InventoryLot"("variant");

-- CreateIndex
CREATE INDEX "InventoryLot_vendor_idx" ON "InventoryLot"("vendor");

-- CreateIndex
CREATE INDEX "InventoryLot_receivingLine_idx" ON "InventoryLot"("receivingLine");

-- CreateIndex
CREATE INDEX "InventoryLot_lotNumber_idx" ON "InventoryLot"("lotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLedgerEntry_returnLine_key" ON "InventoryLedgerEntry"("returnLine");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryLedgerEntry_wasteEvent_key" ON "InventoryLedgerEntry"("wasteEvent");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_business_idx" ON "InventoryLedgerEntry"("business");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_store_idx" ON "InventoryLedgerEntry"("store");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_stockLevel_idx" ON "InventoryLedgerEntry"("stockLevel");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_location_idx" ON "InventoryLedgerEntry"("location");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_variant_idx" ON "InventoryLedgerEntry"("variant");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_lot_idx" ON "InventoryLedgerEntry"("lot");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_sourceId_idx" ON "InventoryLedgerEntry"("sourceId");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_receivingLine_idx" ON "InventoryLedgerEntry"("receivingLine");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_saleLine_idx" ON "InventoryLedgerEntry"("saleLine");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_actor_idx" ON "InventoryLedgerEntry"("actor");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_idempotency_idx" ON "InventoryLedgerEntry"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCount_countNumber_key" ON "InventoryCount"("countNumber");

-- CreateIndex
CREATE INDEX "InventoryCount_business_idx" ON "InventoryCount"("business");

-- CreateIndex
CREATE INDEX "InventoryCount_store_idx" ON "InventoryCount"("store");

-- CreateIndex
CREATE INDEX "InventoryCount_location_idx" ON "InventoryCount"("location");

-- CreateIndex
CREATE INDEX "InventoryCount_createdBy_idx" ON "InventoryCount"("createdBy");

-- CreateIndex
CREATE INDEX "InventoryCount_approvedBy_idx" ON "InventoryCount"("approvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCountLine_ledgerEntry_key" ON "InventoryCountLine"("ledgerEntry");

-- CreateIndex
CREATE INDEX "InventoryCountLine_business_idx" ON "InventoryCountLine"("business");

-- CreateIndex
CREATE INDEX "InventoryCountLine_store_idx" ON "InventoryCountLine"("store");

-- CreateIndex
CREATE INDEX "InventoryCountLine_count_idx" ON "InventoryCountLine"("count");

-- CreateIndex
CREATE INDEX "InventoryCountLine_stockLevel_idx" ON "InventoryCountLine"("stockLevel");

-- CreateIndex
CREATE INDEX "InventoryCountLine_variant_idx" ON "InventoryCountLine"("variant");

-- CreateIndex
CREATE INDEX "InventoryCountLine_countedBy_idx" ON "InventoryCountLine"("countedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_lookupKey_key" ON "Vendor"("lookupKey");

-- CreateIndex
CREATE INDEX "Vendor_business_idx" ON "Vendor"("business");

-- CreateIndex
CREATE INDEX "Vendor_vendorNumber_idx" ON "Vendor"("vendorNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VendorItem_lookupKey_key" ON "VendorItem"("lookupKey");

-- CreateIndex
CREATE INDEX "VendorItem_business_idx" ON "VendorItem"("business");

-- CreateIndex
CREATE INDEX "VendorItem_vendor_idx" ON "VendorItem"("vendor");

-- CreateIndex
CREATE INDEX "VendorItem_variant_idx" ON "VendorItem"("variant");

-- CreateIndex
CREATE INDEX "VendorItem_vendorSku_idx" ON "VendorItem"("vendorSku");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "PurchaseOrder_business_idx" ON "PurchaseOrder"("business");

-- CreateIndex
CREATE INDEX "PurchaseOrder_store_idx" ON "PurchaseOrder"("store");

-- CreateIndex
CREATE INDEX "PurchaseOrder_vendor_idx" ON "PurchaseOrder"("vendor");

-- CreateIndex
CREATE INDEX "PurchaseOrder_createdBy_idx" ON "PurchaseOrder"("createdBy");

-- CreateIndex
CREATE INDEX "PurchaseOrder_approvedBy_idx" ON "PurchaseOrder"("approvedBy");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_business_idx" ON "PurchaseOrderLine"("business");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_store_idx" ON "PurchaseOrderLine"("store");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseOrder_idx" ON "PurchaseOrderLine"("purchaseOrder");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_vendorItem_idx" ON "PurchaseOrderLine"("vendorItem");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_variant_idx" ON "PurchaseOrderLine"("variant");

-- CreateIndex
CREATE UNIQUE INDEX "Receiving_receivingNumber_key" ON "Receiving"("receivingNumber");

-- CreateIndex
CREATE INDEX "Receiving_business_idx" ON "Receiving"("business");

-- CreateIndex
CREATE INDEX "Receiving_store_idx" ON "Receiving"("store");

-- CreateIndex
CREATE INDEX "Receiving_purchaseOrder_idx" ON "Receiving"("purchaseOrder");

-- CreateIndex
CREATE INDEX "Receiving_vendor_idx" ON "Receiving"("vendor");

-- CreateIndex
CREATE INDEX "Receiving_vendorDocumentNumber_idx" ON "Receiving"("vendorDocumentNumber");

-- CreateIndex
CREATE INDEX "Receiving_receivedBy_idx" ON "Receiving"("receivedBy");

-- CreateIndex
CREATE INDEX "ReceivingLine_business_idx" ON "ReceivingLine"("business");

-- CreateIndex
CREATE INDEX "ReceivingLine_store_idx" ON "ReceivingLine"("store");

-- CreateIndex
CREATE INDEX "ReceivingLine_receiving_idx" ON "ReceivingLine"("receiving");

-- CreateIndex
CREATE INDEX "ReceivingLine_purchaseOrderLine_idx" ON "ReceivingLine"("purchaseOrderLine");

-- CreateIndex
CREATE INDEX "ReceivingLine_variant_idx" ON "ReceivingLine"("variant");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_cartNumber_key" ON "Cart"("cartNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Cart_sale_key" ON "Cart"("sale");

-- CreateIndex
CREATE INDEX "Cart_business_idx" ON "Cart"("business");

-- CreateIndex
CREATE INDEX "Cart_store_idx" ON "Cart"("store");

-- CreateIndex
CREATE INDEX "Cart_registerSession_idx" ON "Cart"("registerSession");

-- CreateIndex
CREATE INDEX "Cart_cashier_idx" ON "Cart"("cashier");

-- CreateIndex
CREATE INDEX "Cart_customer_idx" ON "Cart"("customer");

-- CreateIndex
CREATE INDEX "Cart_loyaltyAccount_idx" ON "Cart"("loyaltyAccount");

-- CreateIndex
CREATE INDEX "Cart_priceBook_idx" ON "Cart"("priceBook");

-- CreateIndex
CREATE INDEX "Cart_guestTokenDigest_idx" ON "Cart"("guestTokenDigest");

-- CreateIndex
CREATE INDEX "CartLine_business_idx" ON "CartLine"("business");

-- CreateIndex
CREATE INDEX "CartLine_store_idx" ON "CartLine"("store");

-- CreateIndex
CREATE INDEX "CartLine_cart_idx" ON "CartLine"("cart");

-- CreateIndex
CREATE INDEX "CartLine_variant_idx" ON "CartLine"("variant");

-- CreateIndex
CREATE INDEX "CartLine_barcode_idx" ON "CartLine"("barcode");

-- CreateIndex
CREATE INDEX "CartLine_priceBookEntry_idx" ON "CartLine"("priceBookEntry");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_receiptNumber_key" ON "Sale"("receiptNumber");

-- CreateIndex
CREATE INDEX "Sale_business_idx" ON "Sale"("business");

-- CreateIndex
CREATE INDEX "Sale_store_idx" ON "Sale"("store");

-- CreateIndex
CREATE INDEX "Sale_registerSession_idx" ON "Sale"("registerSession");

-- CreateIndex
CREATE INDEX "Sale_cashier_idx" ON "Sale"("cashier");

-- CreateIndex
CREATE INDEX "Sale_customer_idx" ON "Sale"("customer");

-- CreateIndex
CREATE INDEX "Sale_loyaltyAccount_idx" ON "Sale"("loyaltyAccount");

-- CreateIndex
CREATE INDEX "Sale_idempotency_idx" ON "Sale"("idempotency");

-- CreateIndex
CREATE INDEX "SaleLine_business_idx" ON "SaleLine"("business");

-- CreateIndex
CREATE INDEX "SaleLine_store_idx" ON "SaleLine"("store");

-- CreateIndex
CREATE INDEX "SaleLine_sale_idx" ON "SaleLine"("sale");

-- CreateIndex
CREATE INDEX "SaleLine_product_idx" ON "SaleLine"("product");

-- CreateIndex
CREATE INDEX "SaleLine_variant_idx" ON "SaleLine"("variant");

-- CreateIndex
CREATE INDEX "SaleLine_barcode_idx" ON "SaleLine"("barcode");

-- CreateIndex
CREATE INDEX "SaleLine_ageVerification_idx" ON "SaleLine"("ageVerification");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProvider_lookupKey_key" ON "PaymentProvider"("lookupKey");

-- CreateIndex
CREATE INDEX "PaymentProvider_business_idx" ON "PaymentProvider"("business");

-- CreateIndex
CREATE INDEX "PaymentProvider_code_idx" ON "PaymentProvider"("code");

-- CreateIndex
CREATE INDEX "Tender_business_idx" ON "Tender"("business");

-- CreateIndex
CREATE INDEX "Tender_store_idx" ON "Tender"("store");

-- CreateIndex
CREATE INDEX "Tender_sale_idx" ON "Tender"("sale");

-- CreateIndex
CREATE INDEX "Tender_paymentProvider_idx" ON "Tender"("paymentProvider");

-- CreateIndex
CREATE INDEX "Tender_providerPaymentId_idx" ON "Tender"("providerPaymentId");

-- CreateIndex
CREATE INDEX "Tender_processedBy_idx" ON "Tender"("processedBy");

-- CreateIndex
CREATE INDEX "Tender_idempotency_idx" ON "Tender"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_refundNumber_key" ON "Refund"("refundNumber");

-- CreateIndex
CREATE INDEX "Refund_business_idx" ON "Refund"("business");

-- CreateIndex
CREATE INDEX "Refund_store_idx" ON "Refund"("store");

-- CreateIndex
CREATE INDEX "Refund_sale_idx" ON "Refund"("sale");

-- CreateIndex
CREATE INDEX "Refund_originalTender_idx" ON "Refund"("originalTender");

-- CreateIndex
CREATE INDEX "Refund_providerRefundId_idx" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE INDEX "Refund_requestedBy_idx" ON "Refund"("requestedBy");

-- CreateIndex
CREATE INDEX "Refund_approvedBy_idx" ON "Refund"("approvedBy");

-- CreateIndex
CREATE INDEX "Refund_processedBy_idx" ON "Refund"("processedBy");

-- CreateIndex
CREATE INDEX "Refund_idempotency_idx" ON "Refund"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "RefundLine_returnLine_key" ON "RefundLine"("returnLine");

-- CreateIndex
CREATE INDEX "RefundLine_business_idx" ON "RefundLine"("business");

-- CreateIndex
CREATE INDEX "RefundLine_store_idx" ON "RefundLine"("store");

-- CreateIndex
CREATE INDEX "RefundLine_refund_idx" ON "RefundLine"("refund");

-- CreateIndex
CREATE INDEX "RefundLine_saleLine_idx" ON "RefundLine"("saleLine");

-- CreateIndex
CREATE UNIQUE INDEX "Return_returnNumber_key" ON "Return"("returnNumber");

-- CreateIndex
CREATE INDEX "Return_business_idx" ON "Return"("business");

-- CreateIndex
CREATE INDEX "Return_store_idx" ON "Return"("store");

-- CreateIndex
CREATE INDEX "Return_sale_idx" ON "Return"("sale");

-- CreateIndex
CREATE INDEX "Return_refund_idx" ON "Return"("refund");

-- CreateIndex
CREATE INDEX "Return_requestedBy_idx" ON "Return"("requestedBy");

-- CreateIndex
CREATE INDEX "Return_approvedBy_idx" ON "Return"("approvedBy");

-- CreateIndex
CREATE INDEX "Return_receivedBy_idx" ON "Return"("receivedBy");

-- CreateIndex
CREATE INDEX "Return_idempotency_idx" ON "Return"("idempotency");

-- CreateIndex
CREATE INDEX "ReturnLine_business_idx" ON "ReturnLine"("business");

-- CreateIndex
CREATE INDEX "ReturnLine_store_idx" ON "ReturnLine"("store");

-- CreateIndex
CREATE INDEX "ReturnLine_return_idx" ON "ReturnLine"("return");

-- CreateIndex
CREATE INDEX "ReturnLine_saleLine_idx" ON "ReturnLine"("saleLine");

-- CreateIndex
CREATE UNIQUE INDEX "CompliancePolicy_lookupKey_key" ON "CompliancePolicy"("lookupKey");

-- CreateIndex
CREATE INDEX "CompliancePolicy_business_idx" ON "CompliancePolicy"("business");

-- CreateIndex
CREATE INDEX "CompliancePolicy_code_idx" ON "CompliancePolicy"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AgeVerification_verificationNumber_key" ON "AgeVerification"("verificationNumber");

-- CreateIndex
CREATE INDEX "AgeVerification_business_idx" ON "AgeVerification"("business");

-- CreateIndex
CREATE INDEX "AgeVerification_store_idx" ON "AgeVerification"("store");

-- CreateIndex
CREATE INDEX "AgeVerification_policy_idx" ON "AgeVerification"("policy");

-- CreateIndex
CREATE INDEX "AgeVerification_cart_idx" ON "AgeVerification"("cart");

-- CreateIndex
CREATE INDEX "AgeVerification_sale_idx" ON "AgeVerification"("sale");

-- CreateIndex
CREATE INDEX "AgeVerification_verifiedBy_idx" ON "AgeVerification"("verifiedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceIncident_incidentNumber_key" ON "ComplianceIncident"("incidentNumber");

-- CreateIndex
CREATE INDEX "ComplianceIncident_business_idx" ON "ComplianceIncident"("business");

-- CreateIndex
CREATE INDEX "ComplianceIncident_store_idx" ON "ComplianceIncident"("store");

-- CreateIndex
CREATE INDEX "ComplianceIncident_policy_idx" ON "ComplianceIncident"("policy");

-- CreateIndex
CREATE INDEX "ComplianceIncident_ageVerification_idx" ON "ComplianceIncident"("ageVerification");

-- CreateIndex
CREATE INDEX "ComplianceIncident_sale_idx" ON "ComplianceIncident"("sale");

-- CreateIndex
CREATE INDEX "ComplianceIncident_reportedBy_idx" ON "ComplianceIncident"("reportedBy");

-- CreateIndex
CREATE INDEX "ComplianceIncident_resolvedBy_idx" ON "ComplianceIncident"("resolvedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_lookupKey_key" ON "Recipe"("lookupKey");

-- CreateIndex
CREATE INDEX "Recipe_business_idx" ON "Recipe"("business");

-- CreateIndex
CREATE INDEX "Recipe_code_idx" ON "Recipe"("code");

-- CreateIndex
CREATE INDEX "Recipe_outputVariant_idx" ON "Recipe"("outputVariant");

-- CreateIndex
CREATE INDEX "RecipeIngredient_business_idx" ON "RecipeIngredient"("business");

-- CreateIndex
CREATE INDEX "RecipeIngredient_recipe_idx" ON "RecipeIngredient"("recipe");

-- CreateIndex
CREATE INDEX "RecipeIngredient_inputVariant_idx" ON "RecipeIngredient"("inputVariant");

-- CreateIndex
CREATE UNIQUE INDEX "PrepBatch_batchNumber_key" ON "PrepBatch"("batchNumber");

-- CreateIndex
CREATE INDEX "PrepBatch_business_idx" ON "PrepBatch"("business");

-- CreateIndex
CREATE INDEX "PrepBatch_store_idx" ON "PrepBatch"("store");

-- CreateIndex
CREATE INDEX "PrepBatch_recipe_idx" ON "PrepBatch"("recipe");

-- CreateIndex
CREATE INDEX "PrepBatch_outputLot_idx" ON "PrepBatch"("outputLot");

-- CreateIndex
CREATE INDEX "PrepBatch_preparedBy_idx" ON "PrepBatch"("preparedBy");

-- CreateIndex
CREATE UNIQUE INDEX "WasteEvent_eventNumber_key" ON "WasteEvent"("eventNumber");

-- CreateIndex
CREATE INDEX "WasteEvent_business_idx" ON "WasteEvent"("business");

-- CreateIndex
CREATE INDEX "WasteEvent_store_idx" ON "WasteEvent"("store");

-- CreateIndex
CREATE INDEX "WasteEvent_variant_idx" ON "WasteEvent"("variant");

-- CreateIndex
CREATE INDEX "WasteEvent_lot_idx" ON "WasteEvent"("lot");

-- CreateIndex
CREATE INDEX "WasteEvent_prepBatch_idx" ON "WasteEvent"("prepBatch");

-- CreateIndex
CREATE INDEX "WasteEvent_loggedBy_idx" ON "WasteEvent"("loggedBy");

-- CreateIndex
CREATE INDEX "WasteEvent_idempotency_idx" ON "WasteEvent"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "FuelSite_lookupKey_key" ON "FuelSite"("lookupKey");

-- CreateIndex
CREATE INDEX "FuelSite_business_idx" ON "FuelSite"("business");

-- CreateIndex
CREATE INDEX "FuelSite_store_idx" ON "FuelSite"("store");

-- CreateIndex
CREATE INDEX "FuelSite_siteCode_idx" ON "FuelSite"("siteCode");

-- CreateIndex
CREATE UNIQUE INDEX "FuelGrade_lookupKey_key" ON "FuelGrade"("lookupKey");

-- CreateIndex
CREATE INDEX "FuelGrade_business_idx" ON "FuelGrade"("business");

-- CreateIndex
CREATE INDEX "FuelGrade_store_idx" ON "FuelGrade"("store");

-- CreateIndex
CREATE INDEX "FuelGrade_site_idx" ON "FuelGrade"("site");

-- CreateIndex
CREATE INDEX "FuelGrade_code_idx" ON "FuelGrade"("code");

-- CreateIndex
CREATE UNIQUE INDEX "FuelTank_lookupKey_key" ON "FuelTank"("lookupKey");

-- CreateIndex
CREATE INDEX "FuelTank_business_idx" ON "FuelTank"("business");

-- CreateIndex
CREATE INDEX "FuelTank_store_idx" ON "FuelTank"("store");

-- CreateIndex
CREATE INDEX "FuelTank_site_idx" ON "FuelTank"("site");

-- CreateIndex
CREATE INDEX "FuelTank_grade_idx" ON "FuelTank"("grade");

-- CreateIndex
CREATE INDEX "FuelTank_tankNumber_idx" ON "FuelTank"("tankNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FuelPump_lookupKey_key" ON "FuelPump"("lookupKey");

-- CreateIndex
CREATE INDEX "FuelPump_business_idx" ON "FuelPump"("business");

-- CreateIndex
CREATE INDEX "FuelPump_store_idx" ON "FuelPump"("store");

-- CreateIndex
CREATE INDEX "FuelPump_site_idx" ON "FuelPump"("site");

-- CreateIndex
CREATE INDEX "FuelPump_pumpNumber_idx" ON "FuelPump"("pumpNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FuelNozzle_lookupKey_key" ON "FuelNozzle"("lookupKey");

-- CreateIndex
CREATE INDEX "FuelNozzle_business_idx" ON "FuelNozzle"("business");

-- CreateIndex
CREATE INDEX "FuelNozzle_store_idx" ON "FuelNozzle"("store");

-- CreateIndex
CREATE INDEX "FuelNozzle_pump_idx" ON "FuelNozzle"("pump");

-- CreateIndex
CREATE INDEX "FuelNozzle_tank_idx" ON "FuelNozzle"("tank");

-- CreateIndex
CREATE INDEX "FuelNozzle_grade_idx" ON "FuelNozzle"("grade");

-- CreateIndex
CREATE UNIQUE INDEX "FuelPrice_lookupKey_key" ON "FuelPrice"("lookupKey");

-- CreateIndex
CREATE INDEX "FuelPrice_business_idx" ON "FuelPrice"("business");

-- CreateIndex
CREATE INDEX "FuelPrice_store_idx" ON "FuelPrice"("store");

-- CreateIndex
CREATE INDEX "FuelPrice_site_idx" ON "FuelPrice"("site");

-- CreateIndex
CREATE INDEX "FuelPrice_grade_idx" ON "FuelPrice"("grade");

-- CreateIndex
CREATE INDEX "FuelPrice_authorizedBy_idx" ON "FuelPrice"("authorizedBy");

-- CreateIndex
CREATE UNIQUE INDEX "FuelTransaction_transactionNumber_key" ON "FuelTransaction"("transactionNumber");

-- CreateIndex
CREATE INDEX "FuelTransaction_business_idx" ON "FuelTransaction"("business");

-- CreateIndex
CREATE INDEX "FuelTransaction_store_idx" ON "FuelTransaction"("store");

-- CreateIndex
CREATE INDEX "FuelTransaction_site_idx" ON "FuelTransaction"("site");

-- CreateIndex
CREATE INDEX "FuelTransaction_pump_idx" ON "FuelTransaction"("pump");

-- CreateIndex
CREATE INDEX "FuelTransaction_nozzle_idx" ON "FuelTransaction"("nozzle");

-- CreateIndex
CREATE INDEX "FuelTransaction_grade_idx" ON "FuelTransaction"("grade");

-- CreateIndex
CREATE INDEX "FuelTransaction_controllerTransactionId_idx" ON "FuelTransaction"("controllerTransactionId");

-- CreateIndex
CREATE INDEX "FuelTransaction_sale_idx" ON "FuelTransaction"("sale");

-- CreateIndex
CREATE INDEX "FuelTransaction_tender_idx" ON "FuelTransaction"("tender");

-- CreateIndex
CREATE INDEX "FuelTransaction_idempotency_idx" ON "FuelTransaction"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "FuelDelivery_deliveryNumber_key" ON "FuelDelivery"("deliveryNumber");

-- CreateIndex
CREATE INDEX "FuelDelivery_business_idx" ON "FuelDelivery"("business");

-- CreateIndex
CREATE INDEX "FuelDelivery_store_idx" ON "FuelDelivery"("store");

-- CreateIndex
CREATE INDEX "FuelDelivery_site_idx" ON "FuelDelivery"("site");

-- CreateIndex
CREATE INDEX "FuelDelivery_tank_idx" ON "FuelDelivery"("tank");

-- CreateIndex
CREATE INDEX "FuelDelivery_vendor_idx" ON "FuelDelivery"("vendor");

-- CreateIndex
CREATE INDEX "FuelDelivery_billOfLadingNumber_idx" ON "FuelDelivery"("billOfLadingNumber");

-- CreateIndex
CREATE INDEX "FuelDelivery_receivedBy_idx" ON "FuelDelivery"("receivedBy");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_lookupKey_key" ON "ApiKey"("lookupKey");

-- CreateIndex
CREATE INDEX "ApiKey_business_idx" ON "ApiKey"("business");

-- CreateIndex
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");

-- CreateIndex
CREATE INDEX "ApiKey_createdBy_idx" ON "ApiKey"("createdBy");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_lookupKey_key" ON "IdempotencyKey"("lookupKey");

-- CreateIndex
CREATE INDEX "IdempotencyKey_business_idx" ON "IdempotencyKey"("business");

-- CreateIndex
CREATE INDEX "IdempotencyKey_scope_idx" ON "IdempotencyKey"("scope");

-- CreateIndex
CREATE INDEX "IdempotencyKey_keyDigest_idx" ON "IdempotencyKey"("keyDigest");

-- CreateIndex
CREATE INDEX "IdempotencyKey_actorUser_idx" ON "IdempotencyKey"("actorUser");

-- CreateIndex
CREATE INDEX "IdempotencyKey_actorApiKey_idx" ON "IdempotencyKey"("actorApiKey");

-- CreateIndex
CREATE UNIQUE INDEX "AuditEvent_eventNumber_key" ON "AuditEvent"("eventNumber");

-- CreateIndex
CREATE INDEX "AuditEvent_business_idx" ON "AuditEvent"("business");

-- CreateIndex
CREATE INDEX "AuditEvent_store_idx" ON "AuditEvent"("store");

-- CreateIndex
CREATE INDEX "AuditEvent_action_idx" ON "AuditEvent"("action");

-- CreateIndex
CREATE INDEX "AuditEvent_resourceType_idx" ON "AuditEvent"("resourceType");

-- CreateIndex
CREATE INDEX "AuditEvent_resourceId_idx" ON "AuditEvent"("resourceId");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUser_idx" ON "AuditEvent"("actorUser");

-- CreateIndex
CREATE INDEX "AuditEvent_actorEmployee_idx" ON "AuditEvent"("actorEmployee");

-- CreateIndex
CREATE INDEX "AuditEvent_actorApiKey_idx" ON "AuditEvent"("actorApiKey");

-- CreateIndex
CREATE INDEX "AuditEvent_requestId_idx" ON "AuditEvent"("requestId");

-- CreateIndex
CREATE INDEX "AuditEvent_idempotency_idx" ON "AuditEvent"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_lookupKey_key" ON "WebhookEvent"("lookupKey");

-- CreateIndex
CREATE INDEX "WebhookEvent_business_idx" ON "WebhookEvent"("business");

-- CreateIndex
CREATE INDEX "WebhookEvent_paymentProvider_idx" ON "WebhookEvent"("paymentProvider");

-- CreateIndex
CREATE INDEX "WebhookEvent_externalEventId_idx" ON "WebhookEvent"("externalEventId");

-- CreateIndex
CREATE INDEX "WebhookEvent_eventType_idx" ON "WebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "WebhookEvent_idempotency_idx" ON "WebhookEvent"("idempotency");

-- CreateIndex
CREATE UNIQUE INDEX "_Employee_stores_AB_unique" ON "_Employee_stores"("A", "B");

-- CreateIndex
CREATE INDEX "_Employee_stores_B_index" ON "_Employee_stores"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PromotionRule_categories_AB_unique" ON "_PromotionRule_categories"("A", "B");

-- CreateIndex
CREATE INDEX "_PromotionRule_categories_B_index" ON "_PromotionRule_categories"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Product_categories_AB_unique" ON "_Product_categories"("A", "B");

-- CreateIndex
CREATE INDEX "_Product_categories_B_index" ON "_Product_categories"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PromotionRule_products_AB_unique" ON "_PromotionRule_products"("A", "B");

-- CreateIndex
CREATE INDEX "_PromotionRule_products_B_index" ON "_PromotionRule_products"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_PriceBook_stores_AB_unique" ON "_PriceBook_stores"("A", "B");

-- CreateIndex
CREATE INDEX "_PriceBook_stores_B_index" ON "_PriceBook_stores"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Promotion_stores_AB_unique" ON "_Promotion_stores"("A", "B");

-- CreateIndex
CREATE INDEX "_Promotion_stores_B_index" ON "_Promotion_stores"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_Cart_promotions_AB_unique" ON "_Cart_promotions"("A", "B");

-- CreateIndex
CREATE INDEX "_Cart_promotions_B_index" ON "_Cart_promotions"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CartLine_promotions_AB_unique" ON "_CartLine_promotions"("A", "B");

-- CreateIndex
CREATE INDEX "_CartLine_promotions_B_index" ON "_CartLine_promotions"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CompliancePolicy_stores_AB_unique" ON "_CompliancePolicy_stores"("A", "B");

-- CreateIndex
CREATE INDEX "_CompliancePolicy_stores_B_index" ON "_CompliancePolicy_stores"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CompliancePolicy_products_AB_unique" ON "_CompliancePolicy_products"("A", "B");

-- CreateIndex
CREATE INDEX "_CompliancePolicy_products_B_index" ON "_CompliancePolicy_products"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_CompliancePolicy_categories_AB_unique" ON "_CompliancePolicy_categories"("A", "B");

-- CreateIndex
CREATE INDEX "_CompliancePolicy_categories_B_index" ON "_CompliancePolicy_categories"("B");

-- CreateIndex
CREATE INDEX "Role_business_idx" ON "Role"("business");

-- AddForeignKey
ALTER TABLE "Role" ADD CONSTRAINT "Role_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_role_fkey" FOREIGN KEY ("role") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_manager_fkey" FOREIGN KEY ("manager") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_defaultPriceBook_fkey" FOREIGN KEY ("defaultPriceBook") REFERENCES "PriceBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_primaryInventoryLocation_fkey" FOREIGN KEY ("primaryInventoryLocation") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Register" ADD CONSTRAINT "Register_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Register" ADD CONSTRAINT "Register_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_register_fkey" FOREIGN KEY ("register") REFERENCES "Register"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_shift_fkey" FOREIGN KEY ("shift") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_registerSession_fkey" FOREIGN KEY ("registerSession") REFERENCES "RegisterSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_employee_fkey" FOREIGN KEY ("employee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_tender_fkey" FOREIGN KEY ("tender") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_refund_fkey" FOREIGN KEY ("refund") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parent_fkey" FOREIGN KEY ("parent") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_taxCategory_fkey" FOREIGN KEY ("taxCategory") REFERENCES "TaxCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBarcode" ADD CONSTRAINT "ProductBarcode_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBarcode" ADD CONSTRAINT "ProductBarcode_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxCategory" ADD CONSTRAINT "TaxCategory_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_taxCategory_fkey" FOREIGN KEY ("taxCategory") REFERENCES "TaxCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBook" ADD CONSTRAINT "PriceBook_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookEntry" ADD CONSTRAINT "PriceBookEntry_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookEntry" ADD CONSTRAINT "PriceBookEntry_priceBook_fkey" FOREIGN KEY ("priceBook") REFERENCES "PriceBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceBookEntry" ADD CONSTRAINT "PriceBookEntry_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_promotion_fkey" FOREIGN KEY ("promotion") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_promotion_fkey" FOREIGN KEY ("promotion") REFERENCES "Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_loyaltyAccount_fkey" FOREIGN KEY ("loyaltyAccount") REFERENCES "LoyaltyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_program_fkey" FOREIGN KEY ("program") REFERENCES "LoyaltyProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_user_fkey" FOREIGN KEY ("user") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_account_fkey" FOREIGN KEY ("account") REFERENCES "LoyaltyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_refund_fkey" FOREIGN KEY ("refund") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_actor_fkey" FOREIGN KEY ("actor") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLocation" ADD CONSTRAINT "InventoryLocation_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_location_fkey" FOREIGN KEY ("location") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_location_fkey" FOREIGN KEY ("location") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_vendor_fkey" FOREIGN KEY ("vendor") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_receivingLine_fkey" FOREIGN KEY ("receivingLine") REFERENCES "ReceivingLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_stockLevel_fkey" FOREIGN KEY ("stockLevel") REFERENCES "StockLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_location_fkey" FOREIGN KEY ("location") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_lot_fkey" FOREIGN KEY ("lot") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_receivingLine_fkey" FOREIGN KEY ("receivingLine") REFERENCES "ReceivingLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_saleLine_fkey" FOREIGN KEY ("saleLine") REFERENCES "SaleLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_returnLine_fkey" FOREIGN KEY ("returnLine") REFERENCES "ReturnLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_wasteEvent_fkey" FOREIGN KEY ("wasteEvent") REFERENCES "WasteEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_actor_fkey" FOREIGN KEY ("actor") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_location_fkey" FOREIGN KEY ("location") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCount" ADD CONSTRAINT "InventoryCount_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_count_fkey" FOREIGN KEY ("count") REFERENCES "InventoryCount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_stockLevel_fkey" FOREIGN KEY ("stockLevel") REFERENCES "StockLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_countedBy_fkey" FOREIGN KEY ("countedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_ledgerEntry_fkey" FOREIGN KEY ("ledgerEntry") REFERENCES "InventoryLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorItem" ADD CONSTRAINT "VendorItem_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorItem" ADD CONSTRAINT "VendorItem_vendor_fkey" FOREIGN KEY ("vendor") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorItem" ADD CONSTRAINT "VendorItem_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_vendor_fkey" FOREIGN KEY ("vendor") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseOrder_fkey" FOREIGN KEY ("purchaseOrder") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_vendorItem_fkey" FOREIGN KEY ("vendorItem") REFERENCES "VendorItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiving" ADD CONSTRAINT "Receiving_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiving" ADD CONSTRAINT "Receiving_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiving" ADD CONSTRAINT "Receiving_purchaseOrder_fkey" FOREIGN KEY ("purchaseOrder") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiving" ADD CONSTRAINT "Receiving_vendor_fkey" FOREIGN KEY ("vendor") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Receiving" ADD CONSTRAINT "Receiving_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_receiving_fkey" FOREIGN KEY ("receiving") REFERENCES "Receiving"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_purchaseOrderLine_fkey" FOREIGN KEY ("purchaseOrderLine") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_registerSession_fkey" FOREIGN KEY ("registerSession") REFERENCES "RegisterSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_cashier_fkey" FOREIGN KEY ("cashier") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_customer_fkey" FOREIGN KEY ("customer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_loyaltyAccount_fkey" FOREIGN KEY ("loyaltyAccount") REFERENCES "LoyaltyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_priceBook_fkey" FOREIGN KEY ("priceBook") REFERENCES "PriceBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_cart_fkey" FOREIGN KEY ("cart") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_barcode_fkey" FOREIGN KEY ("barcode") REFERENCES "ProductBarcode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_priceBookEntry_fkey" FOREIGN KEY ("priceBookEntry") REFERENCES "PriceBookEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_registerSession_fkey" FOREIGN KEY ("registerSession") REFERENCES "RegisterSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashier_fkey" FOREIGN KEY ("cashier") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customer_fkey" FOREIGN KEY ("customer") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_loyaltyAccount_fkey" FOREIGN KEY ("loyaltyAccount") REFERENCES "LoyaltyAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_product_fkey" FOREIGN KEY ("product") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_barcode_fkey" FOREIGN KEY ("barcode") REFERENCES "ProductBarcode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_ageVerification_fkey" FOREIGN KEY ("ageVerification") REFERENCES "AgeVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentProvider" ADD CONSTRAINT "PaymentProvider_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_paymentProvider_fkey" FOREIGN KEY ("paymentProvider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_originalTender_fkey" FOREIGN KEY ("originalTender") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_refund_fkey" FOREIGN KEY ("refund") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_saleLine_fkey" FOREIGN KEY ("saleLine") REFERENCES "SaleLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_returnLine_fkey" FOREIGN KEY ("returnLine") REFERENCES "ReturnLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_refund_fkey" FOREIGN KEY ("refund") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_return_fkey" FOREIGN KEY ("return") REFERENCES "Return"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_saleLine_fkey" FOREIGN KEY ("saleLine") REFERENCES "SaleLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompliancePolicy" ADD CONSTRAINT "CompliancePolicy_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgeVerification" ADD CONSTRAINT "AgeVerification_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgeVerification" ADD CONSTRAINT "AgeVerification_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgeVerification" ADD CONSTRAINT "AgeVerification_policy_fkey" FOREIGN KEY ("policy") REFERENCES "CompliancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgeVerification" ADD CONSTRAINT "AgeVerification_cart_fkey" FOREIGN KEY ("cart") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgeVerification" ADD CONSTRAINT "AgeVerification_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgeVerification" ADD CONSTRAINT "AgeVerification_verifiedBy_fkey" FOREIGN KEY ("verifiedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_policy_fkey" FOREIGN KEY ("policy") REFERENCES "CompliancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_ageVerification_fkey" FOREIGN KEY ("ageVerification") REFERENCES "AgeVerification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_reportedBy_fkey" FOREIGN KEY ("reportedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceIncident" ADD CONSTRAINT "ComplianceIncident_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_outputVariant_fkey" FOREIGN KEY ("outputVariant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_recipe_fkey" FOREIGN KEY ("recipe") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_inputVariant_fkey" FOREIGN KEY ("inputVariant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_recipe_fkey" FOREIGN KEY ("recipe") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_outputLot_fkey" FOREIGN KEY ("outputLot") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_preparedBy_fkey" FOREIGN KEY ("preparedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEvent" ADD CONSTRAINT "WasteEvent_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEvent" ADD CONSTRAINT "WasteEvent_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEvent" ADD CONSTRAINT "WasteEvent_variant_fkey" FOREIGN KEY ("variant") REFERENCES "ProductVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEvent" ADD CONSTRAINT "WasteEvent_lot_fkey" FOREIGN KEY ("lot") REFERENCES "InventoryLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEvent" ADD CONSTRAINT "WasteEvent_prepBatch_fkey" FOREIGN KEY ("prepBatch") REFERENCES "PrepBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEvent" ADD CONSTRAINT "WasteEvent_loggedBy_fkey" FOREIGN KEY ("loggedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteEvent" ADD CONSTRAINT "WasteEvent_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelSite" ADD CONSTRAINT "FuelSite_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelSite" ADD CONSTRAINT "FuelSite_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelGrade" ADD CONSTRAINT "FuelGrade_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelGrade" ADD CONSTRAINT "FuelGrade_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelGrade" ADD CONSTRAINT "FuelGrade_site_fkey" FOREIGN KEY ("site") REFERENCES "FuelSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTank" ADD CONSTRAINT "FuelTank_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTank" ADD CONSTRAINT "FuelTank_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTank" ADD CONSTRAINT "FuelTank_site_fkey" FOREIGN KEY ("site") REFERENCES "FuelSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTank" ADD CONSTRAINT "FuelTank_grade_fkey" FOREIGN KEY ("grade") REFERENCES "FuelGrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPump" ADD CONSTRAINT "FuelPump_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPump" ADD CONSTRAINT "FuelPump_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPump" ADD CONSTRAINT "FuelPump_site_fkey" FOREIGN KEY ("site") REFERENCES "FuelSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelNozzle" ADD CONSTRAINT "FuelNozzle_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelNozzle" ADD CONSTRAINT "FuelNozzle_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelNozzle" ADD CONSTRAINT "FuelNozzle_pump_fkey" FOREIGN KEY ("pump") REFERENCES "FuelPump"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelNozzle" ADD CONSTRAINT "FuelNozzle_tank_fkey" FOREIGN KEY ("tank") REFERENCES "FuelTank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelNozzle" ADD CONSTRAINT "FuelNozzle_grade_fkey" FOREIGN KEY ("grade") REFERENCES "FuelGrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPrice" ADD CONSTRAINT "FuelPrice_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPrice" ADD CONSTRAINT "FuelPrice_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPrice" ADD CONSTRAINT "FuelPrice_site_fkey" FOREIGN KEY ("site") REFERENCES "FuelSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPrice" ADD CONSTRAINT "FuelPrice_grade_fkey" FOREIGN KEY ("grade") REFERENCES "FuelGrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelPrice" ADD CONSTRAINT "FuelPrice_authorizedBy_fkey" FOREIGN KEY ("authorizedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_site_fkey" FOREIGN KEY ("site") REFERENCES "FuelSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_pump_fkey" FOREIGN KEY ("pump") REFERENCES "FuelPump"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_nozzle_fkey" FOREIGN KEY ("nozzle") REFERENCES "FuelNozzle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_grade_fkey" FOREIGN KEY ("grade") REFERENCES "FuelGrade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_sale_fkey" FOREIGN KEY ("sale") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_tender_fkey" FOREIGN KEY ("tender") REFERENCES "Tender"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelDelivery" ADD CONSTRAINT "FuelDelivery_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelDelivery" ADD CONSTRAINT "FuelDelivery_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelDelivery" ADD CONSTRAINT "FuelDelivery_site_fkey" FOREIGN KEY ("site") REFERENCES "FuelSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelDelivery" ADD CONSTRAINT "FuelDelivery_tank_fkey" FOREIGN KEY ("tank") REFERENCES "FuelTank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelDelivery" ADD CONSTRAINT "FuelDelivery_vendor_fkey" FOREIGN KEY ("vendor") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelDelivery" ADD CONSTRAINT "FuelDelivery_receivedBy_fkey" FOREIGN KEY ("receivedBy") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_actorUser_fkey" FOREIGN KEY ("actorUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_actorApiKey_fkey" FOREIGN KEY ("actorApiKey") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_store_fkey" FOREIGN KEY ("store") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUser_fkey" FOREIGN KEY ("actorUser") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorEmployee_fkey" FOREIGN KEY ("actorEmployee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorApiKey_fkey" FOREIGN KEY ("actorApiKey") REFERENCES "ApiKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_business_fkey" FOREIGN KEY ("business") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_paymentProvider_fkey" FOREIGN KEY ("paymentProvider") REFERENCES "PaymentProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_idempotency_fkey" FOREIGN KEY ("idempotency") REFERENCES "IdempotencyKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Employee_stores" ADD CONSTRAINT "_Employee_stores_A_fkey" FOREIGN KEY ("A") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Employee_stores" ADD CONSTRAINT "_Employee_stores_B_fkey" FOREIGN KEY ("B") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromotionRule_categories" ADD CONSTRAINT "_PromotionRule_categories_A_fkey" FOREIGN KEY ("A") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromotionRule_categories" ADD CONSTRAINT "_PromotionRule_categories_B_fkey" FOREIGN KEY ("B") REFERENCES "PromotionRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Product_categories" ADD CONSTRAINT "_Product_categories_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Product_categories" ADD CONSTRAINT "_Product_categories_B_fkey" FOREIGN KEY ("B") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromotionRule_products" ADD CONSTRAINT "_PromotionRule_products_A_fkey" FOREIGN KEY ("A") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PromotionRule_products" ADD CONSTRAINT "_PromotionRule_products_B_fkey" FOREIGN KEY ("B") REFERENCES "PromotionRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PriceBook_stores" ADD CONSTRAINT "_PriceBook_stores_A_fkey" FOREIGN KEY ("A") REFERENCES "PriceBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PriceBook_stores" ADD CONSTRAINT "_PriceBook_stores_B_fkey" FOREIGN KEY ("B") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Promotion_stores" ADD CONSTRAINT "_Promotion_stores_A_fkey" FOREIGN KEY ("A") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Promotion_stores" ADD CONSTRAINT "_Promotion_stores_B_fkey" FOREIGN KEY ("B") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Cart_promotions" ADD CONSTRAINT "_Cart_promotions_A_fkey" FOREIGN KEY ("A") REFERENCES "Cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_Cart_promotions" ADD CONSTRAINT "_Cart_promotions_B_fkey" FOREIGN KEY ("B") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CartLine_promotions" ADD CONSTRAINT "_CartLine_promotions_A_fkey" FOREIGN KEY ("A") REFERENCES "CartLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CartLine_promotions" ADD CONSTRAINT "_CartLine_promotions_B_fkey" FOREIGN KEY ("B") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompliancePolicy_stores" ADD CONSTRAINT "_CompliancePolicy_stores_A_fkey" FOREIGN KEY ("A") REFERENCES "CompliancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompliancePolicy_stores" ADD CONSTRAINT "_CompliancePolicy_stores_B_fkey" FOREIGN KEY ("B") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompliancePolicy_products" ADD CONSTRAINT "_CompliancePolicy_products_A_fkey" FOREIGN KEY ("A") REFERENCES "CompliancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompliancePolicy_products" ADD CONSTRAINT "_CompliancePolicy_products_B_fkey" FOREIGN KEY ("B") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompliancePolicy_categories" ADD CONSTRAINT "_CompliancePolicy_categories_A_fkey" FOREIGN KEY ("A") REFERENCES "CompliancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompliancePolicy_categories" ADD CONSTRAINT "_CompliancePolicy_categories_B_fkey" FOREIGN KEY ("B") REFERENCES "ProductCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;

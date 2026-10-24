import { AgeVerification } from "./AgeVerification";
import { AlertEvaluation } from "./AlertEvaluation";
import { ApiKey } from "./ApiKey";
import { AuthenticationThrottle } from "./AuthenticationThrottle";
import { AuditEvent } from "./AuditEvent";
import { BankDeposit } from "./BankDeposit";
import { Business } from "./Business";
import { Cart } from "./Cart";
import { CartLine } from "./CartLine";
import { CashMovement } from "./CashMovement";
import { ComplianceIncident } from "./ComplianceIncident";
import { CompliancePolicy } from "./CompliancePolicy";
import { Employee } from "./Employee";
import { ExportBatch } from "./ExportBatch";
import { ExportDestination } from "./ExportDestination";
import { ExportLine } from "./ExportLine";
import { FuelDelivery } from "./FuelDelivery";
import { FuelGrade } from "./FuelGrade";
import { FuelNozzle } from "./FuelNozzle";
import { FuelPrice } from "./FuelPrice";
import { FuelPump } from "./FuelPump";
import { FuelReconciliation } from "./FuelReconciliation";
import { FuelSite } from "./FuelSite";
import { FuelTank } from "./FuelTank";
import { FuelTankReading } from "./FuelTankReading";
import { FuelTransaction } from "./FuelTransaction";
import { IdempotencyKey } from "./IdempotencyKey";
import { InventoryCount } from "./InventoryCount";
import { InventoryCountLine } from "./InventoryCountLine";
import { InventoryLedgerEntry } from "./InventoryLedgerEntry";
import { InventoryLocation } from "./InventoryLocation";
import { InventoryLot } from "./InventoryLot";
import { InventoryTransfer } from "./InventoryTransfer";
import { InventoryTransferLine } from "./InventoryTransferLine";
import { InventoryTransferLotAllocation } from "./InventoryTransferLotAllocation";
import { LotteryGame } from "./LotteryGame";
import { LotteryPack } from "./LotteryPack";
import { LotteryPackEvent } from "./LotteryPackEvent";
import { LotterySettlement } from "./LotterySettlement";
import { LoyaltyAccount } from "./LoyaltyAccount";
import { LoyaltyLedgerEntry } from "./LoyaltyLedgerEntry";
import { LoyaltyProgram } from "./LoyaltyProgram";
import { MoneyServiceProvider } from "./MoneyServiceProvider";
import { MoneyServiceSettlement } from "./MoneyServiceSettlement";
import { MoneyServiceTransaction } from "./MoneyServiceTransaction";
import { OfflineDevice } from "./OfflineDevice";
import { OfflineOperation } from "./OfflineOperation";
import { OfflineOperationBatch } from "./OfflineOperationBatch";
import { OperationalAlert } from "./OperationalAlert";
import { OperationalHeartbeat } from "./OperationalHeartbeat";
import { OutboxAttempt } from "./OutboxAttempt";
import { OutboxEvent } from "./OutboxEvent";
import { PaymentProvider } from "./PaymentProvider";
import { PaymentReconciliation } from "./PaymentReconciliation";
import { PaymentReconciliationLine } from "./PaymentReconciliationLine";
import { PrepBatch } from "./PrepBatch";
import { PriceBook } from "./PriceBook";
import { PriceBookEntry } from "./PriceBookEntry";
import { Product } from "./Product";
import { ProductBarcode } from "./ProductBarcode";
import { ProductImage } from "./ProductImage";
import { ProductCategory } from "./ProductCategory";
import { ProductVariant } from "./ProductVariant";
import { Promotion } from "./Promotion";
import { PromotionRedemption } from "./PromotionRedemption";
import { PromotionRule } from "./PromotionRule";
import { PurchaseOrder } from "./PurchaseOrder";
import { PurchaseOrderLine } from "./PurchaseOrderLine";
import { Receiving } from "./Receiving";
import { ReceivingLine } from "./ReceivingLine";
import { Recipe } from "./Recipe";
import { RecipeIngredient } from "./RecipeIngredient";
import { Refund } from "./Refund";
import { RefundLine } from "./RefundLine";
import { RefundTenderAllocation } from "./RefundTenderAllocation";
import { Register } from "./Register";
import { RegisterSession } from "./RegisterSession";
import { Return } from "./Return";
import { ReturnLine } from "./ReturnLine";
import { Role } from "./Role";
import { Sale } from "./Sale";
import { SaleLine } from "./SaleLine";
import { Shift } from "./Shift";
import { StockLevel } from "./StockLevel";
import { Store } from "./Store";
import { StoreDay } from "./StoreDay";
import { StoreDayLine } from "./StoreDayLine";
import { TaxCategory } from "./TaxCategory";
import { TaxRate } from "./TaxRate";
import { Tender } from "./Tender";
import { User } from "./User";
import { Vendor } from "./Vendor";
import { VendorItem } from "./VendorItem";
import { WasteEvent } from "./WasteEvent";
import { WebhookEvent } from "./WebhookEvent";

export const models = {
  Business,
  Role,
  User,
  Employee,
  Store,

  Register,
  Shift,
  RegisterSession,
  CashMovement,
  StoreDay,
  StoreDayLine,
  BankDeposit,

  ProductCategory,
  Product,
  ProductVariant,
  ProductBarcode,
  ProductImage,
  TaxCategory,
  TaxRate,
  PriceBook,
  PriceBookEntry,
  Promotion,
  PromotionRule,
  PromotionRedemption,
  LoyaltyProgram,
  LoyaltyAccount,
  LoyaltyLedgerEntry,
  LotteryGame,
  LotteryPack,
  LotteryPackEvent,
  LotterySettlement,
  MoneyServiceProvider,
  MoneyServiceTransaction,
  MoneyServiceSettlement,

  InventoryLocation,
  StockLevel,
  InventoryLot,
  InventoryLedgerEntry,
  InventoryCount,
  InventoryCountLine,
  InventoryTransfer,
  InventoryTransferLine,
  InventoryTransferLotAllocation,
  Vendor,
  VendorItem,
  PurchaseOrder,
  PurchaseOrderLine,
  Receiving,
  ReceivingLine,

  Cart,
  CartLine,
  Sale,
  SaleLine,
  PaymentProvider,
  PaymentReconciliation,
  PaymentReconciliationLine,
  Tender,
  Refund,
  RefundLine,
  RefundTenderAllocation,
  Return,
  ReturnLine,

  CompliancePolicy,
  AgeVerification,
  ComplianceIncident,

  Recipe,
  RecipeIngredient,
  PrepBatch,
  WasteEvent,

  FuelSite,
  FuelGrade,
  FuelTank,
  FuelPump,
  FuelNozzle,
  FuelPrice,
  FuelTransaction,
  FuelDelivery,
  FuelTankReading,
  FuelReconciliation,

  OfflineDevice,
  OfflineOperationBatch,
  OfflineOperation,
  OperationalAlert,
  OperationalHeartbeat,
  AlertEvaluation,
  ExportDestination,
  ExportBatch,
  ExportLine,
  OutboxEvent,
  OutboxAttempt,

  ApiKey,
  AuthenticationThrottle,
  IdempotencyKey,
  AuditEvent,
  WebhookEvent,
};

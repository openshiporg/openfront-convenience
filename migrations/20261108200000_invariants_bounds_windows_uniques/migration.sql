-- Invariants (round 2): every bound the Keystone fields and command guards already promise is now held
-- by the database too, so a writer that bypasses a guard (sudo, prisma, a future command) cannot store
-- negative money, a negative quantity, an inverted window or a second live record. NOT VALID: enforced on
-- every new write; existing rows were verified clean in production before this migration.

ALTER TABLE "AgeVerification" ADD CONSTRAINT "AgeVerification_bounds_check" CHECK ("ageAtVerification" >= 0) NOT VALID;
ALTER TABLE "AlertEvaluation" ADD CONSTRAINT "AlertEvaluation_bounds_check" CHECK ("createdCount" >= 0 AND "existingCount" >= 0) NOT VALID;
ALTER TABLE "AuthenticationThrottle" ADD CONSTRAINT "AuthenticationThrottle_bounds_check" CHECK ("count" >= 0) NOT VALID;
ALTER TABLE "BankDeposit" ADD CONSTRAINT "BankDeposit_bounds_check" CHECK ("expectedAmountCents" >= 0 AND "amountCents" >= 0) NOT VALID;
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_bounds_check" CHECK ("subtotalCents" >= 0 AND "discountCents" >= 0 AND "taxCents" >= 0 AND "totalCents" >= 0 AND "loyaltyPointsToRedeem" >= 0 AND "loyaltyRedemptionCents" >= 0) NOT VALID;
ALTER TABLE "CartLine" ADD CONSTRAINT "CartLine_bounds_check" CHECK ("quantity" >= 0.0001 AND "unitPriceCents" >= 0 AND "subtotalCents" >= 0 AND "discountCents" >= 0 AND "taxCents" >= 0 AND "totalCents" >= 0 AND "minimumAge" >= 0) NOT VALID;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_bounds_check" CHECK ("amountCents" >= 0) NOT VALID;
ALTER TABLE "CompliancePolicy" ADD CONSTRAINT "CompliancePolicy_bounds_check" CHECK ("minimumAge" >= 0 AND "idCheckThresholdAge" >= 0) NOT VALID;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_bounds_check" CHECK ("hourlyRateCents" >= 0) NOT VALID;
ALTER TABLE "ExportBatch" ADD CONSTRAINT "ExportBatch_bounds_check" CHECK ("rowCount" >= 0 AND "debitTotalCents" >= 0 AND "creditTotalCents" >= 0 AND "artifactSizeBytes" >= 0) NOT VALID;
ALTER TABLE "ExportLine" ADD CONSTRAINT "ExportLine_bounds_check" CHECK ("lineNumber" >= 1 AND "debitCents" >= 0 AND "creditCents" >= 0) NOT VALID;
ALTER TABLE "FuelDelivery" ADD CONSTRAINT "FuelDelivery_bounds_check" CHECK ("grossVolumeGallons" >= 0.0000 AND "netVolumeGallons" >= 0.0000 AND "beforeVolumeGallons" >= 0.0000 AND "afterVolumeGallons" >= 0.0000 AND "unitCostMillsPerGallon" >= 0 AND "totalCostCents" >= 0) NOT VALID;
ALTER TABLE "FuelGrade" ADD CONSTRAINT "FuelGrade_bounds_check" CHECK ("octaneRating" >= 0) NOT VALID;
ALTER TABLE "FuelReconciliation" ADD CONSTRAINT "FuelReconciliation_bounds_check" CHECK ("openingGallons" >= 0.0000 AND "deliveredGallons" >= 0.0000 AND "dispensedGallons" >= 0.0000 AND "expectedClosingGallons" >= 0.0000 AND "measuredClosingGallons" >= 0.0000 AND "toleranceGallons" >= 0.0000) NOT VALID;
ALTER TABLE "FuelTank" ADD CONSTRAINT "FuelTank_bounds_check" CHECK ("capacityGallons" >= 0.0001 AND "currentVolumeGallons" >= 0.0000 AND "waterVolumeGallons" >= 0.0000 AND "ullageGallons" >= 0.0000) NOT VALID;
ALTER TABLE "FuelTankReading" ADD CONSTRAINT "FuelTankReading_bounds_check" CHECK ("volumeGallons" >= 0.0000 AND "waterVolumeGallons" >= 0.0000 AND "ullageGallons" >= 0.0000) NOT VALID;
ALTER TABLE "FuelTransaction" ADD CONSTRAINT "FuelTransaction_bounds_check" CHECK ("volumeGallons" >= 0.0000 AND "totalCents" >= 0 AND "authorizedCents" >= 0) NOT VALID;
ALTER TABLE "InventoryCountLine" ADD CONSTRAINT "InventoryCountLine_bounds_check" CHECK ("actualQuantity" >= 0.0000 AND "unitCostCents" >= 0) NOT VALID;
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_bounds_check" CHECK ("unitCostCents" >= 0) NOT VALID;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_bounds_check" CHECK ("quantityReceived" >= 0.0000 AND "quantityRemaining" >= 0.0000 AND "unitCostCents" >= 0) NOT VALID;
ALTER TABLE "InventoryTransferLine" ADD CONSTRAINT "InventoryTransferLine_bounds_check" CHECK ("lineNumber" >= 1 AND "quantityRequested" >= 0.0001 AND "quantityShipped" >= 0.0000 AND "quantityReceived" >= 0.0000) NOT VALID;
ALTER TABLE "InventoryTransferLotAllocation" ADD CONSTRAINT "InventoryTransferLotAllocation_bounds_check" CHECK ("quantity" >= 0.0001 AND "unitCostCents" >= 0) NOT VALID;
ALTER TABLE "LotteryGame" ADD CONSTRAINT "LotteryGame_bounds_check" CHECK ("ticketPriceCents" >= 0 AND "ticketsPerPack" >= 1) NOT VALID;
ALTER TABLE "LotteryPack" ADD CONSTRAINT "LotteryPack_bounds_check" CHECK ("firstTicketNumber" >= 0 AND "lastTicketNumber" >= 0 AND "currentTicketNumber" >= 0 AND "ticketsReceived" >= 1 AND "ticketsSold" >= 0 AND "ticketsVoided" >= 0 AND "expectedSalesCents" >= 0 AND "actualSalesCents" >= 0) NOT VALID;
ALTER TABLE "LotteryPackEvent" ADD CONSTRAINT "LotteryPackEvent_bounds_check" CHECK ("firstTicketNumber" >= 0 AND "lastTicketNumber" >= 0 AND "quantity" >= 0) NOT VALID;
ALTER TABLE "LotterySettlement" ADD CONSTRAINT "LotterySettlement_bounds_check" CHECK ("instantSalesCents" >= 0 AND "onlineSalesCents" >= 0 AND "payoutCents" >= 0 AND "commissionCents" >= 0 AND "packCount" >= 0) NOT VALID;
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_bounds_check" CHECK ("pointsPerDollar" >= 0 AND "redemptionPoints" >= 1 AND "redemptionValueCents" >= 0 AND "pointsExpireAfterDays" >= 1) NOT VALID;
ALTER TABLE "MoneyServiceSettlement" ADD CONSTRAINT "MoneyServiceSettlement_bounds_check" CHECK ("faceAmountCents" >= 0 AND "feeCents" >= 0 AND "cashInCents" >= 0 AND "cashOutCents" >= 0 AND "transactionCount" >= 0) NOT VALID;
ALTER TABLE "MoneyServiceTransaction" ADD CONSTRAINT "MoneyServiceTransaction_bounds_check" CHECK ("faceAmountCents" >= 0 AND "feeCents" >= 0 AND "cashAmountCents" >= 0) NOT VALID;
ALTER TABLE "OfflineDevice" ADD CONSTRAINT "OfflineDevice_bounds_check" CHECK ("lastSequence" >= 0) NOT VALID;
ALTER TABLE "OfflineOperation" ADD CONSTRAINT "OfflineOperation_bounds_check" CHECK ("sequence" >= 1) NOT VALID;
ALTER TABLE "OfflineOperationBatch" ADD CONSTRAINT "OfflineOperationBatch_bounds_check" CHECK ("firstSequence" >= 1 AND "lastSequence" >= 1 AND "operationCount" >= 0 AND "appliedCount" >= 0 AND "replayedCount" >= 0 AND "conflictCount" >= 0 AND "rejectedCount" >= 0) NOT VALID;
ALTER TABLE "OutboxAttempt" ADD CONSTRAINT "OutboxAttempt_bounds_check" CHECK ("attemptNumber" >= 1) NOT VALID;
ALTER TABLE "OutboxEvent" ADD CONSTRAINT "OutboxEvent_bounds_check" CHECK ("schemaVersion" >= 1 AND "attempts" >= 0 AND "totalAttempts" >= 0 AND "replayCount" >= 0 AND "maxAttempts" >= 1) NOT VALID;
ALTER TABLE "PaymentReconciliation" ADD CONSTRAINT "PaymentReconciliation_bounds_check" CHECK ("capturedCents" >= 0 AND "refundedCents" >= 0 AND "reportedFeeCents" >= 0 AND "tenderCount" >= 0 AND "exceptionCount" >= 0) NOT VALID;
ALTER TABLE "PaymentReconciliationLine" ADD CONSTRAINT "PaymentReconciliationLine_bounds_check" CHECK ("capturedCents" >= 0 AND "refundedCents" >= 0 AND "reportedFeeCents" >= 0) NOT VALID;
ALTER TABLE "PrepBatch" ADD CONSTRAINT "PrepBatch_bounds_check" CHECK ("quantityPlanned" >= 0.0000 AND "actualCostCents" >= 0) NOT VALID;
ALTER TABLE "PriceBookEntry" ADD CONSTRAINT "PriceBookEntry_bounds_check" CHECK ("amountCents" >= 0 AND "minQuantity" >= 0.0001 AND "maxQuantity" >= 0.0001) NOT VALID;
ALTER TABLE "Product" ADD CONSTRAINT "Product_bounds_check" CHECK ("minimumAge" >= 0) NOT VALID;
ALTER TABLE "ProductVariant" ADD CONSTRAINT "ProductVariant_bounds_check" CHECK ("defaultPriceCents" >= 0) NOT VALID;
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_bounds_check" CHECK ("usageLimit" >= 1 AND "perCustomerLimit" >= 1) NOT VALID;
ALTER TABLE "PromotionRedemption" ADD CONSTRAINT "PromotionRedemption_bounds_check" CHECK ("amountCents" >= 0) NOT VALID;
ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_bounds_check" CHECK ("valueBasisPoints" >= 0 AND "valueCents" >= 0 AND "minQuantity" >= 0.0001 AND "buyQuantity" >= 0.0001 AND "getQuantity" >= 0.0001 AND "minSubtotalCents" >= 0 AND "maxDiscountCents" >= 0) NOT VALID;
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_bounds_check" CHECK ("subtotalCents" >= 0 AND "taxCents" >= 0 AND "shippingCents" >= 0 AND "totalCents" >= 0) NOT VALID;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_bounds_check" CHECK ("quantityOrdered" >= 0.0001 AND "quantityCancelled" >= 0.0000 AND "unitCostCents" >= 0 AND "lineTotalCents" >= 0) NOT VALID;
ALTER TABLE "ReceivingLine" ADD CONSTRAINT "ReceivingLine_bounds_check" CHECK ("quantityExpected" >= 0.0000 AND "quantityAccepted" >= 0.0000 AND "quantityRejected" >= 0.0000 AND "unitCostCents" >= 0) NOT VALID;
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_bounds_check" CHECK ("yieldQuantity" >= 0.0001) NOT VALID;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_bounds_check" CHECK ("quantity" >= 0.0001 AND "wasteBasisPoints" >= 0) NOT VALID;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_bounds_check" CHECK ("amountCents" >= 0) NOT VALID;
ALTER TABLE "RefundLine" ADD CONSTRAINT "RefundLine_bounds_check" CHECK ("quantity" >= 0.0001 AND "subtotalCents" >= 0 AND "taxCents" >= 0 AND "totalCents" >= 0) NOT VALID;
ALTER TABLE "RefundTenderAllocation" ADD CONSTRAINT "RefundTenderAllocation_bounds_check" CHECK ("amountCents" >= 0) NOT VALID;
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_bounds_check" CHECK ("openingCashCents" >= 0 AND "expectedCashCents" >= 0 AND "countedCashCents" >= 0) NOT VALID;
ALTER TABLE "ReturnLine" ADD CONSTRAINT "ReturnLine_bounds_check" CHECK ("quantity" >= 0.0001) NOT VALID;
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_bounds_check" CHECK ("subtotalCents" >= 0 AND "discountCents" >= 0 AND "taxCents" >= 0 AND "totalCents" >= 0 AND "refundedCents" >= 0) NOT VALID;
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_bounds_check" CHECK ("lineNumber" >= 1 AND "quantity" >= 0.0001 AND "unitPriceCents" >= 0 AND "subtotalCents" >= 0 AND "discountCents" >= 0 AND "taxCents" >= 0 AND "totalCents" >= 0 AND "minimumAge" >= 0) NOT VALID;
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_bounds_check" CHECK ("breakMinutes" >= 0 AND "hourlyRateCents" >= 0) NOT VALID;
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_bounds_check" CHECK ("parQuantity" >= 0.0000 AND "reorderPoint" >= 0.0000 AND "reorderQuantity" >= 0.0000) NOT VALID;
ALTER TABLE "StoreDay" ADD CONSTRAINT "StoreDay_bounds_check" CHECK ("grossSalesCents" >= 0 AND "discountCents" >= 0 AND "totalSalesCents" >= 0 AND "refundCents" >= 0 AND "fuelSalesCents" >= 0 AND "openingCashCents" >= 0 AND "expectedCashCents" >= 0 AND "countedCashCents" >= 0 AND "depositedCashCents" >= 0 AND "saleCount" >= 0 AND "refundCount" >= 0 AND "registerSessionCount" >= 0 AND "exceptionCount" >= 0) NOT VALID;
ALTER TABLE "StoreDayLine" ADD CONSTRAINT "StoreDayLine_bounds_check" CHECK ("lineNumber" >= 1 AND "sourceCount" >= 0) NOT VALID;
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_bounds_check" CHECK ("amountCents" >= 0 AND "tenderedCents" >= 0 AND "changeCents" >= 0 AND "refundedCents" >= 0) NOT VALID;
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_bounds_check" CHECK ("leadTimeDays" >= 0 AND "minimumOrderCents" >= 0) NOT VALID;
ALTER TABLE "VendorItem" ADD CONSTRAINT "VendorItem_bounds_check" CHECK ("casePackQuantity" >= 0.0001 AND "unitsPerCase" >= 1 AND "unitCostCents" >= 0 AND "leadTimeDays" >= 0) NOT VALID;
ALTER TABLE "WasteEvent" ADD CONSTRAINT "WasteEvent_bounds_check" CHECK ("quantity" >= 0.0001 AND "costCents" >= 0) NOT VALID;
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_bounds_check" CHECK ("attemptCount" >= 0) NOT VALID;

-- Cross-column bounds
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_refund_within_total_check" CHECK ("refundedCents" <= "totalCents") NOT VALID;
ALTER TABLE "Tender" ADD CONSTRAINT "Tender_refund_within_amount_check" CHECK ("refundedCents" <= "amountCents") NOT VALID;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_amount_positive_check" CHECK ("amountCents" > 0) NOT VALID;
ALTER TABLE "RefundTenderAllocation" ADD CONSTRAINT "RefundTenderAllocation_amount_positive_check" CHECK ("amountCents" > 0) NOT VALID;
ALTER TABLE "StockLevel" ADD CONSTRAINT "StockLevel_reserved_nonnegative_check" CHECK ("reservedQuantity" >= 0) NOT VALID;
ALTER TABLE "InventoryLot" ADD CONSTRAINT "InventoryLot_remaining_within_received_check" CHECK ("quantityRemaining" <= "quantityReceived") NOT VALID;
ALTER TABLE "RegisterSession" ADD CONSTRAINT "RegisterSession_closed_after_opened_check" CHECK ("closedAt" IS NULL OR "closedAt" >= "openedAt") NOT VALID;
ALTER TABLE "LotteryPack" ADD CONSTRAINT "LotteryPack_ticket_range_check" CHECK ("lastTicketNumber" >= "firstTicketNumber" AND "currentTicketNumber" >= "firstTicketNumber" AND "currentTicketNumber" <= "lastTicketNumber" + 1 AND "ticketsSold" + "ticketsVoided" <= "ticketsReceived") NOT VALID;
ALTER TABLE "LotteryPackEvent" ADD CONSTRAINT "LotteryPackEvent_ticket_range_check" CHECK ("lastTicketNumber" >= "firstTicketNumber") NOT VALID;
ALTER TABLE "FuelTank" ADD CONSTRAINT "FuelTank_within_capacity_check" CHECK ("currentVolumeGallons" <= "capacityGallons") NOT VALID;
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_received_within_ordered_check" CHECK ("quantityReceived" >= 0 AND "quantityReceived" + "quantityCancelled" <= "quantityOrdered") NOT VALID;
ALTER TABLE "InventoryTransferLine" ADD CONSTRAINT "InventoryTransferLine_flow_check" CHECK ("quantityShipped" <= "quantityRequested" AND "quantityReceived" <= "quantityShipped") NOT VALID;
ALTER TABLE "PriceBookEntry" ADD CONSTRAINT "PriceBookEntry_quantity_band_check" CHECK ("maxQuantity" IS NULL OR "maxQuantity" >= "minQuantity") NOT VALID;
ALTER TABLE "CompliancePolicy" ADD CONSTRAINT "CompliancePolicy_threshold_check" CHECK ("idCheckThresholdAge" IS NULL OR "idCheckThresholdAge" >= "minimumAge") NOT VALID;
-- A percentage benefit is at most 100% off; the discount engine clamps to the subtotal, so more just gives goods away.
ALTER TABLE "PromotionRule" ADD CONSTRAINT "PromotionRule_percentage_check" CHECK ("valueBasisPoints" IS NULL OR "valueBasisPoints" <= 10000) NOT VALID;
ALTER TABLE "RecipeIngredient" ADD CONSTRAINT "RecipeIngredient_waste_check" CHECK ("wasteBasisPoints" <= 10000) NOT VALID;

-- Time windows: end strictly after start
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_window_check" CHECK ("endsAt" > "startsAt" AND ("clockedOutAt" IS NULL OR "clockedInAt" IS NULL OR "clockedOutAt" >= "clockedInAt")) NOT VALID;
ALTER TABLE "Promotion" ADD CONSTRAINT "Promotion_window_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt") NOT VALID;
ALTER TABLE "PriceBook" ADD CONSTRAINT "PriceBook_window_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt") NOT VALID;
ALTER TABLE "PriceBookEntry" ADD CONSTRAINT "PriceBookEntry_window_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt") NOT VALID;
ALTER TABLE "CompliancePolicy" ADD CONSTRAINT "CompliancePolicy_window_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt") NOT VALID;
ALTER TABLE "FuelPrice" ADD CONSTRAINT "FuelPrice_window_check" CHECK ("endsAt" IS NULL OR "endsAt" > "startsAt") NOT VALID;

-- One live record where the commands check first (findFirst then create): the database settles the race.
CREATE UNIQUE INDEX "RegisterSession_one_live_per_register_key" ON "RegisterSession" ("register") WHERE "status" IN ('open', 'closing', 'suspended');
CREATE UNIQUE INDEX "Shift_one_live_per_employee_key" ON "Shift" ("employee") WHERE "status" IN ('clocked_in', 'on_break');
CREATE UNIQUE INDEX "FuelTransaction_one_live_per_nozzle_key" ON "FuelTransaction" ("nozzle") WHERE "status" IN ('requested', 'authorized', 'dispensing');
CREATE UNIQUE INDEX "ProductBarcode_one_primary_per_variant_key" ON "ProductBarcode" ("variant") WHERE "isPrimary" AND "status" = 'active';

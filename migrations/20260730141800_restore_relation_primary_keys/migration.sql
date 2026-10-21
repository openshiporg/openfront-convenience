BEGIN;

-- AlterTable
ALTER TABLE "_ApiKey_stores" ADD CONSTRAINT "_ApiKey_stores_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ApiKey_stores_AB_unique";

-- AlterTable
ALTER TABLE "_CartLine_promotions" ADD CONSTRAINT "_CartLine_promotions_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_CartLine_promotions_AB_unique";

-- AlterTable
ALTER TABLE "_Cart_promotions" ADD CONSTRAINT "_Cart_promotions_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_Cart_promotions_AB_unique";

-- AlterTable
ALTER TABLE "_CompliancePolicy_categories" ADD CONSTRAINT "_CompliancePolicy_categories_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_CompliancePolicy_categories_AB_unique";

-- AlterTable
ALTER TABLE "_CompliancePolicy_products" ADD CONSTRAINT "_CompliancePolicy_products_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_CompliancePolicy_products_AB_unique";

-- AlterTable
ALTER TABLE "_CompliancePolicy_stores" ADD CONSTRAINT "_CompliancePolicy_stores_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_CompliancePolicy_stores_AB_unique";

-- AlterTable
ALTER TABLE "_Employee_stores" ADD CONSTRAINT "_Employee_stores_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_Employee_stores_AB_unique";

-- AlterTable
ALTER TABLE "_ExportDestination_stores" ADD CONSTRAINT "_ExportDestination_stores_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ExportDestination_stores_AB_unique";

-- AlterTable
ALTER TABLE "_MoneyServiceProvider_stores" ADD CONSTRAINT "_MoneyServiceProvider_stores_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_MoneyServiceProvider_stores_AB_unique";

-- AlterTable
ALTER TABLE "_PriceBook_stores" ADD CONSTRAINT "_PriceBook_stores_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_PriceBook_stores_AB_unique";

-- AlterTable
ALTER TABLE "_Product_categories" ADD CONSTRAINT "_Product_categories_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_Product_categories_AB_unique";

-- AlterTable
ALTER TABLE "_PromotionRule_categories" ADD CONSTRAINT "_PromotionRule_categories_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_PromotionRule_categories_AB_unique";

-- AlterTable
ALTER TABLE "_PromotionRule_products" ADD CONSTRAINT "_PromotionRule_products_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_PromotionRule_products_AB_unique";

-- AlterTable
ALTER TABLE "_Promotion_stores" ADD CONSTRAINT "_Promotion_stores_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_Promotion_stores_AB_unique";

COMMIT;

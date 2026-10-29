BEGIN;

-- Shared six-function payment adapter selector (optional; terminal providers leave it empty)
-- and online pickup status on Sale. Join-table key drift on _Product_images is pre-existing and not part of this.
CREATE TYPE "SalePickupStatusType" AS ENUM ('none', 'ready_for_pickup', 'picked_up');

ALTER TABLE "PaymentProvider" ADD COLUMN     "generatePaymentLinkFunction" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Sale" ADD COLUMN     "pickupStatus" "SalePickupStatusType" NOT NULL DEFAULT 'none';

COMMIT;

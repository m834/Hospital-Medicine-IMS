-- AlterTable
ALTER TABLE "stock_batches" ADD COLUMN     "cost_per_dispensing_unit" DECIMAL(10,4),
ADD COLUMN     "dispensing_unit" TEXT,
ADD COLUMN     "purchase_unit" TEXT,
ADD COLUMN     "purchase_unit_price" DECIMAL(10,2),
ADD COLUMN     "qty_available_dispensing" INTEGER,
ADD COLUMN     "qty_received_purchase" INTEGER,
ADD COLUMN     "reorder_level" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "sub_unit" TEXT,
ADD COLUMN     "units_per_purchase_unit" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "units_per_sub_unit" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "stock_batches_pharmacy_id_status_qty_available_dispensing_idx" ON "stock_batches"("pharmacy_id", "status", "qty_available_dispensing");

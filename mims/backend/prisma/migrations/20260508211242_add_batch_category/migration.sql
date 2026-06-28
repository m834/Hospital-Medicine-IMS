-- CreateEnum
CREATE TYPE "BatchCategory" AS ENUM ('NORMAL', 'LP');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MedicineForm" ADD VALUE 'LIQUID';
ALTER TYPE "MedicineForm" ADD VALUE 'SUPPOSITORY';

-- AlterTable
ALTER TABLE "stock_batches" ADD COLUMN     "category" "BatchCategory" NOT NULL DEFAULT 'NORMAL';

-- CreateIndex
CREATE INDEX "stock_batches_hospital_id_category_idx" ON "stock_batches"("hospital_id", "category");

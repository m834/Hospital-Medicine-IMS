-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PrescriptionStatus" ADD VALUE 'ACTIVE';
ALTER TYPE "PrescriptionStatus" ADD VALUE 'COMPLETED';

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "visit_id" TEXT;

-- CreateTable
CREATE TABLE "prescription_medicines" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "dosage" TEXT,
    "instructions" TEXT,
    "category" "BatchCategory" NOT NULL DEFAULT 'NORMAL',
    "added_by" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prescription_medicines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_dispatches" (
    "id" TEXT NOT NULL,
    "prescription_id" TEXT NOT NULL,
    "visit_id" TEXT,
    "dispatched_by" TEXT NOT NULL,
    "dispatched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "prescription_dispatches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_dispatch_items" (
    "id" TEXT NOT NULL,
    "dispatch_id" TEXT NOT NULL,
    "prescription_medicine_id" TEXT NOT NULL,
    "quantity_dispatched" INTEGER NOT NULL,

    CONSTRAINT "prescription_dispatch_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "prescription_medicines_prescription_id_idx" ON "prescription_medicines"("prescription_id");

-- CreateIndex
CREATE INDEX "prescription_dispatches_prescription_id_idx" ON "prescription_dispatches"("prescription_id");

-- CreateIndex
CREATE INDEX "prescription_dispatch_items_dispatch_id_idx" ON "prescription_dispatch_items"("dispatch_id");

-- CreateIndex
CREATE INDEX "prescriptions_visit_id_idx" ON "prescriptions"("visit_id");

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_medicines" ADD CONSTRAINT "prescription_medicines_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_medicines" ADD CONSTRAINT "prescription_medicines_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_medicines" ADD CONSTRAINT "prescription_medicines_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_dispatches" ADD CONSTRAINT "prescription_dispatches_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_dispatches" ADD CONSTRAINT "prescription_dispatches_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_dispatches" ADD CONSTRAINT "prescription_dispatches_dispatched_by_fkey" FOREIGN KEY ("dispatched_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_dispatch_items" ADD CONSTRAINT "prescription_dispatch_items_dispatch_id_fkey" FOREIGN KEY ("dispatch_id") REFERENCES "prescription_dispatches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_dispatch_items" ADD CONSTRAINT "prescription_dispatch_items_prescription_medicine_id_fkey" FOREIGN KEY ("prescription_medicine_id") REFERENCES "prescription_medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

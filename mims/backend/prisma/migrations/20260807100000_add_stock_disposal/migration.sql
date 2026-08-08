-- Stock write-offs (expired, damaged, recalled and so on).
--
-- Modelled as a transaction + items pair referencing the batch, matching how
-- every other stock movement in this schema is recorded (issue, return,
-- transfer). Kept distinct from dispensing so reports can tell a disposal
-- apart from medicine given to a patient.
--
-- Append-only by design: there is no update or delete path. A mistake is
-- corrected with a further adjustment so the audit trail stays intact.

CREATE TYPE "DisposalReason" AS ENUM ('EXPIRED', 'DAMAGED', 'BROKEN', 'CONTAMINATED', 'RECALLED', 'OTHER');

CREATE TABLE "disposal_transactions" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "disposed_by" TEXT NOT NULL,
    "notes" TEXT,
    "disposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "disposal_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "disposal_items" (
    "id" TEXT NOT NULL,
    "disposal_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "qty_disposed" INTEGER NOT NULL,
    "reason" "DisposalReason" NOT NULL,
    "note" TEXT,
    CONSTRAINT "disposal_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "disposal_transactions_hospital_id_idx" ON "disposal_transactions"("hospital_id");
CREATE INDEX "disposal_transactions_pharmacy_id_idx" ON "disposal_transactions"("pharmacy_id");
CREATE INDEX "disposal_transactions_disposed_at_idx" ON "disposal_transactions"("disposed_at");
CREATE INDEX "disposal_items_disposal_id_idx" ON "disposal_items"("disposal_id");
CREATE INDEX "disposal_items_batch_id_idx" ON "disposal_items"("batch_id");

ALTER TABLE "disposal_transactions" ADD CONSTRAINT "disposal_transactions_hospital_id_fkey"
  FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disposal_transactions" ADD CONSTRAINT "disposal_transactions_pharmacy_id_fkey"
  FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disposal_transactions" ADD CONSTRAINT "disposal_transactions_disposed_by_fkey"
  FOREIGN KEY ("disposed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "disposal_items" ADD CONSTRAINT "disposal_items_disposal_id_fkey"
  FOREIGN KEY ("disposal_id") REFERENCES "disposal_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disposal_items" ADD CONSTRAINT "disposal_items_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "stock_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disposal_items" ADD CONSTRAINT "disposal_items_medicine_id_fkey"
  FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Add pharmacy + creator attribution to prescriptions
ALTER TABLE "prescriptions" ADD COLUMN "pharmacy_id" TEXT;
ALTER TABLE "prescriptions" ADD COLUMN "created_by" TEXT;

CREATE INDEX "prescriptions_pharmacy_id_idx" ON "prescriptions"("pharmacy_id");

ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_pharmacy_id_fkey"
  FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A room (ward) is looked after by one sub-pharmacy, which enters and
-- dispenses ward prescriptions for the patients in it.
--
-- Additive and safe on a live database: the column is nullable, so existing
-- rooms simply have no pharmacy until one is assigned.

ALTER TABLE "rooms" ADD COLUMN "pharmacy_id" TEXT;

ALTER TABLE "rooms"
  ADD CONSTRAINT "rooms_pharmacy_id_fkey"
  FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "rooms_pharmacy_id_idx" ON "rooms"("pharmacy_id");

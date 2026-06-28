-- Add per-dose quantity to prescription_medicines
ALTER TABLE "prescription_medicines" ADD COLUMN "quantity" INTEGER;

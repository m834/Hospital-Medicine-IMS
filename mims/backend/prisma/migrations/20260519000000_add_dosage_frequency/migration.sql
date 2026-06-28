-- CreateEnum
CREATE TYPE "DosageFrequency" AS ENUM ('OD', 'BID', 'TDS', 'SOS');

-- AlterTable
ALTER TABLE "prescription_medicines" ADD COLUMN "dosage_frequency" "DosageFrequency";

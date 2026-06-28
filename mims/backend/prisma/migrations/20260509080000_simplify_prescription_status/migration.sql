-- Migrate existing records to the two remaining statuses
UPDATE "prescriptions" SET "status" = 'ACTIVE'    WHERE "status" IN ('PENDING', 'ISSUED', 'PARTIALLY_ISSUED');
UPDATE "prescriptions" SET "status" = 'COMPLETED' WHERE "status" = 'CANCELLED';

-- Drop the column default before changing the enum type
ALTER TABLE "prescriptions" ALTER COLUMN "status" DROP DEFAULT;

-- Recreate the PrescriptionStatus enum with only ACTIVE and COMPLETED
ALTER TYPE "PrescriptionStatus" RENAME TO "PrescriptionStatus_old";
CREATE TYPE "PrescriptionStatus" AS ENUM ('ACTIVE', 'COMPLETED');

ALTER TABLE "prescriptions"
  ALTER COLUMN "status" TYPE "PrescriptionStatus"
  USING "status"::text::"PrescriptionStatus";

-- Restore the default using the new enum type
ALTER TABLE "prescriptions"
  ALTER COLUMN "status" SET DEFAULT 'ACTIVE'::"PrescriptionStatus";

DROP TYPE "PrescriptionStatus_old";

-- CreateEnum
CREATE TYPE "GuardianType" AS ENUM ('WIFE', 'CHILD');

-- AlterTable
ALTER TABLE "patients" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "guardian_type" "GuardianType";

/*
  Warnings:

  - You are about to drop the column `notes_encrypted` on the `attendance_records` table. All the data in the column will be lost.
  - You are about to drop the column `is_encrypted` on the `biometric_enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `template_data_hash` on the `biometric_enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `reason_encrypted` on the `leaves` table. All the data in the column will be lost.
  - You are about to drop the column `remarks_encrypted` on the `leaves` table. All the data in the column will be lost.
  - You are about to drop the column `phone_encrypted` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_biometric_enrollments_encrypted";

-- AlterTable
ALTER TABLE "attendance_records" DROP COLUMN "notes_encrypted";

-- AlterTable
ALTER TABLE "biometric_enrollments" DROP COLUMN "is_encrypted",
DROP COLUMN "template_data_hash";

-- AlterTable
ALTER TABLE "leaves" DROP COLUMN "reason_encrypted",
DROP COLUMN "remarks_encrypted";

-- AlterTable
ALTER TABLE "payroll_settings" ADD COLUMN     "allowance_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "other_deduction_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "phone_encrypted";

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "monthly_salary" DECIMAL(12,2) NOT NULL,
    "allowance_amount" DECIMAL(12,2) NOT NULL,
    "other_deduction_amount" DECIMAL(12,2) NOT NULL,
    "total_present" INTEGER NOT NULL,
    "total_absent" INTEGER NOT NULL,
    "total_late" INTEGER NOT NULL,
    "total_half_day" INTEGER NOT NULL,
    "total_leave" INTEGER NOT NULL,
    "net_pay" DECIMAL(12,2) NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_records_hospital_id_year_month_idx" ON "payroll_records"("hospital_id", "year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_hospital_id_user_id_year_month_key" ON "payroll_records"("hospital_id", "user_id", "year", "month");

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

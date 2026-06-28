/*
  Warnings:

  - You are about to drop the column `notes_encrypted` on the `attendance_records` table. All the data in the column will be lost.
  - You are about to drop the column `is_encrypted` on the `biometric_enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `template_data_hash` on the `biometric_enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `reason_encrypted` on the `leaves` table. All the data in the column will be lost.
  - You are about to drop the column `remarks_encrypted` on the `leaves` table. All the data in the column will be lost.
  - You are about to drop the column `phone_encrypted` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "LatePenaltyType" AS ENUM ('NONE', 'HALF_DAY', 'ABSENT');

-- CreateEnum
CREATE TYPE "LeavePayType" AS ENUM ('PAID', 'UNPAID');

-- DropIndex
DROP INDEX IF EXISTS "idx_attendance_record_date_status";

-- DropIndex
DROP INDEX IF EXISTS "idx_attendance_record_device_sync";

-- DropIndex
DROP INDEX IF EXISTS "idx_attendance_record_employee_date";

-- DropIndex
DROP INDEX IF EXISTS "idx_biometric_enrollments_encrypted";

-- DropIndex
DROP INDEX IF EXISTS "idx_device_sync_history";

-- DropIndex
DROP INDEX IF EXISTS "idx_employee_shift_conflict";

-- DropIndex
DROP INDEX IF EXISTS "idx_employee_shift_employee_date";

-- DropIndex
DROP INDEX IF EXISTS "idx_employee_shift_roster";

-- DropIndex
DROP INDEX IF EXISTS "idx_leave_date_range";

-- DropIndex
DROP INDEX IF EXISTS "idx_leave_employee_status";

-- DropIndex
DROP INDEX IF EXISTS "threat_alerts_created_at_idx";

-- AlterTable
ALTER TABLE "attendance_records" DROP COLUMN IF EXISTS "notes_encrypted";

-- AlterTable
ALTER TABLE "biometric_enrollments" DROP COLUMN IF EXISTS "is_encrypted",
DROP COLUMN IF EXISTS "template_data_hash";

-- AlterTable
ALTER TABLE "leaves" DROP COLUMN IF EXISTS "reason_encrypted",
DROP COLUMN IF EXISTS "remarks_encrypted";

-- AlterTable
ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_encrypted";

-- CreateTable
CREATE TABLE "payroll_settings" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "monthly_salary" DECIMAL(12,2) NOT NULL,
    "late_penalty_type" "LatePenaltyType" NOT NULL,
    "leave_pay_type" "LeavePayType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "payroll_settings_user_id_key" ON "payroll_settings"("user_id");

-- CreateIndex
CREATE INDEX "payroll_settings_hospital_id_idx" ON "payroll_settings"("hospital_id");

-- CreateIndex
CREATE INDEX "threat_alerts_created_at_idx" ON "threat_alerts"("created_at");

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "threat_alerts_hospital_read_idx" RENAME TO "threat_alerts_hospital_id_read_idx";

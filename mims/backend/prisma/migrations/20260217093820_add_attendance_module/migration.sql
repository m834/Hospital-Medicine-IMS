-- CreateEnum
CREATE TYPE "BiometricType" AS ENUM ('FINGERPRINT', 'FACE', 'RFID', 'HYBRID');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'MAINTENANCE', 'OFFLINE', 'DISABLED');

-- CreateEnum
CREATE TYPE "DeviceOperationStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILURE', 'PARTIAL', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'ENTRY', 'EXIT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VerificationMethod" AS ENUM ('FINGERPRINT', 'FACE', 'RFID', 'MANUAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EnrollmentType" AS ENUM ('FINGERPRINT_1', 'FINGERPRINT_2', 'FINGERPRINT_BOTH', 'FACE', 'RFID_CARD');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'WEEKLY_OFF', 'HOLIDAY', 'COMPENSATORY_OFF', 'SICK_LEAVE');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'SUCCESS', 'DUPLICATE', 'INVALID', 'SKIPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXTENDED');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('PUBLIC', 'RESTRICTED', 'OPTIONAL');

-- CreateTable
CREATE TABLE "biometric_devices" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "device_type" "BiometricType" NOT NULL,
    "serial_number" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "location" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_sync_time" TIMESTAMP(3),
    "last_sync_status" "DeviceOperationStatus",
    "is_online" BOOLEAN NOT NULL DEFAULT false,
    "configuration" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biometric_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_enrollments" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "enrollment_type" "EnrollmentType" NOT NULL,
    "templateData" TEXT NOT NULL,
    "enrollment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "quality_score" INTEGER NOT NULL DEFAULT 0,
    "last_verified_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'PENDING',
    "rejection_reason" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biometric_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_logs" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "enrollment_id" TEXT,
    "log_time" TIMESTAMP(3) NOT NULL,
    "log_type" "LogType" NOT NULL,
    "verification_method" "VerificationMethod" NOT NULL,
    "verification_score" INTEGER NOT NULL DEFAULT 0,
    "photo_path" TEXT,
    "is_processed" BOOLEAN NOT NULL DEFAULT false,
    "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processing_error" TEXT,
    "duplicate_of" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "attendance_date" TIMESTAMP(3) NOT NULL,
    "shift_id" TEXT,
    "check_in_time" TIMESTAMP(3),
    "check_out_time" TIMESTAMP(3),
    "check_in_device_id" TEXT,
    "check_out_device_id" TEXT,
    "check_in_log_id" TEXT,
    "check_out_log_id" TEXT,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "working_hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "overtime_hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "late_by_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_departure_minutes" INTEGER NOT NULL DEFAULT 0,
    "leave_id" TEXT,
    "is_holiday" BOOLEAN NOT NULL DEFAULT false,
    "is_weekly_off" BOOLEAN NOT NULL DEFAULT false,
    "is_manual_entry" BOOLEAN NOT NULL DEFAULT false,
    "manually_marked_by" TEXT,
    "correction_reason" TEXT,
    "remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "grace_period_minutes" INTEGER NOT NULL DEFAULT 15,
    "half_day_threshold_minutes" INTEGER NOT NULL DEFAULT 240,
    "min_working_hours" DECIMAL(4,2) NOT NULL DEFAULT 8.00,
    "is_night_shift" BOOLEAN NOT NULL DEFAULT false,
    "break_duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_shifts" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "is_permanent" BOOLEAN NOT NULL DEFAULT true,
    "rotation_days" INTEGER,
    "assignment_reason" TEXT,
    "assigned_by" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_types" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "max_days_per_year" INTEGER NOT NULL,
    "is_paid" BOOLEAN NOT NULL DEFAULT true,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "can_carry_forward" BOOLEAN NOT NULL DEFAULT false,
    "max_carry_forward" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaves" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "leave_type_id" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "total_days" DECIMAL(4,1) NOT NULL,
    "reason" TEXT,
    "attachment_path" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "applied_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_date" TIMESTAMP(3),
    "review_comments" TEXT,
    "rejection_reason" TEXT,
    "rejected_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "holiday_date" TIMESTAMP(3) NOT NULL,
    "holiday_type" "HolidayType" NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sync_logs" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "sync_start_time" TIMESTAMP(3) NOT NULL,
    "sync_end_time" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "logs_received" INTEGER NOT NULL DEFAULT 0,
    "logs_processed" INTEGER NOT NULL DEFAULT 0,
    "logs_skipped" INTEGER NOT NULL DEFAULT 0,
    "logs_errors" INTEGER NOT NULL DEFAULT 0,
    "status" "DeviceOperationStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" TEXT,
    "last_log_time" TIMESTAMP(3),
    "next_sync_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_configs" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_value" TEXT NOT NULL,
    "data_type" TEXT NOT NULL DEFAULT 'string',
    "description" TEXT,
    "updated_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "biometric_devices_serial_number_key" ON "biometric_devices"("serial_number");

-- CreateIndex
CREATE INDEX "biometric_devices_hospital_id_idx" ON "biometric_devices"("hospital_id");

-- CreateIndex
CREATE INDEX "biometric_devices_device_type_idx" ON "biometric_devices"("device_type");

-- CreateIndex
CREATE INDEX "biometric_devices_status_idx" ON "biometric_devices"("status");

-- CreateIndex
CREATE INDEX "biometric_devices_last_sync_time_idx" ON "biometric_devices"("last_sync_time");

-- CreateIndex
CREATE UNIQUE INDEX "biometric_devices_hospital_id_serial_number_key" ON "biometric_devices"("hospital_id", "serial_number");

-- CreateIndex
CREATE INDEX "biometric_enrollments_hospital_id_idx" ON "biometric_enrollments"("hospital_id");

-- CreateIndex
CREATE INDEX "biometric_enrollments_user_id_idx" ON "biometric_enrollments"("user_id");

-- CreateIndex
CREATE INDEX "biometric_enrollments_device_id_idx" ON "biometric_enrollments"("device_id");

-- CreateIndex
CREATE INDEX "biometric_enrollments_status_idx" ON "biometric_enrollments"("status");

-- CreateIndex
CREATE INDEX "biometric_enrollments_is_active_idx" ON "biometric_enrollments"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "biometric_enrollments_hospital_id_user_id_enrollment_type_key" ON "biometric_enrollments"("hospital_id", "user_id", "enrollment_type");

-- CreateIndex
CREATE INDEX "attendance_logs_hospital_id_idx" ON "attendance_logs"("hospital_id");

-- CreateIndex
CREATE INDEX "attendance_logs_device_id_idx" ON "attendance_logs"("device_id");

-- CreateIndex
CREATE INDEX "attendance_logs_user_id_idx" ON "attendance_logs"("user_id");

-- CreateIndex
CREATE INDEX "attendance_logs_log_time_idx" ON "attendance_logs"("log_time");

-- CreateIndex
CREATE INDEX "attendance_logs_is_processed_idx" ON "attendance_logs"("is_processed");

-- CreateIndex
CREATE INDEX "attendance_logs_processing_status_idx" ON "attendance_logs"("processing_status");

-- CreateIndex
CREATE INDEX "attendance_logs_created_at_idx" ON "attendance_logs"("created_at");

-- CreateIndex
CREATE INDEX "attendance_logs_hospital_id_log_time_is_processed_idx" ON "attendance_logs"("hospital_id", "log_time", "is_processed");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_logs_hospital_id_device_id_user_id_log_time_key" ON "attendance_logs"("hospital_id", "device_id", "user_id", "log_time");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_check_in_log_id_key" ON "attendance_records"("check_in_log_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_check_out_log_id_key" ON "attendance_records"("check_out_log_id");

-- CreateIndex
CREATE INDEX "attendance_records_hospital_id_idx" ON "attendance_records"("hospital_id");

-- CreateIndex
CREATE INDEX "attendance_records_user_id_idx" ON "attendance_records"("user_id");

-- CreateIndex
CREATE INDEX "attendance_records_attendance_date_idx" ON "attendance_records"("attendance_date");

-- CreateIndex
CREATE INDEX "attendance_records_shift_id_idx" ON "attendance_records"("shift_id");

-- CreateIndex
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");

-- CreateIndex
CREATE INDEX "attendance_records_is_manual_entry_idx" ON "attendance_records"("is_manual_entry");

-- CreateIndex
CREATE INDEX "attendance_records_leave_id_idx" ON "attendance_records"("leave_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_hospital_id_user_id_attendance_date_key" ON "attendance_records"("hospital_id", "user_id", "attendance_date");

-- CreateIndex
CREATE INDEX "shifts_hospital_id_idx" ON "shifts"("hospital_id");

-- CreateIndex
CREATE INDEX "shifts_is_active_idx" ON "shifts"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "shifts_hospital_id_code_key" ON "shifts"("hospital_id", "code");

-- CreateIndex
CREATE INDEX "employee_shifts_hospital_id_idx" ON "employee_shifts"("hospital_id");

-- CreateIndex
CREATE INDEX "employee_shifts_user_id_idx" ON "employee_shifts"("user_id");

-- CreateIndex
CREATE INDEX "employee_shifts_shift_id_idx" ON "employee_shifts"("shift_id");

-- CreateIndex
CREATE UNIQUE INDEX "employee_shifts_hospital_id_user_id_effective_from_shift_id_key" ON "employee_shifts"("hospital_id", "user_id", "effective_from", "shift_id");

-- CreateIndex
CREATE INDEX "leave_types_hospital_id_idx" ON "leave_types"("hospital_id");

-- CreateIndex
CREATE INDEX "leave_types_is_active_idx" ON "leave_types"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "leave_types_hospital_id_code_key" ON "leave_types"("hospital_id", "code");

-- CreateIndex
CREATE INDEX "leaves_hospital_id_idx" ON "leaves"("hospital_id");

-- CreateIndex
CREATE INDEX "leaves_user_id_idx" ON "leaves"("user_id");

-- CreateIndex
CREATE INDEX "leaves_leave_type_id_idx" ON "leaves"("leave_type_id");

-- CreateIndex
CREATE INDEX "leaves_status_idx" ON "leaves"("status");

-- CreateIndex
CREATE INDEX "leaves_applied_date_idx" ON "leaves"("applied_date");

-- CreateIndex
CREATE INDEX "holidays_hospital_id_idx" ON "holidays"("hospital_id");

-- CreateIndex
CREATE INDEX "holidays_holiday_type_idx" ON "holidays"("holiday_type");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_hospital_id_holiday_date_key" ON "holidays"("hospital_id", "holiday_date");

-- CreateIndex
CREATE INDEX "device_sync_logs_hospital_id_idx" ON "device_sync_logs"("hospital_id");

-- CreateIndex
CREATE INDEX "device_sync_logs_device_id_idx" ON "device_sync_logs"("device_id");

-- CreateIndex
CREATE INDEX "device_sync_logs_sync_start_time_idx" ON "device_sync_logs"("sync_start_time");

-- CreateIndex
CREATE INDEX "device_sync_logs_status_idx" ON "device_sync_logs"("status");

-- CreateIndex
CREATE INDEX "attendance_configs_hospital_id_idx" ON "attendance_configs"("hospital_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_configs_hospital_id_config_key_key" ON "attendance_configs"("hospital_id", "config_key");

-- AddForeignKey
ALTER TABLE "biometric_devices" ADD CONSTRAINT "biometric_devices_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_enrollments" ADD CONSTRAINT "biometric_enrollments_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_enrollments" ADD CONSTRAINT "biometric_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_enrollments" ADD CONSTRAINT "biometric_enrollments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_logs" ADD CONSTRAINT "attendance_logs_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "biometric_enrollments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_check_in_device_id_fkey" FOREIGN KEY ("check_in_device_id") REFERENCES "biometric_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_check_out_device_id_fkey" FOREIGN KEY ("check_out_device_id") REFERENCES "biometric_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_check_in_log_id_fkey" FOREIGN KEY ("check_in_log_id") REFERENCES "attendance_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_leave_id_fkey" FOREIGN KEY ("leave_id") REFERENCES "leaves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_manually_marked_by_fkey" FOREIGN KEY ("manually_marked_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sync_logs" ADD CONSTRAINT "device_sync_logs_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sync_logs" ADD CONSTRAINT "device_sync_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_configs" ADD CONSTRAINT "attendance_configs_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

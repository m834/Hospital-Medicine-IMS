-- CreateEnum
CREATE TYPE "ClinicStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TEMPORARILY_CLOSED');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "TokenStatus" AS ENUM ('WAITING', 'CALLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID', 'PARTIALLY_PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ReferralType" AS ENUM ('LAB_TEST', 'RADIOLOGY', 'PHARMACY', 'ADMISSION', 'SPECIALIST_CONSULTATION');

-- CreateEnum
CREATE TYPE "ReferralPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('OPD_CONSULTATION', 'LAB_TEST', 'RADIOLOGY', 'PHARMACY', 'ADMISSION', 'ROOM_CHARGES', 'PROCEDURE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'INSURANCE', 'CREDIT');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('PRIVATE', 'SEMI_PRIVATE', 'GENERAL', 'ICU', 'NICU', 'PICU', 'CCU', 'HDU', 'ISOLATION', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'RESERVED');

-- CreateEnum
CREATE TYPE "BedType" AS ENUM ('STANDARD', 'ELECTRIC', 'ICU_BED', 'PEDIATRIC', 'MATERNITY');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE', 'CLEANING');

-- CreateEnum
CREATE TYPE "AdmissionType" AS ENUM ('EMERGENCY', 'PLANNED', 'REFERRAL');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('ADMITTED', 'DISCHARGED', 'TRANSFERRED', 'ABSCONDED', 'DECEASED');

-- CreateTable
CREATE TABLE "clinics" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "opd_fee" DECIMAL(10,2) NOT NULL,
    "available_days" TEXT[],
    "available_from" TEXT,
    "available_to" TEXT,
    "max_patients_per_day" INTEGER,
    "status" "ClinicStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "token_id" TEXT,
    "registrar_id" TEXT NOT NULL,
    "consultant_id" TEXT,
    "visit_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "token_number" INTEGER NOT NULL,
    "chief_complaint" TEXT,
    "history_of_illness" TEXT,
    "examination" TEXT,
    "diagnosis" TEXT,
    "treatment_plan" TEXT,
    "vital_signs" JSONB,
    "consultation_fee" DECIMAL(10,2) NOT NULL,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "status" "VisitStatus" NOT NULL DEFAULT 'WAITING',
    "consulted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tokens" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "clinic_id" TEXT NOT NULL,
    "token_number" INTEGER NOT NULL,
    "token_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TokenStatus" NOT NULL DEFAULT 'WAITING',
    "called_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "from_department_id" TEXT NOT NULL,
    "to_department_id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "referral_type" "ReferralType" NOT NULL,
    "priority" "ReferralPriority" NOT NULL DEFAULT 'NORMAL',
    "reason" TEXT,
    "notes" TEXT,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "accepted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "visit_id" TEXT,
    "department_id" TEXT NOT NULL,
    "generated_by_id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "receipt_type" "ReceiptType" NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "department_id" TEXT,
    "room_number" TEXT NOT NULL,
    "room_type" "RoomType" NOT NULL,
    "floor" INTEGER,
    "building" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "daily_rate" DECIMAL(10,2) NOT NULL,
    "amenities" TEXT[],
    "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "department_id" TEXT,
    "room_id" TEXT,
    "bed_number" TEXT NOT NULL,
    "bed_type" "BedType" NOT NULL,
    "daily_rate" DECIMAL(10,2) NOT NULL,
    "features" TEXT[],
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admissions" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "visit_id" TEXT,
    "department_id" TEXT NOT NULL,
    "room_id" TEXT,
    "bed_id" TEXT,
    "attending_doctor_id" TEXT NOT NULL,
    "admitting_user_id" TEXT NOT NULL,
    "discharging_user_id" TEXT,
    "admission_number" TEXT NOT NULL,
    "admission_type" "AdmissionType" NOT NULL,
    "admitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discharged_at" TIMESTAMP(3),
    "expected_discharge" TIMESTAMP(3),
    "diagnosis_on_admission" TEXT,
    "diagnosis_on_discharge" TEXT,
    "treatment_summary" TEXT,
    "discharge_summary" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'ADMITTED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_charges" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "admission_id" TEXT NOT NULL,
    "charge_date" DATE NOT NULL,
    "room_charges" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "bed_charges" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "nursing_charges" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "medicine_charges" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "other_charges" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total_charges" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_charges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clinics_hospital_id_idx" ON "clinics"("hospital_id");

-- CreateIndex
CREATE INDEX "clinics_department_id_idx" ON "clinics"("department_id");

-- CreateIndex
CREATE INDEX "clinics_doctor_id_idx" ON "clinics"("doctor_id");

-- CreateIndex
CREATE INDEX "clinics_status_idx" ON "clinics"("status");

-- CreateIndex
CREATE UNIQUE INDEX "clinics_hospital_id_department_id_doctor_id_name_key" ON "clinics"("hospital_id", "department_id", "doctor_id", "name");

-- CreateIndex
CREATE INDEX "visits_hospital_id_idx" ON "visits"("hospital_id");

-- CreateIndex
CREATE INDEX "visits_patient_id_idx" ON "visits"("patient_id");

-- CreateIndex
CREATE INDEX "visits_clinic_id_idx" ON "visits"("clinic_id");

-- CreateIndex
CREATE INDEX "visits_status_idx" ON "visits"("status");

-- CreateIndex
CREATE INDEX "visits_visit_date_idx" ON "visits"("visit_date");

-- CreateIndex
CREATE INDEX "visits_payment_status_idx" ON "visits"("payment_status");

-- CreateIndex
CREATE UNIQUE INDEX "visits_clinic_id_visit_date_token_number_key" ON "visits"("clinic_id", "visit_date", "token_number");

-- CreateIndex
CREATE INDEX "tokens_hospital_id_idx" ON "tokens"("hospital_id");

-- CreateIndex
CREATE INDEX "tokens_clinic_id_idx" ON "tokens"("clinic_id");

-- CreateIndex
CREATE INDEX "tokens_token_date_idx" ON "tokens"("token_date");

-- CreateIndex
CREATE INDEX "tokens_status_idx" ON "tokens"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tokens_clinic_id_token_date_token_number_key" ON "tokens"("clinic_id", "token_date", "token_number");

-- CreateIndex
CREATE INDEX "referrals_hospital_id_idx" ON "referrals"("hospital_id");

-- CreateIndex
CREATE INDEX "referrals_visit_id_idx" ON "referrals"("visit_id");

-- CreateIndex
CREATE INDEX "referrals_from_department_id_idx" ON "referrals"("from_department_id");

-- CreateIndex
CREATE INDEX "referrals_to_department_id_idx" ON "referrals"("to_department_id");

-- CreateIndex
CREATE INDEX "referrals_status_idx" ON "referrals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receipt_number_key" ON "receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "receipts_hospital_id_idx" ON "receipts"("hospital_id");

-- CreateIndex
CREATE INDEX "receipts_patient_id_idx" ON "receipts"("patient_id");

-- CreateIndex
CREATE INDEX "receipts_visit_id_idx" ON "receipts"("visit_id");

-- CreateIndex
CREATE INDEX "receipts_department_id_idx" ON "receipts"("department_id");

-- CreateIndex
CREATE INDEX "receipts_receipt_type_idx" ON "receipts"("receipt_type");

-- CreateIndex
CREATE INDEX "receipts_payment_status_idx" ON "receipts"("payment_status");

-- CreateIndex
CREATE INDEX "receipts_created_at_idx" ON "receipts"("created_at");

-- CreateIndex
CREATE INDEX "rooms_hospital_id_idx" ON "rooms"("hospital_id");

-- CreateIndex
CREATE INDEX "rooms_department_id_idx" ON "rooms"("department_id");

-- CreateIndex
CREATE INDEX "rooms_room_type_idx" ON "rooms"("room_type");

-- CreateIndex
CREATE INDEX "rooms_status_idx" ON "rooms"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_hospital_id_room_number_key" ON "rooms"("hospital_id", "room_number");

-- CreateIndex
CREATE INDEX "beds_hospital_id_idx" ON "beds"("hospital_id");

-- CreateIndex
CREATE INDEX "beds_department_id_idx" ON "beds"("department_id");

-- CreateIndex
CREATE INDEX "beds_room_id_idx" ON "beds"("room_id");

-- CreateIndex
CREATE INDEX "beds_bed_type_idx" ON "beds"("bed_type");

-- CreateIndex
CREATE INDEX "beds_status_idx" ON "beds"("status");

-- CreateIndex
CREATE UNIQUE INDEX "beds_hospital_id_bed_number_key" ON "beds"("hospital_id", "bed_number");

-- CreateIndex
CREATE UNIQUE INDEX "admissions_visit_id_key" ON "admissions"("visit_id");

-- CreateIndex
CREATE UNIQUE INDEX "admissions_admission_number_key" ON "admissions"("admission_number");

-- CreateIndex
CREATE INDEX "admissions_hospital_id_idx" ON "admissions"("hospital_id");

-- CreateIndex
CREATE INDEX "admissions_patient_id_idx" ON "admissions"("patient_id");

-- CreateIndex
CREATE INDEX "admissions_department_id_idx" ON "admissions"("department_id");

-- CreateIndex
CREATE INDEX "admissions_room_id_idx" ON "admissions"("room_id");

-- CreateIndex
CREATE INDEX "admissions_bed_id_idx" ON "admissions"("bed_id");

-- CreateIndex
CREATE INDEX "admissions_status_idx" ON "admissions"("status");

-- CreateIndex
CREATE INDEX "admissions_admitted_at_idx" ON "admissions"("admitted_at");

-- CreateIndex
CREATE INDEX "daily_charges_hospital_id_idx" ON "daily_charges"("hospital_id");

-- CreateIndex
CREATE INDEX "daily_charges_admission_id_idx" ON "daily_charges"("admission_id");

-- CreateIndex
CREATE INDEX "daily_charges_charge_date_idx" ON "daily_charges"("charge_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_charges_admission_id_charge_date_key" ON "daily_charges"("admission_id", "charge_date");

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clinics" ADD CONSTRAINT "clinics_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_registrar_id_fkey" FOREIGN KEY ("registrar_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tokens" ADD CONSTRAINT "tokens_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_from_department_id_fkey" FOREIGN KEY ("from_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_to_department_id_fkey" FOREIGN KEY ("to_department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_attending_doctor_id_fkey" FOREIGN KEY ("attending_doctor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_admitting_user_id_fkey" FOREIGN KEY ("admitting_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admissions" ADD CONSTRAINT "admissions_discharging_user_id_fkey" FOREIGN KEY ("discharging_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_charges" ADD CONSTRAINT "daily_charges_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_charges" ADD CONSTRAINT "daily_charges_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

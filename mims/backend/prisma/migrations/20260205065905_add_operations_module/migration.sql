-- CreateEnum
CREATE TYPE "OperationStatus" AS ENUM ('SCHEDULED', 'PRE_OP', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "OperationTheatreStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OperationPatientType" AS ENUM ('OPD', 'IN_HOUSE');

-- CreateTable
CREATE TABLE "operation_theatres" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "department_id" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT,
    "status" "OperationTheatreStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operation_theatres_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "patient_type" "OperationPatientType" NOT NULL,
    "visit_id" TEXT,
    "admission_id" TEXT,
    "department_id" TEXT NOT NULL,
    "operation_type" TEXT NOT NULL,
    "surgeon_id" TEXT NOT NULL,
    "theatre_id" TEXT NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "estimated_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "emergency_flag" BOOLEAN NOT NULL DEFAULT false,
    "status" "OperationStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "pre_op_notes" TEXT,
    "post_op_notes" TEXT,
    "recovery_notes" TEXT,
    "follow_up_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operation_theatres_hospital_id_idx" ON "operation_theatres"("hospital_id");

-- CreateIndex
CREATE INDEX "operation_theatres_department_id_idx" ON "operation_theatres"("department_id");

-- CreateIndex
CREATE INDEX "operation_theatres_status_idx" ON "operation_theatres"("status");

-- CreateIndex
CREATE UNIQUE INDEX "operation_theatres_hospital_id_code_key" ON "operation_theatres"("hospital_id", "code");

-- CreateIndex
CREATE INDEX "operations_hospital_id_idx" ON "operations"("hospital_id");

-- CreateIndex
CREATE INDEX "operations_patient_id_idx" ON "operations"("patient_id");

-- CreateIndex
CREATE INDEX "operations_department_id_idx" ON "operations"("department_id");

-- CreateIndex
CREATE INDEX "operations_surgeon_id_idx" ON "operations"("surgeon_id");

-- CreateIndex
CREATE INDEX "operations_theatre_id_idx" ON "operations"("theatre_id");

-- CreateIndex
CREATE INDEX "operations_status_idx" ON "operations"("status");

-- CreateIndex
CREATE INDEX "operations_scheduled_at_idx" ON "operations"("scheduled_at");

-- AddForeignKey
ALTER TABLE "operation_theatres" ADD CONSTRAINT "operation_theatres_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operation_theatres" ADD CONSTRAINT "operation_theatres_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_admission_id_fkey" FOREIGN KEY ("admission_id") REFERENCES "admissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_surgeon_id_fkey" FOREIGN KEY ("surgeon_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operations" ADD CONSTRAINT "operations_theatre_id_fkey" FOREIGN KEY ("theatre_id") REFERENCES "operation_theatres"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

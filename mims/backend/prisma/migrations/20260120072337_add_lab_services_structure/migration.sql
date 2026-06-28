-- CreateEnum
CREATE TYPE "LabTestStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "TestPriority" AS ENUM ('ROUTINE', 'URGENT', 'STAT');

-- CreateEnum
CREATE TYPE "LabOrderStatus" AS ENUM ('PENDING', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "lab_tests" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "department_id" TEXT,
    "sub_department_id" TEXT,
    "test_code" TEXT NOT NULL,
    "test_name" TEXT NOT NULL,
    "test_category" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "turnaround_time" TEXT,
    "requirements" TEXT,
    "normalRange" JSONB,
    "status" "LabTestStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_orders" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "visit_id" TEXT,
    "lab_test_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "ordered_by_id" TEXT NOT NULL,
    "priority" "TestPriority" NOT NULL DEFAULT 'ROUTINE',
    "clinical_notes" TEXT,
    "status" "LabOrderStatus" NOT NULL DEFAULT 'PENDING',
    "sample_collected_at" TIMESTAMP(3),
    "sample_collected_by_id" TEXT,
    "sample_type" TEXT,
    "sample_notes" TEXT,
    "results_entered_at" TIMESTAMP(3),
    "results_entered_by_id" TEXT,
    "results" JSONB,
    "result_notes" TEXT,
    "resultFiles" JSONB,
    "results_approved_at" TIMESTAMP(3),
    "results_approved_by_id" TEXT,
    "approval_notes" TEXT,
    "payment_status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount_paid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lab_tests_hospital_id_idx" ON "lab_tests"("hospital_id");

-- CreateIndex
CREATE INDEX "lab_tests_department_id_idx" ON "lab_tests"("department_id");

-- CreateIndex
CREATE INDEX "lab_tests_sub_department_id_idx" ON "lab_tests"("sub_department_id");

-- CreateIndex
CREATE INDEX "lab_tests_test_category_idx" ON "lab_tests"("test_category");

-- CreateIndex
CREATE INDEX "lab_tests_status_idx" ON "lab_tests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lab_tests_hospital_id_test_code_key" ON "lab_tests"("hospital_id", "test_code");

-- CreateIndex
CREATE INDEX "lab_orders_hospital_id_idx" ON "lab_orders"("hospital_id");

-- CreateIndex
CREATE INDEX "lab_orders_patient_id_idx" ON "lab_orders"("patient_id");

-- CreateIndex
CREATE INDEX "lab_orders_visit_id_idx" ON "lab_orders"("visit_id");

-- CreateIndex
CREATE INDEX "lab_orders_lab_test_id_idx" ON "lab_orders"("lab_test_id");

-- CreateIndex
CREATE INDEX "lab_orders_ordered_by_id_idx" ON "lab_orders"("ordered_by_id");

-- CreateIndex
CREATE INDEX "lab_orders_status_idx" ON "lab_orders"("status");

-- CreateIndex
CREATE INDEX "lab_orders_priority_idx" ON "lab_orders"("priority");

-- CreateIndex
CREATE INDEX "lab_orders_created_at_idx" ON "lab_orders"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "lab_orders_hospital_id_order_number_key" ON "lab_orders"("hospital_id", "order_number");

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_sub_department_id_fkey" FOREIGN KEY ("sub_department_id") REFERENCES "sub_departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_lab_test_id_fkey" FOREIGN KEY ("lab_test_id") REFERENCES "lab_tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_ordered_by_id_fkey" FOREIGN KEY ("ordered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_sample_collected_by_id_fkey" FOREIGN KEY ("sample_collected_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_results_entered_by_id_fkey" FOREIGN KEY ("results_entered_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_results_approved_by_id_fkey" FOREIGN KEY ("results_approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

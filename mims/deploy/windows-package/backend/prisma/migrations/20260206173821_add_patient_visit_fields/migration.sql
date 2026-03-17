/*
  Warnings:

  - A unique constraint covering the columns `[visit_number]` on the table `visits` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `visit_number` to the `visits` table without a default value. This is not possible if the table is not empty.
  - Added the required column `visit_type` to the `visits` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "visits" DROP CONSTRAINT "visits_clinic_id_fkey";

-- AlterTable
ALTER TABLE "visits" ADD COLUMN     "attending_doctor_id" TEXT,
ADD COLUMN     "bed_id" TEXT,
ADD COLUMN     "department_id" TEXT,
ADD COLUMN     "visit_number" TEXT NOT NULL,
ADD COLUMN     "visit_type" "VisitType" NOT NULL,
ADD COLUMN     "ward_id" TEXT,
ALTER COLUMN "clinic_id" DROP NOT NULL,
ALTER COLUMN "token_number" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "visits_visit_number_key" ON "visits"("visit_number");

-- CreateIndex
CREATE INDEX "visits_visit_type_idx" ON "visits"("visit_type");

-- CreateIndex
CREATE INDEX "visits_department_id_idx" ON "visits"("department_id");

-- CreateIndex
CREATE INDEX "visits_bed_id_idx" ON "visits"("bed_id");

-- CreateIndex
CREATE INDEX "visits_attending_doctor_id_idx" ON "visits"("attending_doctor_id");

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_clinic_id_fkey" FOREIGN KEY ("clinic_id") REFERENCES "clinics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_attending_doctor_id_fkey" FOREIGN KEY ("attending_doctor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

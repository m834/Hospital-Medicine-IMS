-- CreateEnum
CREATE TYPE "ExpenditureType" AS ENUM ('DAILY_WAGES', 'ELECTRICITY', 'MAINTENANCE', 'PURCHASE', 'MISCELLANEOUS', 'RENT', 'SUPPLIES', 'OTHER');

-- CreateTable
CREATE TABLE "expenditures" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "ExpenditureType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenditures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenditures_hospital_id_date_idx" ON "expenditures"("hospital_id", "date");

-- CreateIndex
CREATE INDEX "expenditures_hospital_id_type_idx" ON "expenditures"("hospital_id", "type");

-- AddForeignKey
ALTER TABLE "expenditures" ADD CONSTRAINT "expenditures_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenditures" ADD CONSTRAINT "expenditures_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

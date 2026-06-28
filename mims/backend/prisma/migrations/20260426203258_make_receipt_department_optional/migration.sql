-- DropForeignKey
ALTER TABLE "receipts" DROP CONSTRAINT "receipts_department_id_fkey";

-- AlterTable
ALTER TABLE "receipts" ALTER COLUMN "department_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

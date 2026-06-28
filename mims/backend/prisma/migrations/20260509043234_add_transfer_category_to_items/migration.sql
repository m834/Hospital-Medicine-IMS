-- AlterTable
ALTER TABLE "prescription_items" ADD COLUMN     "transfer_category" "BatchCategory" NOT NULL DEFAULT 'NORMAL';

-- AlterTable
ALTER TABLE "transfer_items" ADD COLUMN     "transfer_category" "BatchCategory" NOT NULL DEFAULT 'NORMAL';

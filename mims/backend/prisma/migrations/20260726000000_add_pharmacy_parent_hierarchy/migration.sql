-- AlterTable
ALTER TABLE "pharmacies" ADD COLUMN     "parent_pharmacy_id" TEXT;

-- CreateIndex
CREATE INDEX "pharmacies_parent_pharmacy_id_idx" ON "pharmacies"("parent_pharmacy_id");

-- AddForeignKey
ALTER TABLE "pharmacies" ADD CONSTRAINT "pharmacies_parent_pharmacy_id_fkey" FOREIGN KEY ("parent_pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill: every existing row keeps a NULL parent. The main/sub discriminator
-- already exists as "pharmacies"."type" (PharmacyType MAIN|SUB), so no type
-- backfill is required. Existing SUB rows stay parentless until an admin
-- assigns them to a main; they are surfaced as "unassigned" in the tree view.

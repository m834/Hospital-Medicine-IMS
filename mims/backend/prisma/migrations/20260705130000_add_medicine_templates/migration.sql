-- CreateTable
CREATE TABLE "medicine_templates" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "pharmacy_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medicine_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_template_items" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "dosage_frequency" "DosageFrequency",
    "quantity" INTEGER,
    "category" "BatchCategory" NOT NULL DEFAULT 'NORMAL',
    "instructions" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "medicine_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "medicine_templates_hospital_id_idx" ON "medicine_templates"("hospital_id");

-- CreateIndex
CREATE INDEX "medicine_templates_pharmacy_id_idx" ON "medicine_templates"("pharmacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "medicine_templates_pharmacy_id_name_key" ON "medicine_templates"("pharmacy_id", "name");

-- CreateIndex
CREATE INDEX "medicine_template_items_template_id_idx" ON "medicine_template_items"("template_id");

-- AddForeignKey
ALTER TABLE "medicine_templates" ADD CONSTRAINT "medicine_templates_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_templates" ADD CONSTRAINT "medicine_templates_pharmacy_id_fkey" FOREIGN KEY ("pharmacy_id") REFERENCES "pharmacies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_templates" ADD CONSTRAINT "medicine_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_template_items" ADD CONSTRAINT "medicine_template_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "medicine_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_template_items" ADD CONSTRAINT "medicine_template_items_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "medicines_generic_name_idx" ON "medicines"("generic_name");

-- CreateIndex
CREATE INDEX "medicines_form_idx" ON "medicines"("form");

-- CreateIndex
CREATE INDEX "medicines_manufacturer_idx" ON "medicines"("manufacturer");

-- CreateIndex
CREATE INDEX "medicines_hospital_id_status_idx" ON "medicines"("hospital_id", "status");

-- CreateIndex
CREATE INDEX "stock_batches_pharmacy_id_medicine_id_idx" ON "stock_batches"("pharmacy_id", "medicine_id");

-- CreateIndex
CREATE INDEX "stock_batches_pharmacy_id_status_idx" ON "stock_batches"("pharmacy_id", "status");

-- CreateIndex
CREATE INDEX "transfer_requests_hospital_id_status_idx" ON "transfer_requests"("hospital_id", "status");

-- CreateIndex
CREATE INDEX "transfer_requests_created_at_idx" ON "transfer_requests"("created_at");

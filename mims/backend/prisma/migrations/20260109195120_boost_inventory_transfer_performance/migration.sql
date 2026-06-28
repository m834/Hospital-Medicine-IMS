-- CreateIndex
CREATE INDEX "stock_batches_pharmacy_id_medicine_id_status_idx" ON "stock_batches"("pharmacy_id", "medicine_id", "status");

-- CreateIndex
CREATE INDEX "stock_batches_pharmacy_id_expiry_date_idx" ON "stock_batches"("pharmacy_id", "expiry_date");

-- CreateIndex
CREATE INDEX "stock_batches_medicine_id_expiry_date_status_idx" ON "stock_batches"("medicine_id", "expiry_date", "status");

-- CreateIndex
CREATE INDEX "transfer_requests_from_pharmacy_id_status_idx" ON "transfer_requests"("from_pharmacy_id", "status");

-- CreateIndex
CREATE INDEX "transfer_requests_to_pharmacy_id_status_idx" ON "transfer_requests"("to_pharmacy_id", "status");

-- CreateIndex
CREATE INDEX "transfer_requests_hospital_id_created_at_idx" ON "transfer_requests"("hospital_id", "created_at");

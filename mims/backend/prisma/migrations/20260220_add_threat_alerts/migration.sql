-- CreateTable ThreatAlert
CREATE TABLE "threat_alerts" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "user_id" TEXT,
    "admin_id" TEXT,
    "alert_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "requires_action" BOOLEAN NOT NULL DEFAULT false,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "dismissed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "threat_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "threat_alerts_hospital_id_idx" ON "threat_alerts"("hospital_id");

-- CreateIndex
CREATE INDEX "threat_alerts_user_id_idx" ON "threat_alerts"("user_id");

-- CreateIndex
CREATE INDEX "threat_alerts_severity_idx" ON "threat_alerts"("severity");

-- CreateIndex
CREATE INDEX "threat_alerts_alert_type_idx" ON "threat_alerts"("alert_type");

-- CreateIndex
CREATE INDEX "threat_alerts_read_idx" ON "threat_alerts"("read");

-- CreateIndex
CREATE INDEX "threat_alerts_created_at_idx" ON "threat_alerts"("created_at" DESC);

-- CreateIndex
CREATE INDEX "threat_alerts_hospital_read_idx" ON "threat_alerts"("hospital_id", "read");

-- AddForeignKey
ALTER TABLE "threat_alerts" ADD CONSTRAINT "threat_alerts_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threat_alerts" ADD CONSTRAINT "threat_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "threat_alerts" ADD CONSTRAINT "threat_alerts_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


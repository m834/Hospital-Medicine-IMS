-- Errors reported by browsers on client machines, for remote diagnosis.
--
-- A new table only; nothing existing changes. No foreign keys, so a report can
-- be stored before login and never blocks deleting a user or hospital.

CREATE TABLE "client_error_logs" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "occurred_at" TIMESTAMP(3),
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "route" TEXT,
    "api_url" TEXT,
    "api_method" TEXT,
    "api_status" INTEGER,
    "app_version" TEXT,
    "machine_id" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT,
    "hospital_id" TEXT,
    "ip_address" TEXT,

    CONSTRAINT "client_error_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_error_logs_created_at_idx" ON "client_error_logs"("created_at");
CREATE INDEX "client_error_logs_machine_id_created_at_idx" ON "client_error_logs"("machine_id", "created_at");
CREATE INDEX "client_error_logs_kind_created_at_idx" ON "client_error_logs"("kind", "created_at");

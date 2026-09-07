-- Track how often a lab slip has been printed.
--
-- A slip drops into a slot on a pre-printed A4 lab form, so a second print of
-- the same slip burns a form and can put two identical slips into circulation.
-- The count is what the reprint rule is enforced against; who reprinted and
-- when is in audit_logs.
--
-- Existing orders start at 0, so a slip created before this migration can still
-- be printed once.

ALTER TABLE "lab_orders"
  ADD COLUMN "slip_print_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "slip_last_printed_at" TIMESTAMP(3);

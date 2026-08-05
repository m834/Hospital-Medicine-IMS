-- Patients may be identified by a Pakistani CNIC or, for foreign patients, a
-- passport or other national ID. The number keeps using the existing `cnic`
-- column; this records how it should be read and validated.
--
-- Additive and safe on a live database: existing rows default to CNIC, which
-- is what every current patient is.

CREATE TYPE "PatientIdType" AS ENUM ('CNIC', 'OTHER');

ALTER TABLE "patients"
  ADD COLUMN "id_type" "PatientIdType" NOT NULL DEFAULT 'CNIC';

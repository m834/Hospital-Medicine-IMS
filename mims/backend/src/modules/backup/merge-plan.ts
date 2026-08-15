/**
 * What gets merged, in what order, and how a row is recognised as one this
 * database already has.
 *
 * TWO KINDS OF TABLE, TWO RULES
 *
 * Reference data — hospitals, users, pharmacies, medicines, rooms — describes
 * things that exist independently in both systems. The same pharmacist is a
 * row in each, with a different UUID in each, so identity has to be what makes
 * the thing itself: an email, a code, a room number. These get a NEW id here
 * and the old one is remembered, so children can be repointed.
 *
 * Transactional records — prescriptions, dispatches, disposals, transfers —
 * are raised in one system and never in both. Their UUIDs are globally unique,
 * so the id IS the identity: keep it. That also makes the restore repeatable,
 * since a second run finds the row already present rather than inserting it
 * twice.
 *
 * ORDER IS A DEPENDENCY ORDER
 * A row can only be repointed once the thing it points at has been placed, so
 * parents come first. Users sit near the top because half the schema records
 * who did something.
 *
 * NOT INCLUDED, DELIBERATELY
 * audit_logs — the other system's record of its own activity; copying it here
 * would put entries in this hospital's log for actions never performed here.
 * _prisma_migrations — schema bookkeeping, not data.
 * Clinics, tokens, beds and the attendance subsystem — each pulls in a further
 * chain; references to them are set to null rather than guessed at.
 */

export type MergeStrategy = 'natural' | 'id';

export interface TableSpec {
  /** Shown in the report */
  label: string;
  /** Prisma delegate name, e.g. 'stockBatch' */
  model: string;
  strategy: MergeStrategy;
  /** column -> the map holding that table's old-id → new-id translation */
  remap?: Record<string, string>;
  /** columns forming the natural key, read AFTER remapping */
  naturalKey?: string[];
  /** nullable columns to blank when their target was not merged */
  nullable?: string[];
  /** required columns that fall back to the person running the restore */
  userFallback?: string[];
  /** remember this table's id translation under this name */
  mapKey?: string;
}

export const MERGE_PLAN: TableSpec[] = [
  // ── Reference data ───────────────────────────────────────────────────────
  {
    label: 'Hospitals',
    model: 'hospital',
    strategy: 'natural',
    naturalKey: ['code'],
    mapKey: 'hospital',
  },
  {
    label: 'Users',
    model: 'user',
    strategy: 'natural',
    naturalKey: ['email'],
    remap: { hospitalId: 'hospital' },
    // Their pharmacy/department are placed later, so those links are left for
    // the pass below rather than blocking the user being created at all.
    nullable: ['pharmacyId', 'departmentId', 'subDepartmentId', 'managedDepartmentId'],
    mapKey: 'user',
  },
  {
    label: 'Departments',
    model: 'department',
    strategy: 'natural',
    naturalKey: ['hospitalId', 'code'],
    remap: { hospitalId: 'hospital' },
    mapKey: 'department',
  },
  {
    label: 'Pharmacies',
    model: 'pharmacy',
    strategy: 'natural',
    naturalKey: ['hospitalId', 'code'],
    remap: { hospitalId: 'hospital' },
    // The parent pharmacy may not be placed yet; the hierarchy is re-linked
    // afterwards rather than guessed at mid-pass.
    nullable: ['parentPharmacyId'],
    mapKey: 'pharmacy',
  },
  {
    label: 'Rooms (wards)',
    model: 'room',
    strategy: 'natural',
    naturalKey: ['hospitalId', 'roomNumber'],
    remap: { hospitalId: 'hospital', departmentId: 'department', pharmacyId: 'pharmacy' },
    nullable: ['departmentId', 'pharmacyId'],
    mapKey: 'room',
  },
  {
    label: 'Medicines',
    model: 'medicine',
    strategy: 'natural',
    // No unique constraint exists, so identity is what makes it the same drug
    // on a shelf.
    naturalKey: ['hospitalId', 'name', 'strength', 'form'],
    remap: { hospitalId: 'hospital' },
    mapKey: 'medicine',
  },
  {
    label: 'Lab tests',
    model: 'labTest',
    strategy: 'natural',
    // testCode, not name — the column is testCode/testName here
    naturalKey: ['hospitalId', 'testCode'],
    remap: { hospitalId: 'hospital', departmentId: 'department' },
    nullable: ['departmentId', 'subDepartmentId'],
    mapKey: 'labTest',
  },
  {
    label: 'Patients',
    model: 'patient',
    strategy: 'natural',
    naturalKey: ['nrNumber'],
    remap: {
      hospitalId: 'hospital',
      registeredBy: 'user',
      attendingDoctorId: 'user',
    },
    nullable: ['attendingDoctorId'],
    userFallback: ['registeredBy'],
    mapKey: 'patient',
  },
  {
    label: 'Stock batches',
    model: 'stockBatch',
    strategy: 'natural',
    naturalKey: ['hospitalId', 'pharmacyId', 'medicineId', 'batchNo', 'expiryDate'],
    remap: { hospitalId: 'hospital', pharmacyId: 'pharmacy', medicineId: 'medicine' },
    mapKey: 'stockBatch',
  },
  {
    label: 'Prescription templates',
    model: 'medicineTemplate',
    strategy: 'natural',
    naturalKey: ['pharmacyId', 'name'],
    remap: { hospitalId: 'hospital', pharmacyId: 'pharmacy', createdBy: 'user' },
    userFallback: ['createdBy'],
    mapKey: 'medicineTemplate',
  },
  {
    label: 'Template items',
    model: 'medicineTemplateItem',
    strategy: 'id',
    remap: { templateId: 'medicineTemplate', medicineId: 'medicine' },
  },

  // ── Transactional records — identified by their own id ───────────────────
  {
    label: 'Visits',
    model: 'visit',
    strategy: 'id',
    remap: {
      hospitalId: 'hospital',
      patientId: 'patient',
      registrarId: 'user',
      consultantId: 'user',
      attendingDoctorId: 'user',
      departmentId: 'department',
      wardId: 'room',
    },
    // Clinics, tokens and beds are not merged, so these are left empty rather
    // than pointed at whatever happens to share the id here.
    nullable: ['clinicId', 'tokenId', 'consultantId', 'attendingDoctorId', 'departmentId', 'wardId', 'bedId'],
    userFallback: ['registrarId'],
    mapKey: 'visit',
  },
  {
    label: 'Prescriptions',
    model: 'prescription',
    strategy: 'id',
    remap: {
      hospitalId: 'hospital',
      pharmacyId: 'pharmacy',
      doctorId: 'user',
      createdBy: 'user',
      visitId: 'visit',
    },
    nullable: ['pharmacyId', 'doctorId', 'createdBy', 'visitId'],
    mapKey: 'prescription',
  },
  {
    label: 'Prescription medicines',
    model: 'prescriptionMedicine',
    strategy: 'id',
    remap: { prescriptionId: 'prescription', medicineId: 'medicine', addedBy: 'user' },
    userFallback: ['addedBy'],
    mapKey: 'prescriptionMedicine',
  },
  {
    label: 'Dispatches',
    model: 'prescriptionDispatch',
    strategy: 'id',
    remap: { prescriptionId: 'prescription', visitId: 'visit', dispatchedBy: 'user' },
    nullable: ['visitId'],
    userFallback: ['dispatchedBy'],
    mapKey: 'prescriptionDispatch',
  },
  {
    label: 'Dispatch items',
    model: 'prescriptionDispatchItem',
    strategy: 'id',
    remap: {
      dispatchId: 'prescriptionDispatch',
      prescriptionMedicineId: 'prescriptionMedicine',
    },
  },
  {
    label: 'Disposals',
    model: 'disposalTransaction',
    strategy: 'id',
    remap: { hospitalId: 'hospital', pharmacyId: 'pharmacy', disposedBy: 'user' },
    userFallback: ['disposedBy'],
    mapKey: 'disposalTransaction',
  },
  {
    label: 'Disposal items',
    model: 'disposalItem',
    strategy: 'id',
    remap: {
      disposalId: 'disposalTransaction',
      batchId: 'stockBatch',
      medicineId: 'medicine',
    },
  },
  {
    label: 'Transfer requests',
    model: 'transferRequest',
    strategy: 'natural',
    naturalKey: ['requestNumber'],
    remap: {
      hospitalId: 'hospital',
      fromPharmacyId: 'pharmacy',
      toPharmacyId: 'pharmacy',
      requestedBy: 'user',
      approvedBy: 'user',
      receivedBy: 'user',
    },
    nullable: ['approvedBy', 'receivedBy'],
    userFallback: ['requestedBy'],
    mapKey: 'transferRequest',
  },
  {
    label: 'Transfer items',
    model: 'transferItem',
    strategy: 'id',
    remap: { transferId: 'transferRequest', medicineId: 'medicine' },
  },
  {
    label: 'Receipts',
    model: 'receipt',
    strategy: 'natural',
    naturalKey: ['receiptNumber'],
    remap: {
      hospitalId: 'hospital',
      patientId: 'patient',
      visitId: 'visit',
      departmentId: 'department',
      generatedById: 'user',
    },
    nullable: ['visitId', 'departmentId'],
    userFallback: ['generatedById'],
  },
];

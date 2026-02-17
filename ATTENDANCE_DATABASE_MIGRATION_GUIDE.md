# Attendance Module - Detailed Database Migration Guide

**File:** `mims/backend/prisma/migrations/[TIMESTAMP]_add_attendance_module/migration.sql`

**Purpose:** Add 12 new tables for attendance, biometric, shift, and leave management

---

## Complete Prisma Schema Additions

Add the following to `/mims/backend/prisma/schema.prisma` at the END (before enums if applicable):

```prisma
// ============================================
// ATTENDANCE MODULE - BIOMETRIC DEVICES
// ============================================

model BiometricDevice {
  id            String        @id @default(uuid())
  hospitalId    String        @map("hospital_id")
  name          String        // "Gate A Fingerprint Reader"
  deviceType    BiometricType @map("device_type")
  serialNumber  String        @unique @map("serial_number")
  ipAddress     String        @map("ip_address")
  port          Int
  location      String        // "Main Entrance", "Ward A", "Lab"
  status        DeviceStatus  @default(ACTIVE)
  lastSyncTime  DateTime?     @map("last_sync_time")
  lastSyncStatus SyncStatus?   @map("last_sync_status")
  isOnline      Boolean       @default(false) @map("is_online")
  configuration Json?         // Device-specific config
  version       Int           @default(1)
  createdAt     DateTime      @default(now()) @map("created_at")
  updatedAt     DateTime      @updatedAt @map("updated_at")

  // Relations
  hospital         Hospital               @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  enrollments      BiometricEnrollment[]
  attendanceLogs   AttendanceLog[]
  checkInDevices   AttendanceRecord[]     @relation("CheckInDevice")
  checkOutDevices  AttendanceRecord[]     @relation("CheckOutDevice")
  deviceSyncLogs   DeviceSyncLog[]

  @@unique([hospitalId, serialNumber])
  @@index([hospitalId])
  @@index([deviceType])
  @@index([status])
  @@index([lastSyncTime])
  @@map("biometric_devices")
}

model BiometricEnrollment {
  id                 String              @id @default(uuid())
  hospitalId         String              @map("hospital_id")
  userId            String              @map("user_id")
  deviceId          String              @map("device_id")
  enrollmentType    EnrollmentType      @map("enrollment_type") // FINGERPRINT_1, FACE, etc.
  templateData      String              // Encrypted binary template
  enrollmentDate    DateTime            @default(now()) @map("enrollment_date")
  qualityScore      Int                 @default(0) @map("quality_score") // 0-100
  lastVerifiedAt    DateTime?           @map("last_verified_at")
  isActive          Boolean             @default(true) @map("is_active")
  status            EnrollmentStatus    @default(PENDING)
  rejectionReason   String?             @map("rejection_reason")
  attemptCount      Int                 @default(0) @map("attempt_count")
  version           Int                 @default(1)
  createdAt         DateTime            @default(now()) @map("created_at")
  updatedAt         DateTime            @updatedAt @map("updated_at")

  // Relations
  hospital         Hospital           @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  user             User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  device           BiometricDevice    @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  attendanceLogs   AttendanceLog[]

  @@unique([hospitalId, userId, enrollmentType])
  @@index([hospitalId])
  @@index([userId])
  @@index([deviceId])
  @@index([status])
  @@index([isActive])
  @@map("biometric_enrollments")
}

// ============================================
// ATTENDANCE RECORDS & LOGS
// ============================================

model AttendanceLog {
  id                 String              @id @default(uuid())
  hospitalId         String              @map("hospital_id")
  deviceId          String              @map("device_id")
  userId            String              @map("user_id")
  enrollmentId      String?             @map("enrollment_id")
  logTime           DateTime            @map("log_time")
  logType           LogType             @map("log_type")
  verificationMethod VerificationMethod  @map("verification_method")
  verificationScore Int                 @default(0) @map("verification_score")
  photoPath         String?             @map("photo_path")
  isProcessed       Boolean             @default(false) @map("is_processed")
  processingStatus  ProcessingStatus    @default(PENDING) @map("processing_status")
  processingError   String?             @map("processing_error")
  duplicateOf       String?             @map("duplicate_of")
  version           Int                 @default(1)
  createdAt         DateTime            @default(now()) @map("created_at")
  updatedAt         DateTime            @updatedAt @map("updated_at")

  // Relations
  hospital       Hospital            @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  device         BiometricDevice     @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  user           User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  enrollment     BiometricEnrollment? @relation(fields: [enrollmentId], references: [id], onDelete: SetNull)
  attendanceRecord AttendanceRecord?  @relation("LogToRecord")

  @@unique([hospitalId, deviceId, userId, logTime])
  @@index([hospitalId])
  @@index([deviceId])
  @@index([userId])
  @@index([logTime])
  @@index([isProcessed])
  @@index([processingStatus])
  @@index([createdAt])
  @@index([hospitalId, logTime, isProcessed]) // Composite for sync queries
  @@map("attendance_logs")
}

model AttendanceRecord {
  id                  String              @id @default(uuid())
  hospitalId          String              @map("hospital_id")
  userId             String              @map("user_id")
  attendanceDate     Date                @map("attendance_date")
  shiftId            String?             @map("shift_id")
  checkInTime        DateTime?           @map("check_in_time")
  checkOutTime       DateTime?           @map("check_out_time")
  checkInDeviceId    String?             @map("check_in_device_id")
  checkOutDeviceId   String?             @map("check_out_device_id")
  checkInLogId       String?             @map("check_in_log_id")
  checkOutLogId      String?             @map("check_out_log_id")
  
  // Status & calculated fields
  status             AttendanceStatus    @default(ABSENT)
  workingHours       Decimal             @default(0) @map("working_hours") @db.Decimal(5,2)
  overtimeHours      Decimal             @default(0) @map("overtime_hours") @db.Decimal(5,2)
  lateByMinutes      Int                 @default(0) @map("late_by_minutes")
  earlyDepartureMinutes Int              @default(0) @map("early_departure_minutes")
  
  // Leave & Holiday
  leaveId            String?             @map("leave_id")
  isHoliday          Boolean             @default(false) @map("is_holiday")
  isWeeklyOff        Boolean             @default(false) @map("is_weekly_off")
  
  // Manual corrections
  isManualEntry      Boolean             @default(false) @map("is_manual_entry")
  manuallyMarkedBy   String?             @map("manually_marked_by")
  correctionReason   String?             @map("correction_reason")
  remarks            String?
  
  // Metadata
  version            Int                 @default(1)
  createdAt          DateTime            @default(now()) @map("created_at")
  updatedAt          DateTime            @updatedAt @map("updated_at")

  // Relations
  hospital           Hospital            @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  user               User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  shift              Shift?              @relation(fields: [shiftId], references: [id], onDelete: SetNull)
  checkInDevice      BiometricDevice?    @relation("CheckInDevice", fields: [checkInDeviceId], references: [id], onDelete: SetNull)
  checkOutDevice     BiometricDevice?    @relation("CheckOutDevice", fields: [checkOutDeviceId], references: [id], onDelete: SetNull)
  checkInLog         AttendanceLog?      @relation("LogToRecord", fields: [checkInLogId], references: [id], onDelete: SetNull)
  leave              Leave?              @relation(fields: [leaveId], references: [id], onDelete: SetNull)
  markedByUser       User?               @relation("MarkedAttendance", fields: [manuallyMarkedBy], references: [id], onDelete: SetNull)

  @@unique([hospitalId, userId, attendanceDate])
  @@index([hospitalId])
  @@index([userId])
  @@index([attendanceDate])
  @@index([shiftId])
  @@index([status])
  @@index([isManualEntry])
  @@index([leaveId])
  @@index([hospitalId, attendanceDate]) // Daily queries
  @@index([userId, attendanceDate]) // Employee daily
  @@index([hospitalId, status, attendanceDate]) // Status filters
  @@map("attendance_records")
}

// ============================================
// SHIFT MANAGEMENT
// ============================================

model Shift {
  id                      String         @id @default(uuid())
  hospitalId              String         @map("hospital_id")
  name                    String         // "Day Shift"
  code                    String         // "DAY"
  startTime               String         @map("start_time") // "08:00" (HH:MM format)
  endTime                 String         @map("end_time") // "17:00"
  gracePeriodMinutes      Int            @default(15) @map("grace_period_minutes")
  halfDayThresholdMinutes Int            @default(240) @map("half_day_threshold_minutes")
  minWorkingHours         Decimal        @default(8.00) @map("min_working_hours") @db.Decimal(4,2)
  isNightShift            Boolean        @default(false) @map("is_night_shift")
  breakDurationMinutes    Int            @default(30) @map("break_duration_minutes")
  isActive                Boolean        @default(true) @map("is_active")
  description             String?
  version                 Int            @default(1)
  createdAt               DateTime       @default(now()) @map("created_at")
  updatedAt               DateTime       @updatedAt @map("updated_at")

  // Relations
  hospital         Hospital           @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  employeeShifts   EmployeeShift[]
  attendanceRecords AttendanceRecord[]

  @@unique([hospitalId, code])
  @@index([hospitalId])
  @@index([isActive])
  @@map("shifts")
}

model EmployeeShift {
  id                String    @id @default(uuid())
  hospitalId        String    @map("hospital_id")
  userId           String    @map("user_id")
  shiftId          String    @map("shift_id")
  effectiveFrom    Date      @map("effective_from")
  effectiveTo      Date?     @map("effective_to")
  isPermanent      Boolean   @default(true) @map("is_permanent")
  rotationDays     Int?      @map("rotation_days") // For rotating shifts
  assignmentReason String?   @map("assignment_reason")
  assignedBy       String    @map("assigned_by")
  version          Int       @default(1)
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  // Relations
  hospital    Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  shift       Shift    @relation(fields: [shiftId], references: [id], onDelete: Cascade)
  assignedByUser User @relation("EmployeeShiftAssignedBy", fields: [assignedBy], references: [id], onDelete: Restrict)

  @@unique([hospitalId, userId, effectiveFrom, shiftId])
  @@index([hospitalId])
  @@index([userId])
  @@index([shiftId])
  @@index([effectiveFrom])
  @@index([effectiveTo])
  @@map("employee_shifts")
}

// ============================================
// LEAVE MANAGEMENT
// ============================================

model LeaveType {
  id                String     @id @default(uuid())
  hospitalId        String     @map("hospital_id")
  name              String     // "Casual Leave"
  code              String     // "CL"
  maxDaysPerYear    Int        @map("max_days_per_year")
  isPaid            Boolean    @default(true) @map("is_paid")
  requiresApproval  Boolean    @default(true) @map("requires_approval")
  canCarryForward   Boolean    @default(false) @map("can_carry_forward")
  maxCarryForward   Int        @default(0) @map("max_carry_forward")
  isActive          Boolean    @default(true) @map("is_active")
  description       String?
  version           Int        @default(1)
  createdAt         DateTime   @default(now()) @map("created_at")
  updatedAt         DateTime   @updatedAt @map("updated_at")

  // Relations
  hospital Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  leaves   Leave[]

  @@unique([hospitalId, code])
  @@index([hospitalId])
  @@index([isActive])
  @@map("leave_types")
}

model Leave {
  id                String       @id @default(uuid())
  hospitalId        String       @map("hospital_id")
  userId           String       @map("user_id")
  leaveTypeId      String       @map("leave_type_id")
  startDate        Date         @map("start_date")
  endDate          Date         @map("end_date")
  totalDays        Decimal      @map("total_days") @db.Decimal(4,1)
  reason           String?
  attachmentPath   String?      @map("attachment_path")
  
  // Approval workflow
  status           LeaveStatus  @default(PENDING)
  appliedDate      DateTime     @default(now()) @map("applied_date")
  reviewedBy       String?      @map("reviewed_by")
  reviewedDate     DateTime?    @map("reviewed_date")
  reviewComments   String?      @map("review_comments")
  
  // Rejection details
  rejectionReason  String?      @map("rejection_reason")
  rejectedAt       DateTime?    @map("rejected_at")
  
  version          Int          @default(1)
  createdAt        DateTime     @default(now()) @map("created_at")
  updatedAt        DateTime     @updatedAt @map("updated_at")

  // Relations
  hospital         Hospital     @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  user             User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  leaveType        LeaveType    @relation(fields: [leaveTypeId], references: [id], onDelete: Restrict)
  reviewingManager User?        @relation("LeaveReviewedBy", fields: [reviewedBy], references: [id], onDelete: SetNull)
  attendanceRecords AttendanceRecord[]

  @@index([hospitalId])
  @@index([userId])
  @@index([leaveTypeId])
  @@index([status])
  @@index([startDate])
  @@index([appliedDate])
  @@index([hospitalId, status, startDate]) // For approval queue
  @@index([userId, startDate, endDate]) // Leave conflict detection
  @@map("leaves")
}

// ============================================
// HOLIDAYS
// ============================================

model Holiday {
  id           String       @id @default(uuid())
  hospitalId   String       @map("hospital_id")
  name         String       // "New Year"
  holidayDate  Date         @unique @map("holiday_date")
  holidayType  HolidayType  @map("holiday_type")
  description  String?
  isActive     Boolean      @default(true) @map("is_active")
  version      Int          @default(1)
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  // Relations
  hospital Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)

  @@unique([hospitalId, holidayDate])
  @@index([hospitalId])
  @@index([holidayDate])
  @@index([holidayType])
  @@map("holidays")
}

// ============================================
// DEVICE SYNC & OPERATIONS
// ============================================

model DeviceSyncLog {
  id              String    @id @default(uuid())
  hospitalId      String    @map("hospital_id")
  deviceId        String    @map("device_id")
  syncStartTime   DateTime  @map("sync_start_time")
  syncEndTime     DateTime? @map("sync_end_time")
  durationMs      Int?      @map("duration_ms")
  logsReceived    Int       @default(0) @map("logs_received")
  logsProcessed   Int       @default(0) @map("logs_processed")
  logsSkipped     Int       @default(0) @map("logs_skipped")
  logsErrors      Int       @default(0) @map("logs_errors")
  status          SyncStatus @default(PENDING)
  errorMessage    String?   @map("error_message")
  lastLogTime     DateTime? @map("last_log_time")
  nextSyncAt      DateTime? @map("next_sync_at")
  version         Int       @default(1)
  createdAt       DateTime  @default(now()) @map("created_at")

  // Relations
  hospital Hospital       @relation(fields: [hospitalId], references: [id], onDelete: Cascade)
  device   BiometricDevice @relation(fields: [deviceId], references: [id], onDelete: Cascade)

  @@index([hospitalId])
  @@index([deviceId])
  @@index([syncStartTime])
  @@index([status])
  @@map("device_sync_logs")
}

// ============================================
// ATTENDANCE CONFIGURATION
// ============================================

model AttendanceConfig {
  id          String   @id @default(uuid())
  hospitalId  String   @map("hospital_id")
  configKey   String   @map("config_key")
  configValue String   @map("config_value")
  dataType    String   @default("string") @map("data_type") // number, boolean, string, json
  description String?
  updatedBy   String?  @map("updated_by")
  updatedAt   DateTime @updatedAt @map("updated_at")

  // Relations
  hospital Hospital @relation(fields: [hospitalId], references: [id], onDelete: Cascade)

  @@unique([hospitalId, configKey])
  @@index([hospitalId])
  @@map("attendance_configs")
}

// ============================================
// ENUMS - ATTENDANCE
// ============================================

enum BiometricType {
  FINGERPRINT
  FACE
  RFID
  HYBRID
}

enum DeviceStatus {
  ACTIVE
  INACTIVE
  MAINTENANCE
  OFFLINE
  DISABLED
}

enum LogType {
  CHECK_IN
  CHECK_OUT
  ENTRY
  EXIT
  UNKNOWN
}

enum VerificationMethod {
  FINGERPRINT
  FACE
  RFID
  MANUAL
  UNKNOWN
}

enum EnrollmentType {
  FINGERPRINT_1
  FINGERPRINT_2
  FINGERPRINT_BOTH
  FACE
  RFID_CARD
}

enum EnrollmentStatus {
  PENDING
  COMPLETED
  REJECTED
  REVOKED
  EXPIRED
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
  HALF_DAY
  ON_LEAVE
  WEEKLY_OFF
  HOLIDAY
  COMPENSATORY_OFF
  SICK_LEAVE
}

enum ProcessingStatus {
  PENDING
  SUCCESS
  DUPLICATE
  INVALID
  SKIPPED
  ERROR
}

enum LeaveStatus {
  PENDING
  APPROVED
  REJECTED
  CANCELLED
  EXTENDED
}

enum HolidayType {
  PUBLIC
  RESTRICTED
  OPTIONAL
}

enum SyncStatus {
  PENDING
  SUCCESS
  FAILURE
  PARTIAL
  TIMEOUT
}
```

### Update Hospital Model

Add these relations to existing `model Hospital`:

```prisma
model Hospital {
  // ... existing fields ...
  
  // New relations for Attendance module
  biometricDevices      BiometricDevice[]
  biometricEnrollments  BiometricEnrollment[]
  attendanceLogs        AttendanceLog[]
  attendanceRecords     AttendanceRecord[]
  shifts                Shift[]
  employeeShifts        EmployeeShift[]
  leaveTypes            LeaveType[]
  leaves                Leave[]
  holidays              Holiday[]
  deviceSyncLogs        DeviceSyncLog[]
  attendanceConfigs     AttendanceConfig[]
  
  @@map("hospitals")
}
```

### Update User Model

Add these relations to existing `model User`:

```prisma
model User {
  // ... existing fields ...
  
  // New relations for Attendance module
  biometricEnrollments  BiometricEnrollment[]
  attendanceLogs        AttendanceLog[]
  attendanceRecords     AttendanceRecord[]
  employeeShifts        EmployeeShift[]
  shiftAssignments      EmployeeShift[]       @relation("EmployeeShiftAssignedBy")
  leaves                Leave[]
  leaveReviews          Leave[]               @relation("LeaveReviewedBy")
  markedAttendances     AttendanceRecord[]    @relation("MarkedAttendance")
  
  @@map("users")
}
```

---

## Migration SQL Script

```sql
-- Create Biometric Devices table
CREATE TABLE IF NOT EXISTS "biometric_devices" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "device_type" TEXT NOT NULL,
  "serial_number" TEXT NOT NULL UNIQUE,
  "ip_address" TEXT NOT NULL,
  "port" INTEGER NOT NULL,
  "location" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "last_sync_time" TIMESTAMP,
  "last_sync_status" TEXT,
  "is_online" BOOLEAN NOT NULL DEFAULT false,
  "configuration" JSONB,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "biometric_devices_hospital_id_serial_number_key" UNIQUE ("hospital_id", "serial_number"),
  CONSTRAINT "biometric_devices_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE
);

-- Indexes for biometric_devices
CREATE INDEX "biometric_devices_hospital_id_idx" ON "biometric_devices"("hospital_id");
CREATE INDEX "biometric_devices_device_type_idx" ON "biometric_devices"("device_type");
CREATE INDEX "biometric_devices_status_idx" ON "biometric_devices"("status");
CREATE INDEX "biometric_devices_last_sync_time_idx" ON "biometric_devices"("last_sync_time");

-- Create Biometric Enrollments table
CREATE TABLE IF NOT EXISTS "biometric_enrollments" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "enrollment_type" TEXT NOT NULL,
  "template_data" TEXT NOT NULL,
  "enrollment_date" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "quality_score" INTEGER NOT NULL DEFAULT 0,
  "last_verified_at" TIMESTAMP,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "rejection_reason" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "biometric_enrollments_hospital_id_user_id_enrollment_type_key" UNIQUE ("hospital_id", "user_id", "enrollment_type"),
  CONSTRAINT "biometric_enrollments_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE,
  CONSTRAINT "biometric_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "biometric_enrollments_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id") ON DELETE CASCADE
);

-- Indexes for biometric_enrollments
CREATE INDEX "biometric_enrollments_hospital_id_idx" ON "biometric_enrollments"("hospital_id");
CREATE INDEX "biometric_enrollments_user_id_idx" ON "biometric_enrollments"("user_id");
CREATE INDEX "biometric_enrollments_device_id_idx" ON "biometric_enrollments"("device_id");
CREATE INDEX "biometric_enrollments_status_idx" ON "biometric_enrollments"("status");
CREATE INDEX "biometric_enrollments_is_active_idx" ON "biometric_enrollments"("is_active");

-- Create Attendance Logs table
CREATE TABLE IF NOT EXISTS "attendance_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "enrollment_id" TEXT,
  "log_time" TIMESTAMP NOT NULL,
  "log_type" TEXT NOT NULL,
  "verification_method" TEXT NOT NULL,
  "verification_score" INTEGER NOT NULL DEFAULT 0,
  "photo_path" TEXT,
  "is_processed" BOOLEAN NOT NULL DEFAULT false,
  "processing_status" TEXT NOT NULL DEFAULT 'PENDING',
  "processing_error" TEXT,
  "duplicate_of" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_logs_hospital_id_device_id_user_id_log_time_key" UNIQUE ("hospital_id", "device_id", "user_id", "log_time"),
  CONSTRAINT "attendance_logs_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_logs_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "biometric_enrollments"("id") ON DELETE SET NULL
);

-- Indexes for attendance_logs
CREATE INDEX "attendance_logs_hospital_id_idx" ON "attendance_logs"("hospital_id");
CREATE INDEX "attendance_logs_device_id_idx" ON "attendance_logs"("device_id");
CREATE INDEX "attendance_logs_user_id_idx" ON "attendance_logs"("user_id");
CREATE INDEX "attendance_logs_log_time_idx" ON "attendance_logs"("log_time");
CREATE INDEX "attendance_logs_is_processed_idx" ON "attendance_logs"("is_processed");
CREATE INDEX "attendance_logs_processing_status_idx" ON "attendance_logs"("processing_status");
CREATE INDEX "attendance_logs_created_at_idx" ON "attendance_logs"("created_at");
CREATE INDEX "attendance_logs_hospital_id_log_time_is_processed_idx" ON "attendance_logs"("hospital_id", "log_time", "is_processed");

-- Create Shifts table
CREATE TABLE IF NOT EXISTS "shifts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "grace_period_minutes" INTEGER NOT NULL DEFAULT 15,
  "half_day_threshold_minutes" INTEGER NOT NULL DEFAULT 240,
  "min_working_hours" DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  "is_night_shift" BOOLEAN NOT NULL DEFAULT false,
  "break_duration_minutes" INTEGER NOT NULL DEFAULT 30,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shifts_hospital_id_code_key" UNIQUE ("hospital_id", "code"),
  CONSTRAINT "shifts_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE
);

-- Indexes for shifts
CREATE INDEX "shifts_hospital_id_idx" ON "shifts"("hospital_id");
CREATE INDEX "shifts_is_active_idx" ON "shifts"("is_active");

-- Create Employee Shifts table
CREATE TABLE IF NOT EXISTS "employee_shifts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "shift_id" TEXT NOT NULL,
  "effective_from" DATE NOT NULL,
  "effective_to" DATE,
  "is_permanent" BOOLEAN NOT NULL DEFAULT true,
  "rotation_days" INTEGER,
  "assignment_reason" TEXT,
  "assigned_by" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_shifts_hospital_id_user_id_effective_from_shift_id_key" UNIQUE ("hospital_id", "user_id", "effective_from", "shift_id"),
  CONSTRAINT "employee_shifts_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE,
  CONSTRAINT "employee_shifts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "employee_shifts_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE,
  CONSTRAINT "employee_shifts_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- Indexes for employee_shifts
CREATE INDEX "employee_shifts_hospital_id_idx" ON "employee_shifts"("hospital_id");
CREATE INDEX "employee_shifts_user_id_idx" ON "employee_shifts"("user_id");
CREATE INDEX "employee_shifts_shift_id_idx" ON "employee_shifts"("shift_id");
CREATE INDEX "employee_shifts_effective_from_idx" ON "employee_shifts"("effective_from");
CREATE INDEX "employee_shifts_effective_to_idx" ON "employee_shifts"("effective_to");

-- Create Leave Types table
CREATE TABLE IF NOT EXISTS "leave_types" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "max_days_per_year" INTEGER NOT NULL,
  "is_paid" BOOLEAN NOT NULL DEFAULT true,
  "requires_approval" BOOLEAN NOT NULL DEFAULT true,
  "can_carry_forward" BOOLEAN NOT NULL DEFAULT false,
  "max_carry_forward" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leave_types_hospital_id_code_key" UNIQUE ("hospital_id", "code"),
  CONSTRAINT "leave_types_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE
);

-- Indexes for leave_types
CREATE INDEX "leave_types_hospital_id_idx" ON "leave_types"("hospital_id");
CREATE INDEX "leave_types_is_active_idx" ON "leave_types"("is_active");

-- Create Leaves table
CREATE TABLE IF NOT EXISTS "leaves" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "leave_type_id" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "total_days" DECIMAL(4,1) NOT NULL,
  "reason" TEXT,
  "attachment_path" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "applied_date" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by" TEXT,
  "reviewed_date" TIMESTAMP,
  "review_comments" TEXT,
  "rejection_reason" TEXT,
  "rejected_at" TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leaves_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE,
  CONSTRAINT "leaves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "leaves_leave_type_id_fkey" FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT,
  CONSTRAINT "leaves_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Indexes for leaves
CREATE INDEX "leaves_hospital_id_idx" ON "leaves"("hospital_id");
CREATE INDEX "leaves_user_id_idx" ON "leaves"("user_id");
CREATE INDEX "leaves_leave_type_id_idx" ON "leaves"("leave_type_id");
CREATE INDEX "leaves_status_idx" ON "leaves"("status");
CREATE INDEX "leaves_start_date_idx" ON "leaves"("start_date");
CREATE INDEX "leaves_applied_date_idx" ON "leaves"("applied_date");
CREATE INDEX "leaves_hospital_id_status_start_date_idx" ON "leaves"("hospital_id", "status", "start_date");
CREATE INDEX "leaves_user_id_start_date_end_date_idx" ON "leaves"("user_id", "start_date", "end_date");

-- Create Holidays table
CREATE TABLE IF NOT EXISTS "holidays" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "holiday_date" DATE NOT NULL UNIQUE,
  "holiday_type" TEXT NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "holidays_hospital_id_holiday_date_key" UNIQUE ("hospital_id", "holiday_date"),
  CONSTRAINT "holidays_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE
);

-- Indexes for holidays
CREATE INDEX "holidays_hospital_id_idx" ON "holidays"("hospital_id");
CREATE INDEX "holidays_holiday_date_idx" ON "holidays"("holiday_date");
CREATE INDEX "holidays_holiday_type_idx" ON "holidays"("holiday_type");

-- Create Attendance Records table (this should come after shifts and leaves are created)
CREATE TABLE IF NOT EXISTS "attendance_records" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "attendance_date" DATE NOT NULL,
  "shift_id" TEXT,
  "check_in_time" TIMESTAMP,
  "check_out_time" TIMESTAMP,
  "check_in_device_id" TEXT,
  "check_out_device_id" TEXT,
  "check_in_log_id" TEXT,
  "check_out_log_id" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ABSENT',
  "working_hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "overtime_hours" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "late_by_minutes" INTEGER NOT NULL DEFAULT 0,
  "early_departure_minutes" INTEGER NOT NULL DEFAULT 0,
  "leave_id" TEXT,
  "is_holiday" BOOLEAN NOT NULL DEFAULT false,
  "is_weekly_off" BOOLEAN NOT NULL DEFAULT false,
  "is_manual_entry" BOOLEAN NOT NULL DEFAULT false,
  "manually_marked_by" TEXT,
  "correction_reason" TEXT,
  "remarks" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_records_hospital_id_user_id_attendance_date_key" UNIQUE ("hospital_id", "user_id", "attendance_date"),
  CONSTRAINT "attendance_records_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "attendance_records_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL,
  CONSTRAINT "attendance_records_check_in_device_id_fkey" FOREIGN KEY ("check_in_device_id") REFERENCES "biometric_devices"("id") ON DELETE SET NULL,
  CONSTRAINT "attendance_records_check_out_device_id_fkey" FOREIGN KEY ("check_out_device_id") REFERENCES "biometric_devices"("id") ON DELETE SET NULL,
  CONSTRAINT "attendance_records_leave_id_fkey" FOREIGN KEY ("leave_id") REFERENCES "leaves"("id") ON DELETE SET NULL,
  CONSTRAINT "attendance_records_manually_marked_by_fkey" FOREIGN KEY ("manually_marked_by") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Indexes for attendance_records
CREATE INDEX "attendance_records_hospital_id_idx" ON "attendance_records"("hospital_id");
CREATE INDEX "attendance_records_user_id_idx" ON "attendance_records"("user_id");
CREATE INDEX "attendance_records_attendance_date_idx" ON "attendance_records"("attendance_date");
CREATE INDEX "attendance_records_shift_id_idx" ON "attendance_records"("shift_id");
CREATE INDEX "attendance_records_status_idx" ON "attendance_records"("status");
CREATE INDEX "attendance_records_is_manual_entry_idx" ON "attendance_records"("is_manual_entry");
CREATE INDEX "attendance_records_leave_id_idx" ON "attendance_records"("leave_id");
CREATE INDEX "attendance_records_hospital_id_attendance_date_idx" ON "attendance_records"("hospital_id", "attendance_date");
CREATE INDEX "attendance_records_user_id_attendance_date_idx" ON "attendance_records"("user_id", "attendance_date");
CREATE INDEX "attendance_records_hospital_id_status_attendance_date_idx" ON "attendance_records"("hospital_id", "status", "attendance_date");

-- Create Device Sync Logs table
CREATE TABLE IF NOT EXISTS "device_sync_logs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "device_id" TEXT NOT NULL,
  "sync_start_time" TIMESTAMP NOT NULL,
  "sync_end_time" TIMESTAMP,
  "duration_ms" INTEGER,
  "logs_received" INTEGER NOT NULL DEFAULT 0,
  "logs_processed" INTEGER NOT NULL DEFAULT 0,
  "logs_skipped" INTEGER NOT NULL DEFAULT 0,
  "logs_errors" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "error_message" TEXT,
  "last_log_time" TIMESTAMP,
  "next_sync_at" TIMESTAMP,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "device_sync_logs_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE,
  CONSTRAINT "device_sync_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id") ON DELETE CASCADE
);

-- Indexes for device_sync_logs
CREATE INDEX "device_sync_logs_hospital_id_idx" ON "device_sync_logs"("hospital_id");
CREATE INDEX "device_sync_logs_device_id_idx" ON "device_sync_logs"("device_id");
CREATE INDEX "device_sync_logs_sync_start_time_idx" ON "device_sync_logs"("sync_start_time");
CREATE INDEX "device_sync_logs_status_idx" ON "device_sync_logs"("status");

-- Create Attendance Config table
CREATE TABLE IF NOT EXISTS "attendance_configs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "hospital_id" TEXT NOT NULL,
  "config_key" TEXT NOT NULL,
  "config_value" TEXT NOT NULL,
  "data_type" TEXT NOT NULL DEFAULT 'string',
  "description" TEXT,
  "updated_by" TEXT,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attendance_configs_hospital_id_config_key_key" UNIQUE ("hospital_id", "config_key"),
  CONSTRAINT "attendance_configs_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE CASCADE
);

-- Indexes for attendance_configs
CREATE INDEX "attendance_configs_hospital_id_idx" ON "attendance_configs"("hospital_id");
```

---

## Rollback Plan

If migration fails, use:

```bash
npx prisma migrate resolve --rolled-back [MIGRATION_NAME]
```

---

## Verification Checklist

After migration, verify:

```sql
-- Check table creation
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name LIKE '%attendance%';

-- Verify indexes
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' AND tablename LIKE '%attendance%';

-- Check foreign keys
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_schema = 'public' AND table_name LIKE '%attendance%';

-- Verify unique constraints
SELECT constraint_name FROM information_schema.table_constraints 
WHERE table_schema = 'public' AND constraint_type = 'UNIQUE' 
AND table_name LIKE '%attendance%';
```

---

**End of Migration Guide**

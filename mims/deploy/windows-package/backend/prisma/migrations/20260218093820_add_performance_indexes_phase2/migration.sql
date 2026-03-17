-- Phase 2: Performance Optimization Indexes
-- Added Feb 18, 2026
-- Target: 10x improvement in query performance

-- ============================================
-- AttendanceRecord Indexes (3)
-- ============================================

-- Index 1: Employee lookup by date range
-- Use case: Get all attendance records for an employee during a date range
-- Query: SELECT * FROM attendance_records WHERE hospital_id = ? AND user_id = ? AND attendance_date BETWEEN ? AND ?
CREATE INDEX "idx_attendance_record_employee_date" 
ON "attendance_records"("hospital_id", "user_id", "attendance_date");

-- Index 2: Time range + status filtering
-- Use case: Get all attendance records for a time period with specific status
-- Query: SELECT * FROM attendance_records WHERE hospital_id = ? AND attendance_date BETWEEN ? AND ? AND status = ?
CREATE INDEX "idx_attendance_record_date_status" 
ON "attendance_records"("hospital_id", "attendance_date", "status");

-- Index 3: Device sync log retrieval
-- Use case: Get attendance logs for a specific device during sync
-- Query: SELECT * FROM attendance_records WHERE hospital_id = ? AND check_in_device_id = ? AND attendance_date >= ?
CREATE INDEX "idx_attendance_record_device_sync" 
ON "attendance_records"("hospital_id", "check_in_device_id", "attendance_date");

-- ============================================
-- Leave (LeaveRequest) Indexes (3)
-- ============================================

-- Index 4: Employee leave by status
-- Use case: Get all leave requests for an employee with a specific status
-- Query: SELECT * FROM leaves WHERE hospital_id = ? AND user_id = ? AND status = ?
CREATE INDEX "idx_leave_employee_status" 
ON "leaves"("hospital_id", "user_id", "status");

-- Index 5: Approver queue
-- Use case: Get all pending leave requests for an approver
-- Query: SELECT * FROM leaves WHERE hospital_id = ? AND reviewed_by = ? AND status = 'PENDING'
CREATE INDEX "idx_leave_approver_queue" 
ON "leaves"("hospital_id", "reviewed_by", "status") 
WHERE "status" = 'PENDING';

-- Index 6: Date range conflict detection
-- Use case: Check for leave overlaps during a date range
-- Query: SELECT * FROM leaves WHERE hospital_id = ? AND user_id = ? AND start_date <= ? AND end_date >= ?
CREATE INDEX "idx_leave_date_range" 
ON "leaves"("hospital_id", "user_id", "start_date", "end_date");

-- ============================================
-- EmployeeShift Indexes (3)
-- ============================================

-- Index 7: Employee shift lookup
-- Use case: Get current/future shifts for an employee
-- Query: SELECT * FROM employee_shifts WHERE hospital_id = ? AND user_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)
CREATE INDEX "idx_employee_shift_employee_date" 
ON "employee_shifts"("hospital_id", "user_id", "effective_from", "effective_to");

-- Index 8: Shift roster generation
-- Use case: Get all employees assigned to a shift during a date range
-- Query: SELECT * FROM employee_shifts WHERE hospital_id = ? AND shift_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to > ?)
CREATE INDEX "idx_employee_shift_roster" 
ON "employee_shifts"("hospital_id", "shift_id", "effective_from", "effective_to");

-- Index 9: Conflict detection for shift overlaps
-- Use case: Check for shift assignment conflicts in a date range
-- Query: SELECT * FROM employee_shifts WHERE hospital_id = ? AND user_id = ? AND effective_from < ? AND (effective_to IS NULL OR effective_to > ?)
CREATE INDEX "idx_employee_shift_conflict" 
ON "employee_shifts"("hospital_id", "user_id", "effective_from", "effective_to");

-- ============================================
-- DeviceSyncLog Indexes (2)
-- ============================================

-- Index 10: Device sync history
-- Use case: Get sync history for a specific device
-- Query: SELECT * FROM device_sync_logs WHERE hospital_id = ? AND device_id = ? ORDER BY sync_start_time DESC LIMIT 100
CREATE INDEX "idx_device_sync_history" 
ON "device_sync_logs"("hospital_id", "device_id", "sync_start_time");

-- Index 11: Failed sync tracking
-- Use case: Get all failed syncs in a time window for monitoring
-- Query: SELECT * FROM device_sync_logs WHERE hospital_id = ? AND status = 'FAILURE' AND sync_end_time >= ?
CREATE INDEX "idx_device_sync_failed" 
ON "device_sync_logs"("hospital_id", "status", "sync_end_time") 
WHERE "status" = 'FAILURE';

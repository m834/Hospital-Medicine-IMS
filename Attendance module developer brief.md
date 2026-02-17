# Hospital Management System - Attendance Module Development Brief

## Project Overview
We are adding a comprehensive **Attendance Module** to our existing Hospital Management System. This module will integrate with biometric devices (fingerprint/face recognition machines) to automatically capture and manage employee attendance across the hospital.

---

## Business Objectives
1. Automate attendance tracking for all hospital staff (doctors, nurses, administrative staff)
2. Eliminate manual attendance registers and proxy attendance
3. Integrate attendance data with payroll processing
4. Provide real-time attendance monitoring for management
5. Generate comprehensive attendance reports for HR and compliance

---

## Project Scope

### In Scope:
- Biometric device integration (fingerprint/face recognition)
- Employee enrollment system for biometric data
- Real-time attendance marking (check-in/check-out)
- Shift management system
- Leave management integration
- Attendance reports and analytics
- Admin dashboard for monitoring
- Multi-device support across hospital locations
- Offline data storage and sync capabilities

### Out of Scope (for now):
- Payroll calculation (we'll provide attendance data API)
- Mobile GPS-based attendance (Phase 2)
- Advanced analytics and AI predictions (Phase 2)

---

## Technical Requirements

### Current System Stack:
- **Backend**: [Your current backend - e.g., Node.js/Python/Java/.NET]
- **Database**: [Your current database - e.g., MySQL/PostgreSQL/MongoDB]
- **Frontend**: [Your current frontend - e.g., React/Angular/Vue]
- **Server**: [Your hosting environment]

### New Integrations Required:
- Biometric device SDK integration
- Real-time data synchronization service
- Attendance calculation engine
- Reporting module

---

## Detailed Requirements

### 1. User Types & Access Levels
- **Super Admin**: Full access, device management, system configuration
- **HR Manager**: Attendance reports, leave approval, shift management
- **Department Head**: View department attendance, approve leaves
- **Employee**: View own attendance, apply for leave
- **Biometric Operator**: Enroll employees, troubleshoot device issues

### 2. Attendance Rules
- **Grace Period**: 15 minutes for late arrival
- **Half Day**: If arrived after [X hours] from shift start
- **Absent**: No check-in recorded
- **Overtime**: Work beyond shift end time
- **Multiple Punches**: Support multiple in/out during a shift
- **Weekly Off**: Configurable per employee/department
- **Public Holidays**: Master list with auto-marking

### 3. Shift Types
- **Fixed Shifts**: Day (8 AM - 5 PM), Night (8 PM - 5 AM)
- **Rotating Shifts**: Weekly/monthly rotation
- **Flexible Shifts**: For doctors with variable schedules
- **On-Call Duty**: Special attendance marking

### 4. Leave Types
- Sick Leave
- Casual Leave
- Earned Leave
- Maternity/Paternity Leave
- Unpaid Leave
- Compensatory Off

---

## TODO LIST - PHASE-WISE BREAKDOWN

## 📋 PHASE 1: SETUP & PLANNING (Days 1-3)

### ✅ Day 1: Environment Setup & Analysis
- [ ] Set up development environment
- [ ] Review existing Hospital Management System codebase
- [ ] Identify integration points in current system
- [ ] Document current database schema
- [ ] Set up version control branch for attendance module
- [ ] Install necessary SDKs and dependencies

### ✅ Day 2: Device Research & Selection
- [ ] Research compatible biometric devices (ZKTeco, eSSL, Suprema)
- [ ] Evaluate device SDK documentation
- [ ] Check device API compatibility with our tech stack
- [ ] Finalize device model and procurement requirements
- [ ] Document device specifications and capabilities
- [ ] Prepare device procurement list with quantities

### ✅ Day 3: Database Design
- [ ] Design complete database schema for attendance module
- [ ] Create ER diagram showing relationships
- [ ] Plan migration strategy for existing employee data
- [ ] Design indexing strategy for performance
- [ ] Review schema with team lead
- [ ] Create database migration scripts

---

## 📋 PHASE 2: DATABASE IMPLEMENTATION (Days 4-5)

### ✅ Day 4: Create Core Tables
- [ ] Create `devices` table (device master)
- [ ] Create `biometric_templates` table (employee fingerprint data)
- [ ] Create `attendance_logs` table (raw device logs)
- [ ] Create `attendance_records` table (processed attendance)
- [ ] Create `shifts` table (shift master)
- [ ] Create `employee_shifts` table (employee-shift mapping)
- [ ] Add necessary indexes and constraints

### ✅ Day 5: Create Supporting Tables
- [ ] Create `leave_types` table
- [ ] Create `leave_applications` table
- [ ] Create `holidays` table
- [ ] Create `attendance_settings` table (grace period, rules)
- [ ] Create `device_logs` table (device status monitoring)
- [ ] Set up foreign key relationships
- [ ] Create database views for common queries
- [ ] Write seed data for testing

---

## 📋 PHASE 3: DEVICE INTEGRATION LAYER (Days 6-10)

### ✅ Day 6-7: Device SDK Setup
- [ ] Install biometric device SDK
- [ ] Set up device simulator for testing (if available)
- [ ] Create device connection module
- [ ] Implement device discovery functionality
- [ ] Test basic device connectivity
- [ ] Create device configuration interface
- [ ] Document device communication protocol

### ✅ Day 8-9: Device Operations
- [ ] Implement employee enrollment API
  - [ ] Capture fingerprint template
  - [ ] Store template in device
  - [ ] Store template reference in database
  - [ ] Handle enrollment errors
- [ ] Implement real-time attendance listener
  - [ ] Listen to device events
  - [ ] Parse attendance data
  - [ ] Validate data format
  - [ ] Queue data for processing
- [ ] Implement device synchronization
  - [ ] Pull logs from device
  - [ ] Handle offline scenarios
  - [ ] Implement retry mechanism

### ✅ Day 10: Device Management Features
- [ ] Create device health monitoring
- [ ] Implement device status dashboard
- [ ] Create device logs viewer
- [ ] Implement remote device restart/configuration
- [ ] Add device alerts (offline, storage full, etc.)
- [ ] Test with multiple devices (if available)

---

## 📋 PHASE 4: BACKEND API DEVELOPMENT (Days 11-17)

### ✅ Day 11-12: Employee & Biometric APIs
- [ ] **POST** `/api/biometric/enroll` - Enroll employee fingerprint
- [ ] **GET** `/api/biometric/status/:employeeId` - Check enrollment status
- [ ] **DELETE** `/api/biometric/remove/:employeeId` - Remove biometric data
- [ ] **POST** `/api/biometric/re-enroll` - Re-enroll if fingerprint changed
- [ ] Add validation and error handling
- [ ] Write unit tests

### ✅ Day 13-14: Attendance Processing APIs
- [ ] **POST** `/api/attendance/mark` - Manual attendance marking (admin)
- [ ] **GET** `/api/attendance/live` - Real-time attendance dashboard
- [ ] **GET** `/api/attendance/employee/:id` - Employee attendance history
- [ ] **GET** `/api/attendance/date/:date` - Daily attendance report
- [ ] **GET** `/api/attendance/department/:id` - Department-wise attendance
- [ ] Create attendance calculation service
  - [ ] Calculate check-in/check-out status
  - [ ] Determine present/absent/late/half-day
  - [ ] Calculate working hours
  - [ ] Calculate overtime
- [ ] Implement attendance rules engine
- [ ] Write unit tests

### ✅ Day 15: Shift Management APIs
- [ ] **POST** `/api/shifts` - Create shift
- [ ] **PUT** `/api/shifts/:id` - Update shift
- [ ] **DELETE** `/api/shifts/:id` - Delete shift
- [ ] **GET** `/api/shifts` - List all shifts
- [ ] **POST** `/api/shifts/assign` - Assign shift to employee(s)
- [ ] **GET** `/api/shifts/employee/:id` - Get employee shift schedule
- [ ] Implement shift rotation logic
- [ ] Write unit tests

### ✅ Day 16: Leave Management APIs
- [ ] **POST** `/api/leaves/apply` - Apply for leave
- [ ] **PUT** `/api/leaves/approve/:id` - Approve/reject leave
- [ ] **GET** `/api/leaves/employee/:id` - Employee leave history
- [ ] **GET** `/api/leaves/pending` - Pending leave applications
- [ ] **GET** `/api/leaves/balance/:employeeId` - Leave balance
- [ ] Integrate leave with attendance marking
- [ ] Send notifications on leave approval/rejection
- [ ] Write unit tests

### ✅ Day 17: Settings & Configuration APIs
- [ ] **POST** `/api/attendance/settings` - Update attendance rules
- [ ] **GET** `/api/attendance/settings` - Get current settings
- [ ] **POST** `/api/holidays` - Add holiday
- [ ] **GET** `/api/holidays/:year` - Get holidays list
- [ ] **POST** `/api/devices/register` - Register new device
- [ ] **GET** `/api/devices` - List all devices
- [ ] **PUT** `/api/devices/:id/status` - Update device status
- [ ] Write unit tests

---

## 📋 PHASE 5: REPORTING ENGINE (Days 18-20)

### ✅ Day 18-19: Report Generation
- [ ] Create daily attendance summary report
  - [ ] Total employees, Present, Absent, Late, On Leave
  - [ ] Department-wise breakdown
  - [ ] Export to Excel/PDF
- [ ] Create monthly attendance sheet
  - [ ] Calendar view with P/A/L/H markings
  - [ ] Working days calculation
  - [ ] Export functionality
- [ ] Create late arrival report
- [ ] Create early departure report
- [ ] Create overtime report
- [ ] Create leave summary report
- [ ] Create absenteeism trend report

### ✅ Day 20: Report APIs
- [ ] **GET** `/api/reports/daily/:date` - Daily summary
- [ ] **GET** `/api/reports/monthly/:month/:year` - Monthly report
- [ ] **GET** `/api/reports/employee/:id/:month/:year` - Employee report
- [ ] **GET** `/api/reports/department/:id/:from/:to` - Department report
- [ ] **GET** `/api/reports/late/:from/:to` - Late arrivals
- [ ] **GET** `/api/reports/overtime/:from/:to` - Overtime report
- [ ] **POST** `/api/reports/custom` - Custom report with filters
- [ ] Implement report caching for performance
- [ ] Add export functionality (Excel, PDF, CSV)

---

## 📋 PHASE 6: FRONTEND DEVELOPMENT (Days 21-30)

### ✅ Day 21-22: Biometric Enrollment Interface
- [ ] Create employee search/selection screen
- [ ] Design fingerprint enrollment wizard
  - [ ] Step 1: Employee verification
  - [ ] Step 2: Device selection
  - [ ] Step 3: Fingerprint capture (3-5 times)
  - [ ] Step 4: Verification
  - [ ] Step 5: Confirmation
- [ ] Show enrollment status and success/failure
- [ ] Add re-enrollment option
- [ ] Implement error handling and user guidance
- [ ] Test with actual device

### ✅ Day 23-24: Live Attendance Dashboard
- [ ] Create real-time attendance dashboard
  - [ ] Today's attendance summary cards
  - [ ] Present/Absent/Late count
  - [ ] Department-wise breakdown
  - [ ] Recent check-ins list (auto-refresh)
  - [ ] Graphical representation (charts)
- [ ] Add filters (department, shift, status)
- [ ] Implement search functionality
- [ ] Add date range selector
- [ ] Make it responsive for mobile/tablet

### ✅ Day 25: Attendance Management Screens
- [ ] Create manual attendance marking screen (admin)
- [ ] Create attendance correction screen
- [ ] Create bulk attendance upload (Excel)
- [ ] Create attendance history viewer
  - [ ] Calendar view
  - [ ] List view with filters
  - [ ] Export options
- [ ] Implement pagination for large datasets

### ✅ Day 26: Shift Management Interface
- [ ] Create shift master management screen
  - [ ] Add/Edit/Delete shifts
  - [ ] Set shift timings
  - [ ] Configure grace period
- [ ] Create shift assignment screen
  - [ ] Individual assignment
  - [ ] Bulk assignment
  - [ ] Shift roster view (calendar)
- [ ] Create shift rotation scheduler
- [ ] Add shift swap functionality

### ✅ Day 27: Leave Management Interface
- [ ] Create leave application form
  - [ ] Leave type selection
  - [ ] Date range picker
  - [ ] Reason text area
  - [ ] Attachment upload
- [ ] Create leave approval dashboard
  - [ ] Pending requests queue
  - [ ] Approve/Reject actions
  - [ ] Comments feature
- [ ] Create employee leave history view
- [ ] Create leave balance display
- [ ] Add leave calendar view

### ✅ Day 28-29: Reports Interface
- [ ] Create report selection dashboard
- [ ] Implement daily attendance report viewer
- [ ] Implement monthly attendance sheet
  - [ ] Calendar-style grid
  - [ ] Color coding (P/A/L/H)
  - [ ] Summary statistics
- [ ] Create custom report builder
  - [ ] Date range selector
  - [ ] Department filter
  - [ ] Employee filter
  - [ ] Report type selector
- [ ] Add export buttons (Excel, PDF, Print)
- [ ] Implement report preview before export
- [ ] Add email report functionality

### ✅ Day 30: Settings & Configuration Screens
- [ ] Create attendance settings screen
  - [ ] Grace period configuration
  - [ ] Half-day threshold
  - [ ] Overtime rules
  - [ ] Auto-absent marking time
- [ ] Create holiday management screen
- [ ] Create device management screen
  - [ ] Device list
  - [ ] Device status monitoring
  - [ ] Device configuration
- [ ] Create notification settings
- [ ] Add system logs viewer

---

## 📋 PHASE 7: INTEGRATION & SYNC (Days 31-33)

### ✅ Day 31: Background Services
- [ ] Create attendance auto-calculation cron job
  - [ ] Run at end of day
  - [ ] Process all attendance logs
  - [ ] Mark absents automatically
  - [ ] Calculate overtime
- [ ] Create device sync scheduler
  - [ ] Pull logs every 5 minutes
  - [ ] Handle connection failures
  - [ ] Retry mechanism
- [ ] Create leave balance update job
- [ ] Create notification service
  - [ ] Late arrival notifications
  - [ ] Absent notifications
  - [ ] Leave approval notifications

### ✅ Day 32: Integration with Existing Modules
- [ ] Integrate with Employee Management module
  - [ ] Fetch employee list
  - [ ] Update employee status
- [ ] Integrate with HR module
  - [ ] Provide attendance data API
  - [ ] Leave balance integration
- [ ] Create attendance data export API for Payroll
- [ ] Integrate with Notification module
- [ ] Test all integration points

### ✅ Day 33: Offline & Edge Cases
- [ ] Implement offline data storage on device
- [ ] Create manual sync trigger
- [ ] Handle duplicate attendance entries
- [ ] Implement data reconciliation logic
- [ ] Handle clock time differences
- [ ] Add data validation and sanitization
- [ ] Test network failure scenarios

---

## 📋 PHASE 8: TESTING (Days 34-38)

### ✅ Day 34: Unit Testing
- [ ] Write unit tests for all API endpoints (80%+ coverage)
- [ ] Write unit tests for attendance calculation logic
- [ ] Write unit tests for shift assignment logic
- [ ] Write unit tests for leave balance calculations
- [ ] Run and fix all failing tests

### ✅ Day 35: Integration Testing
- [ ] Test device enrollment flow end-to-end
- [ ] Test attendance marking flow
- [ ] Test leave application and approval flow
- [ ] Test shift assignment and rotation
- [ ] Test report generation
- [ ] Test data synchronization

### ✅ Day 36: Performance Testing
- [ ] Load test with 1000+ employees
- [ ] Test concurrent device connections
- [ ] Test real-time dashboard with heavy load
- [ ] Test report generation with large datasets
- [ ] Optimize slow queries
- [ ] Add database indexes where needed

### ✅ Day 37: Security Testing
- [ ] Test authentication and authorization
- [ ] Test API security (SQL injection, XSS)
- [ ] Test biometric data encryption
- [ ] Test role-based access control
- [ ] Implement rate limiting
- [ ] Add audit logs for sensitive operations

### ✅ Day 38: User Acceptance Testing (UAT) Preparation
- [ ] Create test data for UAT
- [ ] Prepare UAT test cases document
- [ ] Create user testing guide
- [ ] Fix bugs found during internal testing
- [ ] Prepare demo environment

---

## 📋 PHASE 9: DEPLOYMENT (Days 39-42)

### ✅ Day 39: Deployment Preparation
- [ ] Create deployment checklist
- [ ] Prepare production database migration scripts
- [ ] Set up production environment
- [ ] Configure production devices
- [ ] Create backup and rollback plan
- [ ] Prepare deployment documentation

### ✅ Day 40: Staging Deployment
- [ ] Deploy to staging environment
- [ ] Run smoke tests
- [ ] Perform final UAT with client
- [ ] Document any issues
- [ ] Fix critical bugs
- [ ] Get client sign-off

### ✅ Day 41: Production Deployment
- [ ] Execute database migrations
- [ ] Deploy backend services
- [ ] Deploy frontend application
- [ ] Configure biometric devices
- [ ] Set up cron jobs
- [ ] Enable monitoring and logging
- [ ] Verify all services are running

### ✅ Day 42: Post-Deployment
- [ ] Conduct device installation at hospital locations
- [ ] Perform employee biometric enrollment (batch process)
- [ ] Conduct user training sessions
  - [ ] Admin training
  - [ ] HR manager training
  - [ ] End user training
- [ ] Monitor system for first 24 hours
- [ ] Address immediate issues
- [ ] Collect initial feedback

---

## 📋 PHASE 10: DOCUMENTATION & HANDOVER (Days 43-45)

### ✅ Day 43: Technical Documentation
- [ ] Write API documentation (Swagger/Postman)
- [ ] Write database schema documentation
- [ ] Write deployment guide
- [ ] Write troubleshooting guide
- [ ] Document device configuration steps
- [ ] Create system architecture diagram

### ✅ Day 44: User Documentation
- [ ] Create admin user manual
- [ ] Create HR manager user guide
- [ ] Create employee user guide
- [ ] Create quick reference guides
- [ ] Create FAQ document
- [ ] Create video tutorials (optional)

### ✅ Day 45: Handover & Support
- [ ] Conduct knowledge transfer session
- [ ] Hand over all documentation
- [ ] Set up support ticketing process
- [ ] Create maintenance schedule
- [ ] Plan for future enhancements
- [ ] Project closure meeting

---

## Database Schema (Detailed)

```sql
-- Devices Table
CREATE TABLE devices (
    device_id INT PRIMARY KEY AUTO_INCREMENT,
    device_name VARCHAR(100) NOT NULL,
    device_type ENUM('fingerprint', 'face', 'rfid') NOT NULL,
    serial_number VARCHAR(100) UNIQUE,
    ip_address VARCHAR(50),
    port INT,
    location VARCHAR(200),
    status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
    last_sync DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Biometric Templates Table
CREATE TABLE biometric_templates (
    template_id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    device_id INT NOT NULL,
    template_data TEXT, -- Encrypted biometric template
    finger_index INT, -- Which finger (1-10)
    enrollment_date DATETIME,
    last_verified DATETIME,
    quality_score INT, -- Template quality 0-100
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (device_id) REFERENCES devices(device_id)
);

-- Attendance Logs (Raw device data)
CREATE TABLE attendance_logs (
    log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL,
    employee_id INT NOT NULL,
    log_time DATETIME NOT NULL,
    log_type ENUM('check_in', 'check_out', 'unknown') DEFAULT 'unknown',
    verification_method ENUM('fingerprint', 'face', 'rfid', 'manual'),
    verification_score INT, -- Matching score
    photo_path VARCHAR(255), -- If photo captured
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    INDEX idx_employee_date (employee_id, log_time),
    INDEX idx_processed (is_processed)
);

-- Attendance Records (Processed data)
CREATE TABLE attendance_records (
    attendance_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    shift_id INT,
    check_in_time DATETIME,
    check_out_time DATETIME,
    check_in_device_id INT,
    check_out_device_id INT,
    status ENUM('present', 'absent', 'late', 'half_day', 'on_leave', 'weekly_off', 'holiday') NOT NULL,
    working_hours DECIMAL(5,2), -- Hours worked
    overtime_hours DECIMAL(5,2), -- Overtime if any
    late_by_minutes INT DEFAULT 0,
    early_departure_minutes INT DEFAULT 0,
    remarks TEXT,
    is_manual_entry BOOLEAN DEFAULT FALSE,
    approved_by INT, -- Admin who approved manual entry
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (shift_id) REFERENCES shifts(shift_id),
    FOREIGN KEY (check_in_device_id) REFERENCES devices(device_id),
    FOREIGN KEY (check_out_device_id) REFERENCES devices(device_id),
    UNIQUE KEY unique_employee_date (employee_id, attendance_date),
    INDEX idx_date_status (attendance_date, status)
);

-- Shifts Table
CREATE TABLE shifts (
    shift_id INT PRIMARY KEY AUTO_INCREMENT,
    shift_name VARCHAR(100) NOT NULL,
    shift_code VARCHAR(20) UNIQUE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_minutes INT DEFAULT 15,
    half_day_threshold_minutes INT DEFAULT 240, -- 4 hours
    min_working_hours DECIMAL(4,2) DEFAULT 8.00,
    is_night_shift BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Employee Shift Assignment
CREATE TABLE employee_shifts (
    assignment_id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    shift_id INT NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_permanent BOOLEAN DEFAULT TRUE,
    rotation_days INT, -- For rotating shifts
    assigned_by INT, -- Admin who assigned
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (shift_id) REFERENCES shifts(shift_id),
    INDEX idx_employee_date (employee_id, effective_from, effective_to)
);

-- Leave Types
CREATE TABLE leave_types (
    leave_type_id INT PRIMARY KEY AUTO_INCREMENT,
    leave_name VARCHAR(100) NOT NULL,
    leave_code VARCHAR(20) UNIQUE,
    max_days_per_year INT,
    is_paid BOOLEAN DEFAULT TRUE,
    requires_approval BOOLEAN DEFAULT TRUE,
    can_carry_forward BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Leave Applications
CREATE TABLE leave_applications (
    leave_id INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT NOT NULL,
    leave_type_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days DECIMAL(3,1), -- 0.5 for half day
    reason TEXT,
    attachment_path VARCHAR(255),
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    applied_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INT, -- Manager who reviewed
    reviewed_date DATETIME,
    review_comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(leave_type_id),
    INDEX idx_employee_status (employee_id, status),
    INDEX idx_dates (start_date, end_date)
);

-- Holidays Table
CREATE TABLE holidays (
    holiday_id INT PRIMARY KEY AUTO_INCREMENT,
    holiday_name VARCHAR(100) NOT NULL,
    holiday_date DATE NOT NULL,
    holiday_type ENUM('public', 'restricted', 'optional'),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_date (holiday_date)
);

-- Attendance Settings
CREATE TABLE attendance_settings (
    setting_id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50), -- number, boolean, string, json
    description TEXT,
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Device Logs (for monitoring)
CREATE TABLE device_logs (
    log_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    device_id INT NOT NULL,
    log_type ENUM('info', 'warning', 'error', 'sync'),
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices(device_id),
    INDEX idx_device_time (device_id, created_at)
);
```

---

## API Endpoints Reference

### Biometric Management
```
POST   /api/v1/biometric/enroll
GET    /api/v1/biometric/status/:employeeId
DELETE /api/v1/biometric/remove/:employeeId
POST   /api/v1/biometric/re-enroll
GET    /api/v1/biometric/templates/:employeeId
```

### Attendance
```
POST   /api/v1/attendance/mark (manual)
GET    /api/v1/attendance/live
GET    /api/v1/attendance/employee/:id?from=&to=
GET    /api/v1/attendance/date/:date
GET    /api/v1/attendance/department/:id?from=&to=
PUT    /api/v1/attendance/correct/:attendanceId
POST   /api/v1/attendance/bulk-upload
```

### Shifts
```
POST   /api/v1/shifts
GET    /api/v1/shifts
GET    /api/v1/shifts/:id
PUT    /api/v1/shifts/:id
DELETE /api/v1/shifts/:id
POST   /api/v1/shifts/assign
GET    /api/v1/shifts/employee/:id
GET    /api/v1/shifts/roster/:departmentId
```

### Leaves
```
POST   /api/v1/leaves/apply
GET    /api/v1/leaves/employee/:id
GET    /api/v1/leaves/pending
PUT    /api/v1/leaves/:id/approve
PUT    /api/v1/leaves/:id/reject
DELETE /api/v1/leaves/:id/cancel
GET    /api/v1/leaves/balance/:employeeId
GET    /api/v1/leaves/types
```

### Reports
```
GET    /api/v1/reports/daily/:date
GET    /api/v1/reports/monthly/:year/:month
GET    /api/v1/reports/employee/:id/:year/:month
GET    /api/v1/reports/department/:id?from=&to=
GET    /api/v1/reports/late?from=&to=
GET    /api/v1/reports/overtime?from=&to=
POST   /api/v1/reports/custom
GET    /api/v1/reports/export/:reportId?format=excel|pdf
```

### Devices
```
POST   /api/v1/devices/register
GET    /api/v1/devices
GET    /api/v1/devices/:id
PUT    /api/v1/devices/:id
DELETE /api/v1/devices/:id
GET    /api/v1/devices/:id/status
POST   /api/v1/devices/:id/sync
GET    /api/v1/devices/:id/logs
```

### Settings
```
GET    /api/v1/settings
PUT    /api/v1/settings
POST   /api/v1/settings/holidays
GET    /api/v1/settings/holidays/:year
DELETE /api/v1/settings/holidays/:id
```

---

## Technical Specifications

### Device Communication
- **Protocol**: TCP/IP or HTTP REST API (device dependent)
- **Data Format**: JSON or device-specific format
- **Sync Frequency**: Every 5 minutes or real-time push
- **Offline Storage**: Device stores up to 100,000 logs locally
- **Security**: TLS encryption for data transmission

### Performance Requirements
- Support 1000+ concurrent employees
- Attendance marking response time < 2 seconds
- Report generation time < 5 seconds for monthly reports
- Dashboard real-time updates every 30 seconds
- Support 10+ devices simultaneously

### Security Requirements
- Biometric templates must be encrypted (AES-256)
- Role-based access control (RBAC)
- Audit logs for all critical operations
- Two-factor authentication for admin access
- API rate limiting (100 requests/minute per user)
- Session timeout after 30 minutes of inactivity

---

## Environment Variables Required

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=hospital_management
DB_USER=your_user
DB_PASSWORD=your_password

# Biometric Device SDK
DEVICE_SDK_PATH=/path/to/sdk
DEVICE_API_KEY=your_device_api_key
DEVICE_SYNC_INTERVAL=300000 # 5 minutes in ms

# Application
APP_PORT=3000
APP_ENV=development
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_password

# File Upload
UPLOAD_PATH=/uploads/attendance
MAX_FILE_SIZE=5242880 # 5MB

# Reporting
REPORT_CACHE_TTL=3600 # 1 hour
REPORT_EXPORT_PATH=/exports/reports
```

---

## Testing Checklist

### Functional Testing
- [ ] Employee can be enrolled successfully
- [ ] Attendance is marked correctly via device
- [ ] Manual attendance marking works
- [ ] Shift assignment works correctly
- [ ] Leave application and approval flow works
- [ ] Reports are generated accurately
- [ ] Grace period logic works correctly
- [ ] Overtime calculation is accurate
- [ ] Half-day marking works correctly
- [ ] Auto-absent marking works at day end

### Edge Cases
- [ ] Multiple check-ins on same day
- [ ] Check-in without check-out
- [ ] Check-out without check-in
- [ ] Attendance on weekly off
- [ ] Attendance on public holiday
- [ ] Leave and attendance on same day
- [ ] Shift change mid-month
- [ ] Device time sync issues
- [ ] Duplicate fingerprint enrollment
- [ ] Network disconnection during sync

### Performance Testing
- [ ] Load test with 1000+ employees
- [ ] Concurrent device operations
- [ ] Large report generation
- [ ] Database query optimization
- [ ] Memory leak testing

---

## Deliverables

1. ✅ Complete source code with version control
2. ✅ Database migration scripts
3. ✅ API documentation (Swagger/Postman)
4. ✅ User manuals (Admin, HR, Employee)
5. ✅ Technical documentation
6. ✅ Deployment guide
7. ✅ Test cases and results
8. ✅ Training materials
9. ✅ Device configuration guide
10. ✅ Support and maintenance plan

---

## Support & Maintenance

### Post-Deployment Support (30 days)
- Bug fixing (critical bugs within 4 hours, others within 24 hours)
- User support and training
- Performance monitoring
- Device troubleshooting

### Maintenance Plan
- Regular database backups (daily)
- Device health monitoring
- Log rotation and cleanup
- Security patches and updates
- Monthly performance reports

---

## Success Criteria

- [ ] 100% employees successfully enrolled
- [ ] 99%+ attendance marking accuracy
- [ ] All devices connected and synchronized
- [ ] Reports generated within 5 seconds
- [ ] Zero critical bugs post-deployment
- [ ] User satisfaction score > 4/5
- [ ] System uptime > 99.5%

---

## Timeline Summary

- **Total Duration**: 45 working days (9 weeks)
- **Phase 1-2 (Planning & DB)**: 5 days
- **Phase 3 (Device Integration)**: 5 days
- **Phase 4 (Backend APIs)**: 7 days
- **Phase 5 (Reports)**: 3 days
- **Phase 6 (Frontend)**: 10 days
- **Phase 7 (Integration)**: 3 days
- **Phase 8 (Testing)**: 5 days
- **Phase 9 (Deployment)**: 4 days
- **Phase 10 (Documentation)**: 3 days

---

## Important Notes for Developer

1. **Daily Standup**: Report progress daily with completed tasks and blockers
2. **Code Review**: Submit code for review at end of each phase
3. **Git Workflow**: Create feature branches, never commit to main directly
4. **Documentation**: Document code with comments and maintain README
5. **Testing**: Write tests alongside features, not at the end
6. **Security**: Never hardcode credentials, always use environment variables
7. **Performance**: Optimize queries, use indexes, implement caching
8. **Error Handling**: Implement proper try-catch and user-friendly error messages
9. **Logging**: Log all critical operations and errors
10. **Backup**: Take database backups before migrations

---

## Questions to Clarify Before Starting

1. Which biometric device model will be used? (Need SDK documentation)
2. How many devices will be installed initially?
3. What is the current tech stack? (Need exact versions)
4. How many employees will use this system?
5. Do we have access to staging/testing environment?
6. Who will perform UAT from client side?
7. What is the expected go-live date?
8. Are there any existing attendance rules/policies to follow?
9. Integration requirements with payroll system?
10. Any specific compliance or regulatory requirements?

---

## Contact & Escalation

- **Project Manager**: [Name & Email]
- **Technical Lead**: [Name & Email]
- **Client Contact**: [Name & Email]
- **Daily Standup**: [Time & Platform]
- **Emergency Contact**: [Phone Number]

---

**Good Luck! Let's build an amazing attendance system! 🚀**

---

## Revision History
- Version 1.0 - Initial Brief - [Date]
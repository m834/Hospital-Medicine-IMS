# Attendance Module - Implementation Quick Start Guide

**Last Updated:** February 17, 2026  
**Status:** Ready for Development  
**Estimated Timeline:** 7 weeks (Feb 17 - Apr 6, 2026)

---

## 📌 QUICK REFERENCE

### What You're Building
A **comprehensive Attendance & Staff Scheduling Module** integrating:
- ✅ **Biometric Device Integration** - Fingerprint/Face/RFID enrollment & real-time sync
- ✅ **Attendance Tracking** - Check-in/out, device logs, daily records, status calculation
- ✅ **Shift Management** - Create shifts, assign to employees, handle rotation
- ✅ **Leave Management** - Apply, approve/reject, balance tracking
- ✅ **Real-Time Dashboard** - Live attendance, WebSocket updates, analytics
- ✅ **Reporting** - Daily/monthly reports, late arrivals, custom exports
- ✅ **Multi-Tenant** - Separate data per hospital, device per location

### Architecture
```
EXISTING SYSTEM (Monolithic)       → ATTENDANCE MODULE (Phase 3)
├── NestJS Backend                 ├── BiometricDevice Service
├── PostgreSQL Database            ├── Attendance Processing Service
├── JWT Auth                       ├── Shift Management Service
├── RBAC Permissions               ├── Leave Management Service
├── Feature Flags                  ├── Device Sync Service
└── Next.js Frontend               └── WebSocket Real-Time Updates
```

---

## 🚀 IMPLEMENTATION PHASES

### PHASE 1: Database & Core APIs (Week 1-2)

**SETUP (Day 1: Feb 17)**
```bash
# Create feature branch
git checkout -b feature/attendance-module

# Create migration file
npx prisma migrate create --name add_attendance_module

# Copy schema from ATTENDANCE_DATABASE_MIGRATION_GUIDE.md
# into /prisma/schema.prisma
```

**DATABASE (Day 2-3: Feb 18-19)**
- [ ] Add 12 Prisma models to schema.prisma
- [ ] Add 8 enums for attendance statuses
- [ ] Update Hospital & User models with new relations
- [ ] Run migration: `npx prisma migrate dev`
- [ ] Verify all tables created in PostgreSQL

**SEED DATA (Day 4: Feb 20)**
```bash
# Create: /backend/prisma/seeds/seed-attendance.ts
# Seed:
# - 3 shifts (Day, Night, Flexible)
# - 6 leave types (Casual, Sick, Earned, etc.)
# - 10 holidays for current year

npx prisma db seed
```

**CORE APIs (Day 5-10: Feb 21-26)**

Create 5 NestJS modules:

```typescript
// 1. src/modules/attendance/biometric-devices/
POST   /api/v1/attendance/devices                 // Register device
GET    /api/v1/attendance/devices                 // List devices
PUT    /api/v1/attendance/devices/:id             // Update device
GET    /api/v1/attendance/devices/:id/status      // Device status
POST   /api/v1/attendance/devices/:id/sync        // Manual sync

// 2. src/modules/attendance/biometric-enrollments/
POST   /api/v1/attendance/enrollments             // Start enrollment
GET    /api/v1/attendance/enrollments/:userId     // Check status
POST   /api/v1/attendance/enrollments/:userId/enroll
DELETE /api/v1/attendance/enrollments/:userId     // Revoke

// 3. src/modules/attendance/attendance-records/
GET    /api/v1/attendance/records                 // List records
GET    /api/v1/attendance/records/:userId         // Employee history
POST   /api/v1/attendance/records/mark            // Manual mark
PUT    /api/v1/attendance/records/:id/correct     // Correct record

// 4. src/modules/attendance/shifts/
POST   /api/v1/attendance/shifts                  // Create shift
GET    /api/v1/attendance/shifts                  // List shifts
POST   /api/v1/attendance/shifts/assign           // Assign to employee

// 5. src/modules/attendance/leaves/
POST   /api/v1/attendance/leaves/apply            // Apply leave
PUT    /api/v1/attendance/leaves/:id/approve      // Approve/reject
GET    /api/v1/attendance/leaves/balance/:userId  // Balance
```

**RBAC (Day 11-12: Feb 27-28)**
- [ ] Add new roles: `ATTENDANCE_ADMIN`, `HR_MANAGER`, `BIOMETRIC_OPERATOR`
- [ ] Create 14 new permissions for attendance resources
- [ ] Map permissions to roles in seed-permissions.ts
- [ ] Add `@RequirePermission` decorators to controllers
- [ ] Test with Postman

---

### PHASE 2: Device Integration & Real-Time (Week 3)

**DEVICE COMMUNICATION (Mar 3-5)**
```typescript
// src/modules/attendance/device-sync/device-client.ts
- TCP/IP connection to device
- Device handshake & authentication
- Real-time log streaming
- Offline storage & retry logic
- Device simulator for testing

// Device endpoints:
- Device discovery
- Configuration push
- Template storage
- Log pulling (buffered)
```

**ATTENDANCE PROCESSING (Mar 6-7)**
```typescript
// src/modules/attendance/services/attendance-processing.service.ts
- Read raw AttendanceLog records
- Check grace period
- Calculate status (PRESENT, LATE, HALF_DAY, ABSENT)
- Link to employee's shift
- Check for approved leaves
- Generate AttendanceRecord

// Cron jobs:
- Every 5 minutes: Pull device logs
- Every hour: Process logs & generate records
- 11:55 PM: Mark remaining as ABSENT
```

**WEBSOCKET REAL-TIME (Mar 8-9)**
```typescript
// src/modules/attendance/websocket/attendance.gateway.ts
- Real-time check-in notifications
- Live dashboard updates
- Redis pub/sub for scalability

// Endpoints:
GET /api/v1/attendance/live/summary       // Today's counts
GET /api/v1/attendance/live/checkins      // Recent (auto-refresh)
WS  /ws/attendance/live                   // WebSocket for real-time
```

---

### PHASE 3: Frontend Development (Week 4-5)

**ENROLLMENT INTERFACE (Mar 10-12)**
```tsx
// src/components/attendance/biometric/EnrollmentWizard.tsx
Step 1: Employee verification (search, confirm)
Step 2: Device selection (dropdown list)
Step 3: Fingerprint capture (5 attempts, quality score)
Step 4: Verification (confirm template)
Step 5: Confirmation (success/failure message)

Status page: /attendance/enrollments
```

**DASHBOARDS (Mar 13-15)**
```tsx
// src/app/[role]/attendance/live/page.tsx
- Today's attendance summary cards
- Present / Absent / Late counts by department
- Recent check-ins feed (auto-updating)
- Graphical charts (Present vs Absent trend)
- Department-wise breakdown

// Auto-refresh every 30 seconds via WebSocket
// Real-time notifications for check-ins
```

**MANAGEMENT SCREENS (Mar 16-19)**
```tsx
// Attendance Records
/attendance/records              - Daily attendance table
/attendance/records/[id]         - Detail page
/attendance/corrections          - Request correction

// Shift Management
/attendance/shifts               - CRUD shifts
/attendance/shifts/assign        - Assign to employees
/attendance/shifts/roster        - Calendar view

// Leave Management
/attendance/leaves/apply         - Application form
/attendance/leaves/approvals     - Manager queue
/attendance/leaves/balance       - Balance display
/attendance/leaves/calendar      - Visual calendar

// Reports
/attendance/reports              - Report builder
/attendance/reports/daily        - Daily summary
/attendance/reports/monthly      - Monthly sheet
/attendance/reports/export       - Excel/PDF download
```

**SETTINGS (Mar 20)**
```tsx
// Admin Configuration
/attendance/settings/general     - Grace period, thresholds
/attendance/settings/holidays    - Holiday CRUD
/attendance/settings/devices     - Device list & status
/attendance/settings/config      - Other settings
```

---

### PHASE 4: Testing & Optimization (Week 6)

**UNIT TESTING (Mar 24-25)**
```bash
# Target: >80% coverage

Services to test:
- AttendanceProcessingService (grace period, status logic)
- ShiftAssignmentService (rotation logic)
- LeaveBalanceService (leave calculation)
- DeviceSyncService (duplicate detection)

# Run: npm test -- --coverage
```

**INTEGRATION TESTING (Mar 26-27)**
```bash
# End-to-end flows:
1. Enroll employee → Capture fingerprint → Verify
2. Check-in device → Log created → Record processed → Status calculated
3. Apply leave → Manager approval → Auto-mark as ON_LEAVE
4. Generate report → Filter/export → Download Excel/PDF

# Test with device simulator
# Test offline scenarios
```

**PERFORMANCE & LOAD (Mar 28-30)**
```bash
# K6 load testing:
- 100 concurrent employees
- 50 simultaneous device syncs
- Real-time dashboard with 1000 users
- Report generation with 30 days of data

# Target:
- API response time < 200ms
- Concurrent users > 1000
- Device sync success rate > 99%
```

---

### PHASE 5: Deployment & Documentation (Week 7)

**DOCKER & DEPLOYMENT (Mar 31 - Apr 2)**
```bash
# Update Docker Compose
# Add attendance module services
# Database backup & recovery testing
# Migration scripts for production
# Environment variables setup
```

**DOCUMENTATION (Apr 3-4)**
- [ ] API documentation (Swagger + examples)
- [ ] Database schema guide
- [ ] Admin configuration guide
- [ ] Employee user manual
- [ ] Device setup & troubleshooting
- [ ] Architecture diagrams

**DEPLOYMENT (Apr 5-6)**
- [ ] Staging deployment & testing
- [ ] Production database migration
- [ ] Data validation
- [ ] Live monitoring setup
- [ ] Rollback procedure

---

## 📊 FILE STRUCTURE TO CREATE

```
mims/backend/src/modules/attendance/
├── attendance.module.ts                     # Module declaration
├── biometric-devices/
│   ├── devices.controller.ts               # REST endpoints
│   ├── devices.service.ts                  # Business logic
│   ├── dto/
│   │   ├── create-device.dto.ts
│   │   ├── update-device.dto.ts
│   │   └── device-sync.dto.ts
│   ├── entities/
│   │   └── device.entity.ts
│   └── devices.spec.ts                     # Unit tests
├── biometric-enrollments/
│   ├── enrollments.controller.ts
│   ├── enrollments.service.ts
│   ├── dto/
│   │   ├── start-enrollment.dto.ts
│   │   └── verify-enrollment.dto.ts
│   └── entities/
│       └── enrollment.entity.ts
├── attendance-records/
│   ├── attendance.controller.ts
│   ├── attendance.service.ts
│   ├── services/
│   │   ├── attendance-calculation.service.ts    # Core logic
│   │   ├── attendance-processing.service.ts     # Queue processor
│   │   └── leave-integration.service.ts         # Leave checking
│   ├── dto/
│   │   ├── mark-attendance.dto.ts
│   │   └── correct-attendance.dto.ts
│   └── entities/
│       └── attendance-record.entity.ts
├── shifts/
│   ├── shifts.controller.ts
│   ├── shifts.service.ts
│   ├── dto/
│   │   ├── create-shift.dto.ts
│   │   └── assign-shift.dto.ts
│   └── entities/
│       └── shift.entity.ts
├── leaves/
│   ├── leaves.controller.ts
│   ├── leaves.service.ts
│   ├── services/
│   │   ├── leave-balance.service.ts        # Balance calculation
│   │   └── leave-approval.service.ts       # Approval workflow
│   ├── dto/
│   │   ├── apply-leave.dto.ts
│   │   └── approve-leave.dto.ts
│   └── entities/
│       └── leave.entity.ts
├── device-sync/
│   ├── device-sync.service.ts              # Orchestration
│   ├── device-client.ts                    # TCP/IP communication
│   ├── device-simulator.ts                 # Testing simulator
│   └── device-sync-processor.ts            # Queue worker
├── websocket/
│   ├── attendance.gateway.ts               # WebSocket server
│   └── attendance.namespace.ts             # Socket.io namespace
├── reports/
│   ├── reports.controller.ts
│   ├── reports.service.ts
│   ├── generators/
│   │   ├── daily-report.generator.ts
│   │   ├── monthly-report.generator.ts
│   │   └── custom-report.generator.ts
│   ├── exporters/
│   │   ├── excel.exporter.ts
│   │   └── pdf.exporter.ts
│   └── dto/
│       └── generate-report.dto.ts
├── guards/
│   └── device-authentication.guard.ts
├── decorators/
│   └── device-key.decorator.ts
├── utils/
│   ├── attendance-calculator.ts            # Calculation utilities
│   ├── time-helpers.ts                     # Time utilities
│   └── validators.ts                       # Custom validators
└── __tests__/
    ├── attendance.integration.spec.ts
    ├── shift.unit.spec.ts
    ├── leave.unit.spec.ts
    └── device-sync.integration.spec.ts

frontend/src/
├── components/attendance/
│   ├── biometric/
│   │   ├── EnrollmentWizard.tsx
│   │   ├── EnrollmentStatus.tsx
│   │   └── DeviceSelector.tsx
│   ├── dashboard/
│   │   ├── LiveDashboard.tsx
│   │   ├── CheckInsList.tsx
│   │   ├── DepartmentSummary.tsx
│   │   └── AttendanceChart.tsx
│   ├── attendance/
│   │   ├── AttendanceTable.tsx
│   │   ├── ManualMarkingForm.tsx
│   │   ├── AttendanceCorrection.tsx
│   │   └── AttendanceHistory.tsx
│   ├── shift/
│   │   ├── ShiftMaster.tsx
│   │   ├── ShiftAssignment.tsx
│   │   └── ShiftRoster.tsx
│   ├── leave/
│   │   ├── LeaveApplication.tsx
│   │   ├── LeaveApprovalQueue.tsx
│   │   ├── LeaveHistory.tsx
│   │   ├── LeaveBalance.tsx
│   │   └── LeaveCalendar.tsx
│   ├── reports/
│   │   ├── ReportBuilder.tsx
│   │   ├── DailyReport.tsx
│   │   ├── MonthlySheet.tsx
│   │   └── ReportExport.tsx
│   └── settings/
│       ├── AttendanceConfig.tsx
│       ├── HolidayManagement.tsx
│       └── DeviceManagement.tsx
├── hooks/
│   ├── useAttendance.ts
│   ├── useShifts.ts
│   ├── useLeaves.ts
│   ├── useLiveUpdates.ts         # WebSocket hook
│   └── useAttendanceReports.ts
├── stores/
│   └── attendanceStore.ts        # Zustand store for state
├── types/
│   ├── attendance.ts
│   ├── shift.ts
│   ├── leave.ts
│   └── device.ts
└── api/
    └── attendance/
        ├── devices.ts
        ├── enrollments.ts
        ├── records.ts
        ├── shifts.ts
        ├── leaves.ts
        └── reports.ts
```

---

## 🔑 KEY DECISIONS TO VALIDATE

Before starting, confirm with team/stakeholder:

### 1. Biometric Device
- [ ] Device model selected? (ZKTeco, eSSL, Suprema)
- [ ] SDK license obtained?
- [ ] Number of devices? (1-5 for pilot)
- [ ] Device locations? (Gate, Ward, Lab)

### 2. Scope & Timeline
- [ ] Go-live date confirmed?
- [ ] Initial pilot scope (single hospital/department)?
- [ ] Number of employees in scope?
- [ ] Test/staging environment available?

### 3. Integration Requirements
- [ ] Payroll integration needed? (Out of scope currently)
- [ ] Leave approval chain defined?
- [ ] Notification preferences? (SMS, Email, In-app)
- [ ] Multi-location support?

### 4. Data & Compliance
- [ ] Biometric data encryption key management?
- [ ] Data retention policy (7 years audit)?
- [ ] GDPR/compliance requirements?
- [ ] Existing employee data migration?

---

## ✅ SUCCESS CRITERIA

**Before Go-Live, Verify:**

```
FUNCTIONALITY
✅ 100% of employees can be enrolled
✅ 99%+ attendance accuracy
✅ All reports generated correctly
✅ Leave approvals working end-to-end
✅ Device sync > 99% success rate
✅ Zero manual interventions in normal flow

PERFORMANCE
✅ API response time < 200ms (95th percentile)
✅ Live dashboard updates < 5 seconds
✅ Report generation < 10 seconds
✅ Support 1000+ concurrent users
✅ Handle 50+ simultaneous device connections

CODE QUALITY
✅ Test coverage > 80%
✅ Zero critical security issues
✅ All API endpoints documented
✅ Code review approved
✅ Staging deployment successful

USER EXPERIENCE
✅ Employees can view own attendance
✅ Managers can approve leaves
✅ Admins can manage devices
✅ Reports easily accessible
✅ Clear error messages
```

---

## 📚 DOCUMENTATION REQUIRED

Create these before go-live:

```
1. API Documentation
   - Swagger/OpenAPI spec
   - cURL examples
   - Common workflows

2. Database Guide
   - Schema diagram
   - Table relationships
   - Query optimization tips

3. Admin Manual
   - Device setup & configuration
   - User/role management
   - Attendance settings (grace period, etc.)
   - Troubleshooting

4. Employee Guide
   - How to view attendance
   - How to apply leave
   - FAQ

5. Technical Documentation
   - Architecture overview
   - Module descriptions
   - Deployment procedures
   - Backup & recovery
   - Rollback plan

6. Video Tutorials (Optional)
   - Device enrollment
   - Dashboard walkthrough
   - Leave application process
```

---

## 🆘 COMMON ISSUES & SOLUTIONS

| Issue | Solution |
|-------|----------|
| Device connection timeout | Check IP/port, verify firewall, test with simulator |
| Duplicate attendance logs | Enable idempotency checking, implement deduplication |
| Shift calculation errors | Verify shift times in HH:MM format, check timezone |
| Leave balance incorrect | Verify leave type config, check carried-forward settings |
| Real-time updates lag | Increase WebSocket pool size, check Redis connection |
| Device offline unexpectedly | Implement heart-beat monitoring, auto-reconnect logic |

---

## 📞 IMMEDIATE NEXT STEPS

### This Week (Feb 17-21)
- [ ] Schedule architecture review meeting
- [ ] Confirm biometric device model
- [ ] Set up development environment
- [ ] Create feature branch
- [ ] Review this analysis document

### Next Week (Feb 24-28)
- [ ] Complete database schema
- [ ] Run first migration
- [ ] Create seed data
- [ ] Start API implementation

### Week After (Mar 3-7)
- [ ] Device communication implementation
- [ ] Real-time WebSocket setup
- [ ] Background job processing
- [ ] Initial testing

---

## 📎 USEFUL COMMANDS

```bash
# Start development
npm run start:dev

# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_attendance_module

# View database
npx prisma studio

# Run tests
npm test -- --watch

# Format code
npm run format

# Lint
npm run lint

# Build
npm run build

# Start production
npm run start:prod

# Docker commands
docker-compose up -d
docker-compose logs -f
docker-compose down
```

---

**Ready to build? Let's go! 🚀**

For detailed information, see:
- `ATTENDANCE_MODULE_IMPLEMENTATION_ANALYSIS.md` - Full analysis
- `ATTENDANCE_DATABASE_MIGRATION_GUIDE.md` - Database setup
- `PHASE_2_CLINICAL_SERVICES_TODO.md` - Related work

---

**Generated:** February 17, 2026  
**Status:** Approved for Development  
**Next Review:** Upon completion of Phase 1

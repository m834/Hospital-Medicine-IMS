# Case Study: M-IMS — Hospital Information Management System (HIMS)

**Document Type:** Technical Case Study  
**Date:** May 2026  
**Project:** M-IMS (Hospital Information Management System)  
**Phase:** Phase 1 — Inventory & Patient Issuance (Production)

---

## 1. Executive Summary

M-IMS is a full-stack, multi-tenant Hospital Medicine Inventory Management System built to digitize and automate the entire medicine supply chain within hospital networks. The system spans patient registration, e-prescription creation, FIFO-based medicine issuance, inter-pharmacy stock transfers, attendance tracking, payroll, lab orders, and analytics — all within a single unified platform.

The platform supports hospitals in Pakistan with multiple facilities, multiple pharmacies per hospital, and a staff hierarchy ranging from Super Admin to bedside nurses. It is built to function both online and offline, making it viable for remote or infrastructure-limited settings.

---

## 2. Problem Statement

### 2.1 Background

Large hospital networks managing medicine inventory manually face significant operational challenges:

- **Stock wastage** due to expired medicines not identified in time
- **Stock-outs** at ward pharmacies while the main pharmacy holds surplus
- **Paper-based prescriptions** leading to errors, loss, and delays
- **No audit trail** for medicine issuance, returns, or transfers
- **Disconnected systems** — lab, pharmacy, billing, and patient records in silos
- **Inability to operate** during internet outages at remote pharmacy terminals

### 2.2 Key Pain Points Addressed

| Pain Point | Solution |
|---|---|
| Manual FIFO not enforced | Automated FIFO batch allocation with expiry-first sorting |
| No inter-pharmacy visibility | Centralized transfer request and approval workflow |
| Paper prescriptions | Doctor-created e-prescriptions linked to patient R-Numbers |
| Stock reconciliation errors | Atomic stock operations with full audit logs |
| Offline pharmacy operations | SQLite-based local sync with conflict resolution |
| Role sprawl and access leakage | 14 roles × 60+ fine-grained permissions |
| Login taking 5–6 seconds | Redis caching reducing login to < 500ms |

---

## 3. Solution Architecture

### 3.1 Architectural Pattern

The system uses a **hybrid monolith** architecture: a single NestJS backend application that houses all feature modules with clear separation of concerns. Clinical and billing modules were added inside the monolith to avoid disrupting the production pharmacy core, with selective microservice extraction planned for Phase 4+.

```
Client (Browser / PWA)
         │
    [Next.js 14 Frontend]
         │
    [Nginx Reverse Proxy]
         │
    [NestJS Backend API]
         │
  ┌──────┴──────┐
  │             │
[PostgreSQL] [Redis]
  │
[SQLite - Offline Sync]
```

### 3.2 Multi-Tenancy Design

- **Single database** with `hospital_id` column on every table
- **Row-Level Security (RLS)** policies in PostgreSQL for tenant isolation
- **JWT tokens** carry `hospital_id` claim; middleware validates on every request
- **Super Admin** can switch hospital context via a special token claim without re-authentication

### 3.3 Database Scale

The Prisma schema contains **60 domain models** covering:

| Domain | Models |
|---|---|
| Core Hospital | Hospital, Department, SubDepartment, Room, Bed, Admission |
| Users & Auth | User, Permission, RolePermission, Token, FeatureFlag |
| Patients | Patient, Visit, Clinic, Referral |
| Pharmacy | Pharmacy, Medicine, MedicineAlternative, StockBatch |
| Procurement | PurchaseOrder, PurchaseOrderItem, GRN, GRNItem |
| Prescriptions | Prescription, PrescriptionItem, PrescriptionMedicine, PrescriptionDispatch, PrescriptionDispatchItem |
| Issuance | IssueTransaction, IssueItem, ReturnTransaction, ReturnItem |
| Transfers | TransferRequest, TransferItem, TransferBatchMapping |
| Operations | OperationTheatre, Operation |
| Lab | LabTest, LabOrder |
| Billing | Receipt, DailyCharge, Expenditure |
| Attendance | AttendanceLog, AttendanceRecord, Shift, EmployeeShift, Leave, LeaveType, Holiday, BiometricDevice, BiometricEnrollment, AttendanceConfig, DeviceSyncLog |
| Payroll | PayrollSetting, PayrollRecord |
| System | AuditLog, SyncOperation, SystemConfig, Alert, ThreatAlert |

---

## 4. Technology Stack

### 4.1 Backend

| Technology | Purpose |
|---|---|
| **NestJS** (Node.js + TypeScript) | Core API framework with modular architecture |
| **Prisma ORM** | Type-safe database access, migrations, seeding |
| **PostgreSQL 15+** | Primary relational database |
| **Redis** | Session caching, JWT user caching (2-min TTL), rate limiting |
| **Bull MQ** | Background job queues (stock redistribution, alerts) |
| **Passport.js** | JWT + TOTP MFA authentication |
| **Argon2** | Password hashing |
| **Winston** | Structured application logging |
| **Helmet** | HTTP security headers |

### 4.2 Frontend

| Technology | Purpose |
|---|---|
| **Next.js 14+** (App Router) | React framework with SSR and route groups |
| **TypeScript** | Type safety across all components |
| **Tailwind CSS** | Utility-first responsive styling |
| **shadcn-ui** | Accessible component library |
| **React Query** | Server state management, caching, background refetch |
| **Zustand** | Client-side state (auth, hospital context) |
| **React Hook Form + Zod** | Form management with schema validation |
| **Recharts** | Dashboard visualizations and analytics charts |

### 4.3 Infrastructure

| Technology | Purpose |
|---|---|
| **Docker + Docker Compose** | Containerized local and server deployment |
| **Nginx** | Reverse proxy, load balancing, SSL termination |
| **Prometheus + Grafana** | Metrics collection and dashboard monitoring |
| **MinIO / AWS S3** | File storage for reports and prescription images |
| **SQLite** | Local database for offline pharmacy terminals |
| **GitHub Actions** | CI/CD pipeline |

---

## 5. Feature Modules

### 5.1 Patient Management
- Unique **R-Number** generation per patient (format: `R-YYYYMMDD-XXXX`)
- Patient demographics with AES-256 encrypted CNIC
- Ward/bed assignment and admission tracking
- OPD and indoor visit management
- Doctor referral and consultation queue

### 5.2 E-Prescription Management
- Doctor creates prescription linked to patient R-Number
- Prescription statuses: `ACTIVE` → `COMPLETED`
- Prescription items with dosage, frequency, and duration
- Dispatch tracking with `PrescriptionDispatch` and `PrescriptionDispatchItem` models
- Pharmacy queue view for pending dispensing

### 5.3 FIFO Medicine Issuance
- Batch-based inventory with expiry date tracking
- **Automatic FIFO allocation**: batches sorted by `received_date ASC, expiry_date ASC`
- **Atomic stock operations** with transaction locks to prevent race conditions
- Manual batch override with full audit trail
- Out-of-stock detection with alternative medicine suggestions
- Return transactions with stock reconciliation

### 5.4 Inter-Pharmacy Stock Transfers
- Sub-pharmacy initiates a transfer request against main or peer pharmacy
- Main Pharmacy Manager reviews pending requests with real-time stock visibility
- On approval: dispatch order created with `TransferBatchMapping` for batch-level traceability
- Receiving pharmacy confirms receipt; both inventories updated atomically
- Batch category (`NORMAL` / `LP`) propagated through full transfer chain

### 5.5 Procurement (PO/GRN)
- Purchase Order creation with line items
- Goods Receipt Note (GRN) matching against PO
- Batch details captured on receipt: batch number, expiry, manufacturer, storage type, cost price
- Low-stock alerts auto-generated post-GRN if thresholds not met

### 5.6 Analytics & Reporting
- Role-specific dashboards with real-time KPIs
- Daily consumption reports, batch expiry reports, patient-wise issuance history
- Inter-pharmacy transfer summaries
- Excel export with batch category filtering
- Super Admin system-wide view vs hospital-scoped views

### 5.7 Lab Orders
- Lab test catalog with LabTest model
- LabOrder linked to patient visit
- Technician result entry and report generation

### 5.8 Attendance & HR
- Biometric device integration (BiometricDevice, BiometricEnrollment)
- Shift management with EmployeeShift scheduling
- Leave management with approval workflows
- Holiday calendar
- Attendance configuration (grace periods, overtime rules)
- Device sync logging for offline biometric terminals

### 5.9 Payroll
- PayrollSetting per employee with salary structure
- PayrollRecord generation based on attendance
- Integration with leave deductions and overtime

### 5.10 Offline Sync
- Local SQLite instance for pharmacy-specific data subset
- **Event sourcing** pattern: all local operations logged as `SyncOperation` records
- Conflict resolution: Last-Write-Wins with timestamp + version number
- Manual conflict resolution UI for critical discrepancies
- Incremental delta sync on reconnect; full sync via bulk upload button

---

## 6. Role-Based Access Control (RBAC)

### 6.1 Role Hierarchy

The system implements **14 distinct roles** with **60+ fine-grained permissions**:

| Role | Permission Count | Primary Access |
|---|---|---|
| SUPER_ADMIN | 49 | Full system — all hospitals |
| HOSPITAL_ADMIN | 31 | Hospital-wide administration |
| MAIN_PHARMACY_MANAGER | 19 | Main pharmacy + transfer approvals |
| SUB_PHARMACY_MANAGER | 12 | Own pharmacy only |
| DOCTOR | 9 | Prescriptions + patient records |
| NURSE | 7 | Patient care, medication info |
| LAB_TECHNICIAN | 4 | Lab orders, sample collection, results |
| RADIOLOGIST | 4 | Radiology orders and reports |
| BILLING_STAFF | 4 | Billing, payments, invoices |
| RECEPTIONIST | 2 | Patient registration only |
| DOCTOR_ASSISTANT | — | Assist doctor workflows |
| AUDITOR | — | Read-only audit access |
| PHARMACY_STAFF | — | Medicine issuance |
| REGISTRATION_STAFF | — | Patient registration |

### 6.2 Permission Model

Each permission uses a three-component structure:

```
resource : action : scope
medicines : read   : all
inventory : write  : own_pharmacy
transfers : approve: all
prescriptions : write : own
```

Permissions are stored in the `Permission` table, assigned to roles via `RolePermission`, and cached in Redis with a 2-minute TTL for performance.

### 6.3 Role-Specific Dashboards

Each role renders a distinct dashboard on login:
- **Super Admin**: System-wide KPIs, hospital selector, threat alerts
- **Hospital Admin**: Hospital metrics, user management, feature flags
- **Main Pharmacy**: Pending transfers, low-stock alerts, issuance queue
- **Doctor**: Patient queue, prescription history, OPD consult view
- **Receptionist**: Patient registration form, OPD check-in
- **Lab Technician**: Pending lab orders, result entry

---

## 7. Security Architecture

| Measure | Implementation |
|---|---|
| Password hashing | Argon2 (industry best practice over bcrypt) |
| PII encryption | AES-256 for CNIC and sensitive fields at rest |
| Transport security | TLS 1.3 for all data in transit |
| MFA | TOTP-based for SUPER_ADMIN and HOSPITAL_ADMIN roles |
| Session management | Redis-backed sessions, 30-min timeout with sliding window |
| Rate limiting | Per user and per IP via NestJS throttler |
| SQL injection | Prevented by Prisma parameterized queries |
| XSS | Content Security Policy headers via Helmet |
| Audit logging | Every write operation: who, what, when, IP, device |
| Multi-tenant isolation | Row-Level Security policies + middleware hospital_id validation |

---

## 8. Performance Optimizations

### 8.1 Key Issues Resolved

**Problem: Login taking 5–6 seconds**  
Root cause: Sequential DB calls + fetching full user object including `passwordHash` on every JWT validation.  
Solution:
- `lastLogin` update made asynchronous (saves ~200ms)
- `select` clauses fetch only required fields
- Redis caching of authenticated user (`user:auth:{id}`, 2-min TTL)
- Result: Login reduced to **< 500ms**

**Problem: 100+ DB queries per dashboard load**  
Root cause: `validate()` in JWT strategy hit database on every authenticated API call.  
Solution: Cache-first pattern — cache hit = 0 DB queries.  
Result: **90% reduction in DB load** for authenticated requests.

**Problem: Connection exhaustion under load**  
Solution: Prisma connection pool configured (`connection_limit=20`, `pool_timeout=10s`).

**Problem: Large uncompressed API responses**  
Solution: Compression middleware added; large inventory/medicine lists significantly faster.

---

## 9. Core Workflows

### 9.1 Patient Registration
```
Registration Staff → Fill Patient Form → System generates R-Number
→ Ward/Bed Assignment → Doctor Assignment → Record Saved
```

### 9.2 Prescription-to-Issuance
```
Doctor → Search Patient by R-Number → Create E-Prescription
→ Pharmacy Staff views Queue → FIFO Batch Auto-allocation
→ Manual Override (if needed) → Confirm Issuance
→ Stock Deducted Atomically → Receipt Generated
```

### 9.3 Inter-Pharmacy Transfer
```
Sub-Pharmacy Manager → Transfer Request (quantity by medicine)
→ Main Pharmacy Manager Reviews → Approves with Batch Selection
→ Dispatch Order Created → Receiving Pharmacy Confirms Receipt
→ Both Stocks Updated Atomically → Audit Log Created
```

### 9.4 Offline Operation
```
Pharmacy Terminal Goes Offline → SQLite Captures Operations
→ SyncOperation Events Logged → Terminal Reconnects
→ Incremental Delta Sync → Conflict Detection
→ LWW Auto-Resolution OR Manual Resolution UI
→ Cloud PostgreSQL Updated
```

---

## 10. Deployment

The system ships with full Docker Compose configuration for both development and production, including:

- Backend API container (NestJS)
- Frontend container (Next.js)
- PostgreSQL container
- Redis container
- Nginx reverse proxy container

Deployment guides are available for both Windows (hospital on-premise) and Linux servers. Kubernetes manifests and Terraform IaC are provided for cloud/multi-node deployments.

---

## 11. Key Technical Decisions

| Decision | Rationale |
|---|---|
| Single-database multi-tenancy | Lower cost, easier maintenance, enables cross-hospital analytics for Super Admin |
| NestJS over Express | Built-in DI, module system, decorators, and TypeScript-first aligns with enterprise scale |
| Prisma over TypeORM | Better type safety, migration UX, and query builder ergonomics |
| Next.js App Router | Nested layouts, server components, and route groups map cleanly to role-based dashboard structure |
| Zustand over Redux | Minimal boilerplate for hospital context and auth state; sufficient for this scope |
| SQLite for offline sync | Zero-config embedded DB ideal for single-terminal offline operation |
| Hybrid monolith (not microservices) | Avoids disrupting production pharmacy while adding new modules; microservice extraction deferred to Phase 4+ |
| Argon2 for passwords | Memory-hard function; more resistant to GPU brute-force than bcrypt |

---

## 12. Project Metrics

| Metric | Value |
|---|---|
| Database schema size | 2,380 lines (Prisma schema) |
| Database models | 60 domain models |
| Backend modules | 30+ NestJS feature modules |
| Frontend dashboard roles | 14 role-specific dashboard views |
| Permission count | 60+ fine-grained permissions |
| API optimization | Login: 5–6s → < 500ms |
| DB query reduction | ~90% via Redis caching |
| Deployment targets | Docker (on-premise), Kubernetes (cloud) |

---

## 13. Conclusion

M-IMS demonstrates a production-grade hospital information system built with a pragmatic, maintainable architecture. The hybrid monolith approach allowed rapid feature development across pharmacy, clinical, HR, and billing domains without sacrificing the reliability of the core pharmacy operation. The system's multi-tenant design, offline-first sync, fine-grained RBAC, and FIFO enforcement address the real operational needs of hospital networks in Pakistan — and provide a strong foundation for the microservice extraction and additional clinical modules planned in future phases.

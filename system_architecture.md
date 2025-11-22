Medicines Management System (M-IMS) - System Design Document
Phase 1: Inventory & Patient Issuance
1. Implementation Approach
1.1 Core Architecture Strategy
We will implement a multi-tenant single database architecture with tenant scoping for the following reasons:

Chosen Approach: Single Database with Tenant Isolation

Justification:

Centralized Management: Single database simplifies backup, maintenance, and upgrades
Cost Efficiency: Lower infrastructure costs compared to database-per-tenant
Cross-Hospital Analytics: Enables system-wide reporting and insights for super admins
Scalability: PostgreSQL can handle multiple hospitals with proper indexing and partitioning
Data Consistency: Easier to maintain referential integrity and enforce business rules
Resource Optimization: Better resource utilization with connection pooling
Implementation Details:

Every table includes hospital_id column (indexed)
Row-Level Security (RLS) policies in PostgreSQL enforce tenant isolation
Application-level middleware validates hospital context on every request
Partition tables by hospital_id for large tables (audit_logs, transactions)
Separate schemas for shared configuration vs tenant-specific data
Trade-offs:

✅ Pros: Easier maintenance, lower cost, centralized analytics, simpler deployment
⚠️ Cons: Requires careful query design, potential noisy neighbor issues (mitigated by resource limits)
1.2 Technology Stack
Frontend:

Next.js 14+ (App Router) with React 18+
TypeScript for type safety
Tailwind CSS for responsive design
Shadcn-ui component library
React Query for data fetching and caching
Zustand for client-side state management
React Hook Form + Zod for form validation
Recharts for dashboard visualizations
PWA support for offline capability
Backend:

NestJS (Node.js + TypeScript)
Prisma ORM for database access
Passport.js for authentication (JWT + MFA)
Bull MQ for job queues
Winston for logging
Helmet for security headers
Class-validator for DTO validation
Swagger/OpenAPI for API documentation
Database:

PostgreSQL 15+ (primary database)
Redis for caching and session storage
SQLite for offline local instances
File Storage:

MinIO (S3-compatible) for on-premise
AWS S3 for cloud deployment
Support for prescription images, reports, backups
Infrastructure:

Docker & Docker Compose for containerization
Nginx as reverse proxy and load balancer
PM2 for Node.js process management
Prometheus + Grafana for monitoring
ELK Stack (optional) for log aggregation
DevOps:

GitHub Actions for CI/CD
Jest for unit testing
Playwright for E2E testing
K6 for load testing
1.3 Critical Requirements & Solutions
1.3.1 FIFO Stock Allocation

Implement batch allocation algorithm that sorts by received_date ASC, expiry_date ASC
Lock batches during transaction to prevent race conditions
Maintain qty_available field updated atomically
Support manual override with audit logging
1.3.2 Automated Stock Redistribution

Background job runs every hour to analyze stock levels
Algorithm considers: current stock, consumption rate, lead time, safety stock
Generates suggested transfers with confidence scores
Auto-trigger mode (configurable) creates approved transfer requests
Main Pharmacy Manager can review and approve/reject suggestions
1.3.3 Offline Sync Architecture

Local instance runs SQLite with subset of data (pharmacy-specific)
Sync service uses event sourcing pattern with operation logs
Conflict resolution: Last-Write-Wins with timestamp + version number
Manual conflict resolution UI for critical conflicts
Incremental sync with delta updates
Bulk upload button triggers full sync to cloud
1.3.4 Multi-Hospital Tenancy

Hospital context injected via JWT token (hospital_id claim)
Middleware validates hospital access on every request
Database queries automatically filtered by hospital_id
Super Admin can switch hospital context via special token claim
1.3.5 Security & Compliance

AES-256 encryption for CNIC and sensitive PII at rest
TLS 1.3 for data in transit
Argon2 for password hashing
TOTP-based MFA for privileged roles
Comprehensive audit logging (who, what, when, IP, device)
Session management with Redis (30-min timeout, sliding window)
Rate limiting per user and IP
SQL injection prevention via parameterized queries (Prisma)
XSS protection via Content Security Policy
2. Main User-UI Interaction Patterns
2.1 Patient Registration Flow
Registration staff opens patient registration form
System generates unique R-Number (format: R-YYYYMMDD-XXXX)
Staff enters patient demographics (name, mobile, CNIC, DOB, gender, address)
Selects visit type (Ward/Indoor), department, ward, bed, attending doctor
System validates and saves patient record
R-Number displayed prominently for staff to note/print
2.2 Prescription Creation & Issuance
Doctor creates e-prescription:

Searches patient by R-Number
Adds medicines with dosage, frequency, duration
Saves prescription (status: pending)
Pharmacy staff issues medicines:

Views pending prescription queue or searches by R-Number
System displays prescription details
Staff confirms issuance, system auto-allocates batches (FIFO)
If out of stock, system suggests alternatives
Staff reviews batch allocation, can manually override
Confirms issuance → system deducts stock, generates receipt
Receipt printed/downloaded/SMS sent to patient
2.3 Stock Transfer Between Pharmacies
Sub-Pharmacy Manager requests stock:

Opens transfer request form
Selects source pharmacy (main or another sub-pharmacy)
Adds medicines with requested quantities
Submits request (status: pending)
Main Pharmacy Manager approves:

Views pending transfer requests
Reviews stock availability
Approves/rejects with comments
On approval, system creates dispatch order
Receiving pharmacy confirms:

Views incoming transfers
Confirms receipt with batch details
System updates stock in both pharmacies
2.4 Stock Receiving (PO/GRN)
Main Pharmacy Manager creates Purchase Order
When stock arrives, creates Goods Receipt Note (GRN)
Enters batch details: batch number, quantity, expiry, manufacturer, storage type, prices
System validates and adds to inventory
Generates low stock alerts if thresholds still not met
2.5 Dashboard & Alerts
User logs in, sees role-specific dashboard
Dashboard displays:
Low stock alerts (red badge)
Near expiry alerts (yellow badge)
Pending transfer requests
Today’s issuance summary
Quick actions (register patient, issue medicine, create transfer)
User clicks alert to view details and take action
2.6 Reports & Exports
User navigates to Reports section
Selects report type (daily consumption, batch expiry, patient-wise, etc.)
Applies filters (date range, pharmacy, medicine, doctor)
Previews report in browser
Exports to PDF or Excel
Large reports queued as background job, user notified when ready
2.7 Offline Sync
Local instance operates independently when offline
Sync status indicator shows “Offline” with last sync timestamp
User performs normal operations (issuance, transfers)
When connectivity restored, auto-sync triggers
Conflicts displayed in conflict resolution UI
User resolves conflicts manually if needed
Manual “Upload to Cloud” button for forced sync
3. System Architecture
3.1 High-Level Architecture Diagram
@startuml
!define RECTANGLE class

package "Client Layer" {
  [Web Browser] as browser
  [Mobile Browser] as mobile
  [Offline Terminal] as offline
}

package "CDN / Edge" {
  [Cloudflare / CloudFront] as cdn
}

package "Load Balancer" {
  [Nginx] as nginx
}

package "Application Layer" {
  package "Frontend" {
    [Next.js App] as nextjs
  }
  
  package "Backend API" {
    [NestJS API Server] as api
    [Auth Service] as auth
    [Inventory Service] as inventory
    [Prescription Service] as prescription
    [Transfer Service] as transfer
    [Report Service] as report
    [Sync Service] as sync
  }
  
  package "Background Workers" {
    [BullMQ Worker] as worker
    [Alert Generator] as alerter
    [Auto Redistribution] as redistribution
    [Report Generator] as reportgen
    [Sync Processor] as syncproc
  }
}

package "Data Layer" {
  database "PostgreSQL" as postgres {
    [Main Database] as maindb
    [Read Replica] as replica
  }
  
  database "Redis" as redis {
    [Cache] as cache
    [Session Store] as session
    [Job Queue] as queue
  }
  
  database "SQLite (Local)" as sqlite
}

package "Storage Layer" {
  [MinIO / S3] as storage
}

package "External Services" {
  [SMS Gateway] as sms
  [Email Service] as email
  [Barcode Scanner] as barcode
}

package "Monitoring & Logging" {
  [Prometheus] as prometheus
  [Grafana] as grafana
  [Winston Logger] as logger
}

' Connections
browser --> cdn
mobile --> cdn
offline --> sqlite
cdn --> nginx
nginx --> nextjs
nextjs --> api

api --> auth
api --> inventory
api --> prescription
api --> transfer
api --> report
api --> sync

auth --> maindb
inventory --> maindb
prescription --> maindb
transfer --> maindb
report --> replica
sync --> maindb

api --> cache
api --> session
worker --> queue
alerter --> queue
redistribution --> queue
reportgen --> queue
syncproc --> queue

worker --> maindb
alerter --> maindb
redistribution --> maindb
reportgen --> maindb
reportgen --> storage
syncproc --> maindb

inventory --> storage
prescription --> storage

api --> sms
api --> email
inventory --> barcode

api --> prometheus
worker --> prometheus
prometheus --> grafana
api --> logger

offline ..> sync : "periodic sync"
sync --> syncproc

@enduml
3.2 Multi-Tenant Data Isolation
@startuml
package "Application Middleware" {
  [JWT Validator] as jwt
  [Hospital Context Injector] as context
  [RLS Policy Enforcer] as rls
}

package "Database Layer" {
  database "PostgreSQL" {
    [Hospital A Data] as hospA
    [Hospital B Data] as hospB
    [Hospital C Data] as hospC
    [Shared Config] as shared
  }
}

jwt --> context : "extract hospital_id"
context --> rls : "set session variable"
rls --> hospA : "filter queries"
rls --> hospB : "filter queries"
rls --> hospC : "filter queries"
context --> shared : "no filtering"

note right of rls
  Row-Level Security ensures
  queries only access data
  for current hospital_id
end note

@enduml
4. Data Structures and Interfaces
4.1 Entity Relationship Diagram (ERD)
@startuml

entity "hospitals" as hospitals {
  * id : uuid <<PK>>
  --
  * name : varchar(255)
  * code : varchar(50) <<UK>>
  address : text
  phone : varchar(20)
  email : varchar(255)
  * status : enum(active, inactive)
  * created_at : timestamp
  updated_at : timestamp
}

entity "users" as users {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * email : varchar(255) <<UK>>
  * password_hash : varchar(255)
  * full_name : varchar(255)
  * role : enum(super_admin, hospital_admin, main_pharmacy_manager, sub_pharmacy_manager, doctor, doctor_assistant, registration_staff, pharmacy_staff, auditor)
  phone : varchar(20)
  * status : enum(active, inactive, suspended)
  mfa_enabled : boolean
  mfa_secret : varchar(255)
  last_login : timestamp
  * created_at : timestamp
  updated_at : timestamp
}

entity "pharmacies" as pharmacies {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * name : varchar(255)
  * code : varchar(50)
  * type : enum(main, sub)
  location_ward : varchar(255)
  * status : enum(active, inactive)
  * created_at : timestamp
  updated_at : timestamp
}

entity "patients" as patients {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * r_number : varchar(50) <<UK>>
  * full_name : varchar(255)
  * mobile : varchar(20)
  cnic : varchar(15) <<encrypted>>
  dob : date
  gender : enum(male, female, other)
  address : text
  * visit_type : enum(opd, emergency, ward_indoor)
  department : varchar(255)
  ward : varchar(255)
  bed : varchar(50)
  attending_doctor_id : uuid <<FK>>
  * registered_by : uuid <<FK>>
  * registered_at : timestamp
  updated_at : timestamp
}

entity "medicines" as medicines {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * name : varchar(255)
  generic_name : varchar(255)
  strength : varchar(100)
  form : enum(tablet, capsule, syrup, injection, cream, drops)
  manufacturer : varchar(255)
  * status : enum(active, discontinued)
  * created_at : timestamp
  updated_at : timestamp
}

entity "medicine_alternatives" as alternatives {
  * id : uuid <<PK>>
  --
  * medicine_id : uuid <<FK>>
  * alternative_medicine_id : uuid <<FK>>
  * created_at : timestamp
}

entity "stock_batches" as batches {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * pharmacy_id : uuid <<FK>>
  * medicine_id : uuid <<FK>>
  * batch_no : varchar(100)
  * qty_received : integer
  * qty_available : integer
  * expiry_date : date
  manufacturer : varchar(255)
  * storage_type : enum(room_temperature, cold_storage)
  purchase_price : decimal(10,2)
  government_price : decimal(10,2)
  retail_price : decimal(10,2)
  * received_date : timestamp
  * status : enum(available, expired, depleted)
  * created_at : timestamp
  updated_at : timestamp
}

entity "purchase_orders" as pos {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * pharmacy_id : uuid <<FK>>
  * po_number : varchar(50) <<UK>>
  vendor_name : varchar(255)
  vendor_contact : varchar(255)
  * total_amount : decimal(12,2)
  * status : enum(draft, submitted, approved, received, cancelled)
  * created_by : uuid <<FK>>
  * created_at : timestamp
  updated_at : timestamp
}

entity "po_items" as po_items {
  * id : uuid <<PK>>
  --
  * po_id : uuid <<FK>>
  * medicine_id : uuid <<FK>>
  * qty_ordered : integer
  * unit_price : decimal(10,2)
  * total_price : decimal(10,2)
}

entity "grn" as grn {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * po_id : uuid <<FK>>
  * pharmacy_id : uuid <<FK>>
  * grn_number : varchar(50) <<UK>>
  * received_date : timestamp
  * received_by : uuid <<FK>>
  notes : text
  * created_at : timestamp
}

entity "grn_items" as grn_items {
  * id : uuid <<PK>>
  --
  * grn_id : uuid <<FK>>
  * medicine_id : uuid <<FK>>
  * batch_id : uuid <<FK>>
  * qty_received : integer
}

entity "prescriptions" as prescriptions {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * r_number : varchar(50) <<FK>>
  * doctor_id : uuid <<FK>>
  * prescription_type : enum(e_prescription, scanned, written)
  scanned_image_url : varchar(500)
  * status : enum(pending, issued, partially_issued, cancelled)
  notes : text
  * created_at : timestamp
  updated_at : timestamp
}

entity "prescription_items" as prescription_items {
  * id : uuid <<PK>>
  --
  * prescription_id : uuid <<FK>>
  * medicine_id : uuid <<FK>>
  * qty_prescribed : integer
  dosage : varchar(255)
  frequency : varchar(255)
  duration : varchar(255)
  * status : enum(pending, issued, out_of_stock)
}

entity "issue_transactions" as issues {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * pharmacy_id : uuid <<FK>>
  * r_number : varchar(50) <<FK>>
  prescription_id : uuid <<FK>>
  * issued_by : uuid <<FK>>
  * total_amount : decimal(10,2)
  * price_type : enum(government, retail, custom)
  * status : enum(completed, returned)
  * issued_at : timestamp
  receipt_url : varchar(500)
}

entity "issue_items" as issue_items {
  * id : uuid <<PK>>
  --
  * issue_id : uuid <<FK>>
  * batch_id : uuid <<FK>>
  * medicine_id : uuid <<FK>>
  * qty_issued : integer
  * unit_price : decimal(10,2)
  * total_price : decimal(10,2)
}

entity "transfer_requests" as transfers {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * from_pharmacy_id : uuid <<FK>>
  * to_pharmacy_id : uuid <<FK>>
  * request_number : varchar(50) <<UK>>
  * status : enum(pending, approved, rejected, dispatched, received, cancelled)
  * requested_by : uuid <<FK>>
  approved_by : uuid <<FK>>
  approved_at : timestamp
  dispatched_at : timestamp
  received_at : timestamp
  received_by : uuid <<FK>>
  notes : text
  * created_at : timestamp
  updated_at : timestamp
}

entity "transfer_items" as transfer_items {
  * id : uuid <<PK>>
  --
  * transfer_id : uuid <<FK>>
  * medicine_id : uuid <<FK>>
  * qty_requested : integer
  qty_approved : integer
  qty_dispatched : integer
  qty_received : integer
}

entity "transfer_batch_mapping" as transfer_batches {
  * id : uuid <<PK>>
  --
  * transfer_item_id : uuid <<FK>>
  * source_batch_id : uuid <<FK>>
  * destination_batch_id : uuid <<FK>>
  * qty : integer
}

entity "return_transactions" as returns {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * pharmacy_id : uuid <<FK>>
  r_number : varchar(50) <<FK>>
  issue_id : uuid <<FK>>
  * return_type : enum(patient_return, pharmacy_return)
  * reason : text
  * returned_by : uuid <<FK>>
  * returned_at : timestamp
}

entity "return_items" as return_items {
  * id : uuid <<PK>>
  --
  * return_id : uuid <<FK>>
  * batch_id : uuid <<FK>>
  * medicine_id : uuid <<FK>>
  * qty_returned : integer
  * refund_amount : decimal(10,2)
  * condition : enum(unopened, opened, damaged)
}

entity "alerts" as alerts {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * pharmacy_id : uuid <<FK>>
  * alert_type : enum(low_stock, near_expiry, expired_stock)
  * severity : enum(low, medium, high, critical)
  * message : text
  entity_type : varchar(50)
  entity_id : uuid
  * status : enum(active, acknowledged, resolved)
  acknowledged_by : uuid <<FK>>
  acknowledged_at : timestamp
  * created_at : timestamp
  resolved_at : timestamp
}

entity "audit_logs" as audit {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * user_id : uuid <<FK>>
  * action : varchar(100)
  * entity_type : varchar(100)
  * entity_id : uuid
  before_state : jsonb
  after_state : jsonb
  ip_address : varchar(50)
  user_agent : text
  * timestamp : timestamp
}

entity "sync_operations" as sync_ops {
  * id : uuid <<PK>>
  --
  * hospital_id : uuid <<FK>>
  * pharmacy_id : uuid <<FK>>
  * operation_type : varchar(50)
  * entity_type : varchar(100)
  * entity_id : uuid
  * payload : jsonb
  * status : enum(pending, synced, conflict, failed)
  * version : integer
  * created_at : timestamp
  synced_at : timestamp
  conflict_resolution : jsonb
}

entity "system_config" as config {
  * id : uuid <<PK>>
  --
  hospital_id : uuid <<FK>>
  * config_key : varchar(100)
  * config_value : jsonb
  * updated_at : timestamp
}

' Relationships
hospitals ||--o{ users : "employs"
hospitals ||--o{ pharmacies : "has"
hospitals ||--o{ patients : "registers"
hospitals ||--o{ medicines : "manages"
hospitals ||--o{ stock_batches : "stocks"
hospitals ||--o{ purchase_orders : "creates"
hospitals ||--o{ prescriptions : "issues"
hospitals ||--o{ issue_transactions : "records"
hospitals ||--o{ transfer_requests : "processes"
hospitals ||--o{ return_transactions : "handles"
hospitals ||--o{ alerts : "generates"
hospitals ||--o{ audit_logs : "logs"
hospitals ||--o{ sync_operations : "syncs"
hospitals ||--o{ config : "configures"

users ||--o{ patients : "registers"
users ||--o{ prescriptions : "creates"
users ||--o{ issue_transactions : "issues"
users ||--o{ transfer_requests : "requests"
users ||--o{ return_transactions : "processes"
users ||--o{ purchase_orders : "creates"
users ||--o{ grn : "receives"
users ||--o{ audit_logs : "performs"

pharmacies ||--o{ stock_batches : "stores"
pharmacies ||--o{ purchase_orders : "orders"
pharmacies ||--o{ grn : "receives"
pharmacies ||--o{ issue_transactions : "issues_from"
pharmacies ||--o{ transfer_requests : "transfers_from"
pharmacies ||--o{ transfer_requests : "transfers_to"
pharmacies ||--o{ return_transactions : "returns_to"
pharmacies ||--o{ alerts : "alerts_for"
pharmacies ||--o{ sync_operations : "syncs_for"

patients ||--o{ prescriptions : "receives"
patients ||--o{ issue_transactions : "issued_to"
patients ||--o{ return_transactions : "returns_from"

medicines ||--o{ stock_batches : "batched_as"
medicines ||--o{ po_items : "ordered_as"
medicines ||--o{ grn_items : "received_as"
medicines ||--o{ prescription_items : "prescribed_as"
medicines ||--o{ issue_items : "issued_as"
medicines ||--o{ transfer_items : "transferred_as"
medicines ||--o{ return_items : "returned_as"
medicines ||--o{ alternatives : "has_alternative"
medicines ||--o{ alternatives : "alternative_of"

stock_batches ||--o{ issue_items : "issued_from"
stock_batches ||--o{ return_items : "returned_to"
stock_batches ||--o{ transfer_batch_mapping : "source"
stock_batches ||--o{ transfer_batch_mapping : "destination"
stock_batches ||--o{ grn_items : "created_from"

purchase_orders ||--o{ po_items : "contains"
purchase_orders ||--o{ grn : "fulfilled_by"

grn ||--o{ grn_items : "contains"

prescriptions ||--o{ prescription_items : "contains"
prescriptions ||--o{ issue_transactions : "fulfilled_by"

issue_transactions ||--o{ issue_items : "contains"
issue_transactions ||--o{ return_transactions : "returned_via"

transfer_requests ||--o{ transfer_items : "contains"

transfer_items ||--o{ transfer_batch_mapping : "mapped_via"

return_transactions ||--o{ return_items : "contains"

@enduml
4.2 Core Interface Definitions
@startuml

interface IAuthService {
  +login(email: string, password: string, hospitalId?: uuid): Promise<AuthResponse>
  +verifyMFA(userId: uuid, token: string): Promise<AuthResponse>
  +logout(userId: uuid): Promise<void>
  +refreshToken(refreshToken: string): Promise<AuthResponse>
  +validateToken(token: string): Promise<TokenPayload>
}

interface IPatientService {
  +registerPatient(data: PatientRegistrationDTO): Promise<Patient>
  +getPatientByRNumber(rNumber: string, hospitalId: uuid): Promise<Patient>
  +updatePatient(rNumber: string, data: PatientUpdateDTO): Promise<Patient>
  +searchPatients(query: string, hospitalId: uuid): Promise<Patient[]>
}

interface IMedicineService {
  +createMedicine(data: MedicineCreateDTO): Promise<Medicine>
  +getMedicine(id: uuid): Promise<Medicine>
  +listMedicines(hospitalId: uuid, filters?: MedicineFilters): Promise<Medicine[]>
  +updateMedicine(id: uuid, data: MedicineUpdateDTO): Promise<Medicine>
  +getAlternatives(medicineId: uuid): Promise<Medicine[]>
  +addAlternative(medicineId: uuid, alternativeId: uuid): Promise<void>
}

interface IInventoryService {
  +addStockBatch(data: StockBatchCreateDTO): Promise<StockBatch>
  +getStockByPharmacy(pharmacyId: uuid, filters?: StockFilters): Promise<StockBatch[]>
  +updateBatchQuantity(batchId: uuid, quantity: number): Promise<StockBatch>
  +allocateBatchesFIFO(pharmacyId: uuid, medicineId: uuid, quantity: number): Promise<BatchAllocation[]>
  +checkStockAvailability(pharmacyId: uuid, medicineId: uuid, quantity: number): Promise<boolean>
  +getExpiringBatches(pharmacyId: uuid, daysThreshold: number): Promise<StockBatch[]>
  +getLowStockItems(pharmacyId: uuid): Promise<StockBatch[]>
}

interface IPrescriptionService {
  +createPrescription(data: PrescriptionCreateDTO): Promise<Prescription>
  +getPrescription(id: uuid): Promise<Prescription>
  +listPendingPrescriptions(pharmacyId: uuid): Promise<Prescription[]>
  +updatePrescriptionStatus(id: uuid, status: PrescriptionStatus): Promise<Prescription>
  +uploadScannedPrescription(id: uuid, file: File): Promise<string>
}

interface IIssuanceService {
  +issueMedicines(data: IssueTransactionCreateDTO): Promise<IssueTransaction>
  +getIssuanceHistory(rNumber: string): Promise<IssueTransaction[]>
  +generateReceipt(issueId: uuid, format: 'pdf' | 'excel'): Promise<string>
  +returnMedicines(data: ReturnTransactionCreateDTO): Promise<ReturnTransaction>
}

interface ITransferService {
  +createTransferRequest(data: TransferRequestCreateDTO): Promise<TransferRequest>
  +approveTransfer(transferId: uuid, approvedBy: uuid, items: ApprovedItem[]): Promise<TransferRequest>
  +rejectTransfer(transferId: uuid, reason: string): Promise<TransferRequest>
  +dispatchTransfer(transferId: uuid, batchMappings: BatchMapping[]): Promise<TransferRequest>
  +receiveTransfer(transferId: uuid, receivedBy: uuid, actualQuantities: ReceivedItem[]): Promise<TransferRequest>
  +listPendingTransfers(pharmacyId: uuid): Promise<TransferRequest[]>
}

interface IPurchaseOrderService {
  +createPO(data: POCreateDTO): Promise<PurchaseOrder>
  +approvePO(poId: uuid): Promise<PurchaseOrder>
  +createGRN(data: GRNCreateDTO): Promise<GRN>
  +listPOs(pharmacyId: uuid, status?: POStatus): Promise<PurchaseOrder[]>
}

interface IAlertService {
  +generateLowStockAlerts(pharmacyId: uuid): Promise<Alert[]>
  +generateExpiryAlerts(pharmacyId: uuid): Promise<Alert[]>
  +acknowledgeAlert(alertId: uuid, userId: uuid): Promise<Alert>
  +resolveAlert(alertId: uuid): Promise<Alert>
  +getActiveAlerts(pharmacyId: uuid): Promise<Alert[]>
}

interface IReportService {
  +generateDailyConsumption(pharmacyId: uuid, date: Date): Promise<Report>
  +generateBatchExpiryReport(pharmacyId: uuid, startDate: Date, endDate: Date): Promise<Report>
  +generatePatientIssuanceReport(rNumber: string): Promise<Report>
  +generateDoctorPrescriptionReport(doctorId: uuid, startDate: Date, endDate: Date): Promise<Report>
  +generateTransferReport(pharmacyId: uuid, startDate: Date, endDate: Date): Promise<Report>
  +generateProfitLossReport(pharmacyId: uuid, startDate: Date, endDate: Date): Promise<Report>
  +exportReport(reportId: uuid, format: 'pdf' | 'excel'): Promise<string>
}

interface IAutoRedistributionService {
  +analyzeSt ockLevels(hospitalId: uuid): Promise<RedistributionSuggestion[]>
  +generateSuggestedTransfers(): Promise<TransferRequest[]>
  +autoTriggerTransfers(hospitalId: uuid): Promise<TransferRequest[]>
  +calculateConsumptionRate(pharmacyId: uuid, medicineId: uuid, days: number): Promise<number>
}

interface ISyncService {
  +pushLocalChanges(operations: SyncOperation[]): Promise<SyncResult>
  +pullRemoteChanges(pharmacyId: uuid, lastSyncTimestamp: Date): Promise<SyncOperation[]>
  +resolveConflict(operationId: uuid, resolution: ConflictResolution): Promise<void>
  +getConflicts(pharmacyId: uuid): Promise<SyncOperation[]>
  +bulkUploadToCloud(pharmacyId: uuid): Promise<SyncResult>
}

interface IAuditService {
  +logAction(data: AuditLogCreateDTO): Promise<AuditLog>
  +getAuditTrail(entityType: string, entityId: uuid): Promise<AuditLog[]>
  +searchAuditLogs(filters: AuditFilters): Promise<AuditLog[]>
}

class AuthService implements IAuthService
class PatientService implements IPatientService
class MedicineService implements IMedicineService
class InventoryService implements IInventoryService
class PrescriptionService implements IPrescriptionService
class IssuanceService implements IIssuanceService
class TransferService implements ITransferService
class PurchaseOrderService implements IPurchaseOrderService
class AlertService implements IAlertService
class ReportService implements IReportService
class AutoRedistributionService implements IAutoRedistributionService
class SyncService implements ISyncService
class AuditService implements IAuditService

' DTOs
class PatientRegistrationDTO {
  +fullName: string
  +mobile: string
  +cnic?: string
  +dob?: Date
  +gender: Gender
  +address?: string
  +visitType: VisitType
  +department?: string
  +ward?: string
  +bed?: string
  +attendingDoctorId?: uuid
  +hospitalId: uuid
}

class StockBatchCreateDTO {
  +pharmacyId: uuid
  +medicineId: uuid
  +batchNo: string
  +qtyReceived: number
  +expiryDate: Date
  +manufacturer: string
  +storageType: StorageType
  +purchasePrice: number
  +governmentPrice: number
  +retailPrice: number
}

class IssueTransactionCreateDTO {
  +pharmacyId: uuid
  +rNumber: string
  +prescriptionId?: uuid
  +items: IssueItemDTO[]
  +priceType: PriceType
  +issuedBy: uuid
}

class IssueItemDTO {
  +medicineId: uuid
  +batchId?: uuid
  +qtyIssued: number
  +unitPrice: number
}

class TransferRequestCreateDTO {
  +fromPharmacyId: uuid
  +toPharmacyId: uuid
  +items: TransferItemDTO[]
  +requestedBy: uuid
  +notes?: string
}

class TransferItemDTO {
  +medicineId: uuid
  +qtyRequested: number
}

class BatchAllocation {
  +batchId: uuid
  +medicineId: uuid
  +batchNo: string
  +qtyAllocated: number
  +unitPrice: number
  +expiryDate: Date
}

class AuthResponse {
  +accessToken: string
  +refreshToken: string
  +user: UserDTO
  +requiresMFA: boolean
}

class TokenPayload {
  +userId: uuid
  +hospitalId: uuid
  +role: UserRole
  +pharmacyId?: uuid
  +exp: number
}

@enduml
5. Program Call Flow
5.1 Patient Registration & R-Number Generation
@startuml
actor "Registration Staff" as staff
participant "Web UI" as ui
participant "API Gateway" as gateway
participant "Auth Middleware" as auth
participant "Patient Service" as patient
participant "Database" as db
participant "Audit Service" as audit

staff -> ui: Fill patient registration form
ui -> ui: Validate form data (client-side)
ui -> gateway: POST /api/patients/register
    note right
        Input: {
            "fullName": "John Doe",
            "mobile": "+92-300-1234567",
            "cnic": "12345-6789012-3",
            "dob": "1990-01-15",
            "gender": "male",
            "address": "123 Main St",
            "visitType": "ward_indoor",
            "department": "Cardiology",
            "ward": "Ward A",
            "bed": "A-101",
            "attendingDoctorId": "uuid",
            "hospitalId": "uuid"
        }
    end note

gateway -> auth: Validate JWT token
auth -> auth: Extract hospital_id and user_id
auth --> gateway: Token valid

gateway -> patient: registerPatient(data)
patient -> patient: Generate R-Number\n(format: R-YYYYMMDD-XXXX)
patient -> patient: Encrypt CNIC
patient -> db: BEGIN TRANSACTION
patient -> db: INSERT INTO patients
    note right
        INSERT INTO patients (
            id, hospital_id, r_number, full_name,
            mobile, cnic, dob, gender, address,
            visit_type, department, ward, bed,
            attending_doctor_id, registered_by, registered_at
        ) VALUES (...)
    end note

db --> patient: Patient created

patient -> audit: logAction(CREATE_PATIENT)
    note right
        Input: {
            "userId": "uuid",
            "action": "CREATE_PATIENT",
            "entityType": "patient",
            "entityId": "patient-uuid",
            "afterState": {patient_data},
            "ipAddress": "192.168.1.100",
            "timestamp": "2025-01-15T10:30:00Z"
        }
    end note

audit -> db: INSERT INTO audit_logs
db --> audit: Log created

patient -> db: COMMIT TRANSACTION
patient --> gateway: Patient object with R-Number
    note right
        Output: {
            "id": "uuid",
            "rNumber": "R-20250115-0001",
            "fullName": "John Doe",
            "mobile": "+92-300-1234567",
            "visitType": "ward_indoor",
            "department": "Cardiology",
            "ward": "Ward A",
            "bed": "A-101",
            "registeredAt": "2025-01-15T10:30:00Z"
        }
    end note

gateway --> ui: 201 Created with patient data
ui -> ui: Display R-Number prominently
ui --> staff: Show success message with R-Number

@enduml
5.2 Prescription → Issuance → Stock Deduction (FIFO)
@startuml
actor Doctor
actor "Pharmacy Staff" as staff
participant "Web UI" as ui
participant "API Gateway" as gateway
participant "Prescription Service" as prescription
participant "Issuance Service" as issuance
participant "Inventory Service" as inventory
participant "Database" as db
participant "Alert Service" as alert
participant "Report Service" as report

== Prescription Creation ==
Doctor -> ui: Create e-prescription for patient
ui -> gateway: POST /api/prescriptions
    note right
        Input: {
            "rNumber": "R-20250115-0001",
            "doctorId": "uuid",
            "items": [
                {
                    "medicineId": "uuid",
                    "qtyPrescribed": 30,
                    "dosage": "500mg",
                    "frequency": "Twice daily",
                    "duration": "15 days"
                }
            ]
        }
    end note

gateway -> prescription: createPrescription(data)
prescription -> db: INSERT INTO prescriptions
prescription -> db: INSERT INTO prescription_items
db --> prescription: Prescription created
prescription --> gateway: Prescription object
gateway --> ui: 201 Created
ui --> Doctor: Prescription saved

== Medicine Issuance ==
staff -> ui: Search pending prescriptions by R-Number
ui -> gateway: GET /api/prescriptions?rNumber=R-20250115-0001&status=pending
gateway -> prescription: listPendingPrescriptions()
prescription -> db: SELECT * FROM prescriptions WHERE...
db --> prescription: Prescription list
prescription --> gateway: Prescriptions
gateway --> ui: Prescription data
ui --> staff: Display prescription details

staff -> ui: Confirm issuance
ui -> gateway: POST /api/pharmacies/{pharmacy-id}/issue
    note right
        Input: {
            "rNumber": "R-20250115-0001",
            "prescriptionId": "uuid",
            "items": [
                {
                    "medicineId": "uuid",
                    "qtyIssued": 30
                }
            ],
            "priceType": "government",
            "issuedBy": "uuid"
        }
    end note

gateway -> issuance: issueMedicines(data)
issuance -> db: BEGIN TRANSACTION

loop For each item in request
    issuance -> inventory: allocateBatchesFIFO(pharmacyId, medicineId, qty)
    
    inventory -> db: SELECT * FROM stock_batches\nWHERE pharmacy_id = ? AND medicine_id = ?\nAND qty_available > 0 AND status = 'available'\nAND expiry_date > CURRENT_DATE\nORDER BY received_date ASC, expiry_date ASC\nFOR UPDATE
        note right
            FIFO Logic:
            1. Filter by pharmacy and medicine
            2. Only available stock
            3. Not expired
            4. Sort by received_date (oldest first)
            5. Then by expiry_date (earliest first)
            6. Lock rows for update
        end note
    
    db --> inventory: Batch list
    
    inventory -> inventory: Calculate allocation across batches
        note right
            Example:
            Need: 30 tablets
            Batch1: 20 available (oldest)
            Batch2: 50 available
            
            Allocation:
            - Batch1: 20 tablets
            - Batch2: 10 tablets
        end note
    
    alt Stock available
        inventory --> issuance: BatchAllocation[]
            note right
                Output: [
                    {
                        "batchId": "uuid-1",
                        "qtyAllocated": 20,
                        "unitPrice": 10.50,
                        "batchNo": "BATCH001"
                    },
                    {
                        "batchId": "uuid-2",
                        "qtyAllocated": 10,
                        "unitPrice": 10.50,
                        "batchNo": "BATCH002"
                    }
                ]
            end note
    else Out of stock
        inventory --> issuance: Error: Insufficient stock
        issuance -> issuance: Check alternatives
        issuance -> inventory: Get alternative medicines
        inventory -> db: SELECT alternatives
        db --> inventory: Alternative list
        inventory --> issuance: Alternatives available
        issuance --> gateway: 409 Conflict with alternatives
        gateway --> ui: Show alternatives to staff
        ui --> staff: Select alternative or cancel
        
        alt Staff selects alternative
            staff -> ui: Select alternative medicine
            ui -> gateway: Retry with alternative medicine_id
        else Staff cancels
            staff -> ui: Cancel issuance
            ui -> gateway: Cancel request
            gateway -> issuance: Rollback
            issuance -> db: ROLLBACK TRANSACTION
        end
    end
end

== Stock Deduction ==
loop For each allocated batch
    issuance -> db: UPDATE stock_batches\nSET qty_available = qty_available - ?\nWHERE id = ?
        note right
            Atomic decrement:
            UPDATE stock_batches
            SET qty_available = qty_available - 20
            WHERE id = 'batch-uuid-1'
        end note
    
    db --> issuance: Batch updated
    
    issuance -> db: INSERT INTO issue_items
    db --> issuance: Item recorded
end

== Create Issue Transaction ==
issuance -> issuance: Calculate total amount
issuance -> db: INSERT INTO issue_transactions
db --> issuance: Transaction created

== Update Prescription Status ==
issuance -> db: UPDATE prescriptions SET status = 'issued'
issuance -> db: UPDATE prescription_items SET status = 'issued'

== Generate Receipt ==
issuance -> report: generateReceipt(issueId, 'pdf')
report -> report: Create PDF with patient info, items, batches, prices
report -> db: Store receipt URL
report --> issuance: Receipt URL

== Audit Log ==
issuance -> db: INSERT INTO audit_logs
    note right
        Log: ISSUE_MEDICINES
        Before: stock quantities
        After: reduced quantities
    end note

== Check for Alerts ==
issuance -> alert: Check if stock below threshold
alert -> db: SELECT qty_available FROM stock_batches
alt Stock below threshold
    alert -> db: INSERT INTO alerts (type='low_stock')
    alert --> issuance: Alert created
end

issuance -> db: COMMIT TRANSACTION
issuance --> gateway: IssueTransaction with receipt URL
    note right
        Output: {
            "id": "uuid",
            "rNumber": "R-20250115-0001",
            "totalAmount": 315.00,
            "items": [
                {
                    "medicineId": "uuid",
                    "medicineName": "Paracetamol 500mg",
                    "batches": [
                        {"batchNo": "BATCH001", "qty": 20, "price": 10.50},
                        {"batchNo": "BATCH002", "qty": 10, "price": 10.50}
                    ]
                }
            ],
            "receiptUrl": "https://storage/receipts/uuid.pdf",
            "issuedAt": "2025-01-15T11:00:00Z"
        }
    end note

gateway --> ui: 201 Created
ui -> ui: Display receipt
ui --> staff: Print/Download receipt option

@enduml
5.3 Inter-Pharmacy Transfer Request & Fulfillment
@startuml
actor "Sub-Pharmacy Manager" as sub_manager
actor "Main Pharmacy Manager" as main_manager
participant "Web UI" as ui
participant "API Gateway" as gateway
participant "Transfer Service" as transfer
participant "Inventory Service" as inventory
participant "Database" as db
participant "Alert Service" as alert
participant "Notification Service" as notify

== Transfer Request Creation ==
sub_manager -> ui: Create transfer request
ui -> ui: Select source pharmacy (main or other sub)
ui -> ui: Add medicines and quantities
ui -> gateway: POST /api/transfer-requests
    note right
        Input: {
            "fromPharmacyId": "main-pharmacy-uuid",
            "toPharmacyId": "sub-pharmacy-uuid",
            "items": [
                {
                    "medicineId": "uuid",
                    "qtyRequested": 100
                },
                {
                    "medicineId": "uuid-2",
                    "qtyRequested": 50
                }
            ],
            "requestedBy": "sub-manager-uuid",
            "notes": "Urgent: Running low on stock"
        }
    end note

gateway -> transfer: createTransferRequest(data)
transfer -> db: BEGIN TRANSACTION
transfer -> transfer: Generate request number (TR-YYYYMMDD-XXXX)
transfer -> db: INSERT INTO transfer_requests
transfer -> db: INSERT INTO transfer_items
db --> transfer: Transfer request created

transfer -> notify: Send notification to main pharmacy manager
notify -> notify: Create in-app notification
notify -> notify: Send email notification
notify --> transfer: Notification sent

transfer -> db: COMMIT TRANSACTION
transfer --> gateway: TransferRequest object
    note right
        Output: {
            "id": "uuid",
            "requestNumber": "TR-20250115-0001",
            "fromPharmacyId": "main-uuid",
            "toPharmacyId": "sub-uuid",
            "status": "pending",
            "items": [...],
            "createdAt": "2025-01-15T12:00:00Z"
        }
    end note

gateway --> ui: 201 Created
ui --> sub_manager: Request submitted successfully

== Transfer Approval ==
main_manager -> ui: View pending transfer requests
ui -> gateway: GET /api/transfer-requests?status=pending&pharmacyId=main-uuid
gateway -> transfer: listPendingTransfers(pharmacyId)
transfer -> db: SELECT * FROM transfer_requests WHERE...
db --> transfer: Transfer list
transfer --> gateway: Transfers
gateway --> ui: Transfer requests
ui --> main_manager: Display pending requests

main_manager -> ui: Review request details
main_manager -> ui: Check stock availability
ui -> gateway: GET /api/inventory/{pharmacy-id}/stock?medicineIds=...
gateway -> inventory: getStockByPharmacy(pharmacyId, filters)
inventory -> db: SELECT * FROM stock_batches WHERE...
db --> inventory: Stock data
inventory --> gateway: Stock availability
gateway --> ui: Stock info
ui --> main_manager: Display available stock

alt Sufficient stock
    main_manager -> ui: Approve request
    ui -> gateway: POST /api/transfer-requests/{id}/approve
        note right
            Input: {
                "approvedBy": "main-manager-uuid",
                "items": [
                    {
                        "medicineId": "uuid",
                        "qtyApproved": 100
                    },
                    {
                        "medicineId": "uuid-2",
                        "qtyApproved": 50
                    }
                ]
            }
        end note
    
    gateway -> transfer: approveTransfer(transferId, approvedBy, items)
    transfer -> db: BEGIN TRANSACTION
    transfer -> db: UPDATE transfer_requests SET status='approved'
    transfer -> db: UPDATE transfer_items SET qty_approved=?
    transfer -> db: COMMIT TRANSACTION
    transfer --> gateway: Updated transfer
    gateway --> ui: 200 OK
    ui --> main_manager: Transfer approved
    
else Insufficient stock
    main_manager -> ui: Reject request or approve partial
    ui -> gateway: POST /api/transfer-requests/{id}/reject
        note right
            Input: {
                "rejectedBy": "main-manager-uuid",
                "reason": "Insufficient stock available"
            }
        end note
    
    gateway -> transfer: rejectTransfer(transferId, reason)
    transfer -> db: UPDATE transfer_requests SET status='rejected'
    transfer --> gateway: Updated transfer
    gateway --> ui: 200 OK
    ui --> main_manager: Transfer rejected
end

== Transfer Dispatch ==
main_manager -> ui: Dispatch approved transfer
ui -> gateway: POST /api/transfer-requests/{id}/dispatch
    note right
        Input: {
            "batchMappings": [
                {
                    "transferItemId": "uuid",
                    "sourceBatchId": "batch-uuid-1",
                    "qty": 60
                },
                {
                    "transferItemId": "uuid",
                    "sourceBatchId": "batch-uuid-2",
                    "qty": 40
                }
            ]
        }
    end note

gateway -> transfer: dispatchTransfer(transferId, batchMappings)
transfer -> db: BEGIN TRANSACTION

loop For each batch mapping
    transfer -> inventory: Allocate from source batch (FIFO)
    inventory -> db: UPDATE stock_batches\nSET qty_available = qty_available - ?\nWHERE id = ? AND pharmacy_id = ?
        note right
            Deduct from source pharmacy:
            UPDATE stock_batches
            SET qty_available = qty_available - 60
            WHERE id = 'batch-uuid-1'
            AND pharmacy_id = 'main-pharmacy-uuid'
        end note
    
    db --> inventory: Batch updated
    inventory --> transfer: Stock deducted
    
    transfer -> db: INSERT INTO transfer_batch_mapping
    db --> transfer: Mapping created
end

transfer -> db: UPDATE transfer_requests SET status='dispatched'
transfer -> db: UPDATE transfer_items SET qty_dispatched=?

transfer -> notify: Notify receiving pharmacy
notify --> transfer: Notification sent

transfer -> db: COMMIT TRANSACTION
transfer --> gateway: Updated transfer
gateway --> ui: 200 OK
ui --> main_manager: Transfer dispatched

== Transfer Receipt ==
sub_manager -> ui: View incoming transfers
ui -> gateway: GET /api/transfer-requests?status=dispatched&toPharmacyId=sub-uuid
gateway -> transfer: List incoming transfers
transfer -> db: SELECT * FROM transfer_requests WHERE...
db --> transfer: Transfer list
transfer --> gateway: Transfers
gateway --> ui: Incoming transfers
ui --> sub_manager: Display dispatched transfers

sub_manager -> ui: Confirm receipt
ui -> gateway: POST /api/transfer-requests/{id}/receive
    note right
        Input: {
            "receivedBy": "sub-manager-uuid",
            "actualQuantities": [
                {
                    "transferItemId": "uuid",
                    "qtyReceived": 100
                },
                {
                    "transferItemId": "uuid-2",
                    "qtyReceived": 50
                }
            ]
        }
    end note

gateway -> transfer: receiveTransfer(transferId, receivedBy, actualQuantities)
transfer -> db: BEGIN TRANSACTION

loop For each received item
    transfer -> inventory: Create new batch in destination pharmacy
    inventory -> db: INSERT INTO stock_batches\n(pharmacy_id=destination, medicine_id, qty_received, qty_available, ...)
        note right
            Create batch in receiving pharmacy:
            INSERT INTO stock_batches (
                id, pharmacy_id, medicine_id,
                batch_no, qty_received, qty_available,
                expiry_date, manufacturer, ...
            ) VALUES (
                'new-batch-uuid',
                'sub-pharmacy-uuid',
                'medicine-uuid',
                'BATCH001', 100, 100,
                '2026-12-31', 'Manufacturer', ...
            )
        end note
    
    db --> inventory: Batch created
    inventory --> transfer: Stock added
    
    transfer -> db: UPDATE transfer_batch_mapping\nSET destination_batch_id = ?
    db --> transfer: Mapping updated
end

transfer -> db: UPDATE transfer_requests SET status='received'
transfer -> db: UPDATE transfer_items SET qty_received=?

transfer -> alert: Check if transfer resolved low stock alert
alert -> db: SELECT * FROM alerts WHERE pharmacy_id=? AND status='active'
alt Alert exists and stock now sufficient
    alert -> db: UPDATE alerts SET status='resolved'
end

transfer -> db: INSERT INTO audit_logs
    note right
        Log: TRANSFER_RECEIVED
        Details: items, quantities, batches
    end note

transfer -> db: COMMIT TRANSACTION
transfer --> gateway: Updated transfer
    note right
        Output: {
            "id": "uuid",
            "requestNumber": "TR-20250115-0001",
            "status": "received",
            "receivedAt": "2025-01-15T14:00:00Z",
            "items": [
                {
                    "medicineId": "uuid",
                    "qtyReceived": 100,
                    "newBatchId": "new-batch-uuid"
                }
            ]
        }
    end note

gateway --> ui: 200 OK
ui --> sub_manager: Transfer received successfully

@enduml
5.4 Offline Sync Flow & Conflict Resolution
@startuml
participant "Local Terminal" as local
participant "Local SQLite DB" as localdb
participant "Sync Service (Local)" as localsync
participant "Network" as network
participant "Cloud Sync Gateway" as gateway
participant "Sync Service (Cloud)" as cloudsync
participant "PostgreSQL (Cloud)" as clouddb
participant "Conflict Resolver" as resolver

== Offline Operations ==
note over local, localdb
    Terminal operates offline
    All operations stored locally
end note

local -> localdb: Perform operations\n(issue medicines, transfers, etc.)
localdb -> localdb: INSERT INTO sync_operations
    note right
        Record: {
            "id": "local-uuid-1",
            "operationType": "ISSUE_MEDICINES",
            "entityType": "issue_transaction",
            "entityId": "issue-uuid",
            "payload": {full_operation_data},
            "version": 1,
            "timestamp": "2025-01-15T10:00:00Z",
            "status": "pending"
        }
    end note

localdb --> local: Operation completed locally

== Connectivity Restored ==
note over local, network
    Internet connection available
end note

local -> localsync: Auto-detect connectivity
localsync -> localsync: Check last sync timestamp

== Push Local Changes ==
localsync -> localdb: SELECT * FROM sync_operations\nWHERE status='pending'\nORDER BY timestamp ASC
localdb --> localsync: Pending operations (batch)

localsync -> gateway: POST /api/sync/push
    note right
        Input: {
            "pharmacyId": "uuid",
            "operations": [
                {
                    "id": "local-uuid-1",
                    "operationType": "ISSUE_MEDICINES",
                    "entityType": "issue_transaction",
                    "entityId": "issue-uuid",
                    "payload": {...},
                    "version": 1,
                    "timestamp": "2025-01-15T10:00:00Z"
                },
                {
                    "id": "local-uuid-2",
                    "operationType": "UPDATE_BATCH",
                    "entityType": "stock_batch",
                    "entityId": "batch-uuid",
                    "payload": {...},
                    "version": 2,
                    "timestamp": "2025-01-15T10:05:00Z"
                }
            ]
        }
    end note

gateway -> cloudsync: processSyncOperations(operations)
cloudsync -> clouddb: BEGIN TRANSACTION

loop For each operation
    cloudsync -> clouddb: Check if operation already exists
    clouddb --> cloudsync: Operation status
    
    alt Operation not exists
        cloudsync -> cloudsync: Apply operation to cloud DB
        cloudsync -> clouddb: INSERT/UPDATE entity
        clouddb --> cloudsync: Entity updated
        
        cloudsync -> clouddb: INSERT INTO sync_operations\n(status='synced')
        clouddb --> cloudsync: Sync record created
        
    else Operation exists with different version
        cloudsync -> resolver: detectConflict(operation)
        
        resolver -> clouddb: Get current state from cloud
        clouddb --> resolver: Current entity state
        
        resolver -> resolver: Compare versions and timestamps
        
        alt Last-Write-Wins (timestamp-based)
            resolver -> resolver: Local timestamp > Cloud timestamp?
            
            alt Local is newer
                resolver -> clouddb: UPDATE entity with local data
                clouddb --> resolver: Entity updated
                resolver --> cloudsync: Conflict resolved (local wins)
            else Cloud is newer
                resolver --> cloudsync: Conflict (cloud wins, local discarded)
            end
            
        else Critical conflict (manual resolution needed)
            resolver -> clouddb: INSERT INTO sync_operations\n(status='conflict')
                note right
                    Store conflict details:
                    {
                        "status": "conflict",
                        "localState": {...},
                        "cloudState": {...},
                        "conflictType": "concurrent_update"
                    }
                end note
            
            clouddb --> resolver: Conflict recorded
            resolver --> cloudsync: Manual resolution required
        end
    end
end

cloudsync -> clouddb: COMMIT TRANSACTION
cloudsync --> gateway: SyncResult
    note right
        Output: {
            "totalOperations": 2,
            "synced": 1,
            "conflicts": 1,
            "failed": 0,
            "conflictDetails": [
                {
                    "operationId": "local-uuid-2",
                    "entityType": "stock_batch",
                    "entityId": "batch-uuid",
                    "reason": "Concurrent update detected"
                }
            ]
        }
    end note

gateway --> localsync: Sync result

== Update Local Status ==
localsync -> localdb: UPDATE sync_operations\nSET status='synced'\nWHERE id IN (synced_ids)

localsync -> localdb: UPDATE sync_operations\nSET status='conflict'\nWHERE id IN (conflict_ids)

== Pull Remote Changes ==
localsync -> gateway: GET /api/sync/pull?pharmacyId=uuid&since=last_sync_timestamp
gateway -> cloudsync: pullRemoteChanges(pharmacyId, lastSyncTimestamp)
cloudsync -> clouddb: SELECT * FROM sync_operations\nWHERE pharmacy_id=? AND timestamp > ?\nAND status='synced'\nORDER BY timestamp ASC
clouddb --> cloudsync: Remote operations
cloudsync --> gateway: Operations
gateway --> localsync: Remote changes
    note right
        Output: {
            "operations": [
                {
                    "id": "cloud-uuid-1",
                    "operationType": "TRANSFER_RECEIVED",
                    "entityType": "transfer_request",
                    "entityId": "transfer-uuid",
                    "payload": {...},
                    "timestamp": "2025-01-15T11:00:00Z"
                }
            ]
        }
    end note

loop For each remote operation
    localsync -> localsync: Apply to local DB
    localsync -> localdb: INSERT/UPDATE entity
    localdb --> localsync: Entity updated
end

localsync -> localdb: UPDATE last_sync_timestamp
localsync --> local: Sync completed

== Display Conflicts to User ==
alt Conflicts exist
    local -> local: Show conflict notification
    local -> localsync: GET /conflicts
    localsync -> localdb: SELECT * FROM sync_operations WHERE status='conflict'
    localdb --> localsync: Conflict list
    localsync --> local: Conflicts
    
    local -> local: Display conflict resolution UI
        note right
            Show:
            - Entity type and ID
            - Local version (what user did offline)
            - Cloud version (what happened online)
            - Diff comparison
            - Resolution options:
              1. Keep local version
              2. Accept cloud version
              3. Merge manually
        end note
    
    local -> local: User selects resolution
    local -> localsync: POST /conflicts/{id}/resolve
        note right
            Input: {
                "operationId": "local-uuid-2",
                "resolution": "keep_local",
                "mergedData": {...}
            }
        end note
    
    localsync -> gateway: POST /api/sync/resolve-conflict
    gateway -> cloudsync: resolveConflict(operationId, resolution)
    cloudsync -> clouddb: Apply resolution
    cloudsync -> clouddb: UPDATE sync_operations SET status='resolved'
    clouddb --> cloudsync: Conflict resolved
    cloudsync --> gateway: Resolution applied
    gateway --> localsync: Success
    localsync -> localdb: UPDATE sync_operations SET status='resolved'
    localsync --> local: Conflict resolved
end

== Manual Bulk Upload ==
note over local
    User clicks "Upload to Cloud" button
end note

local -> localsync: Trigger manual sync
localsync -> localsync: Force full sync (all pending operations)
localsync -> gateway: POST /api/sync/bulk-upload
    note right
        Same flow as push,
        but includes all operations
        regardless of auto-sync status
    end note

gateway -> cloudsync: Process bulk upload
cloudsync -> clouddb: Apply all operations
cloudsync --> gateway: Bulk sync result
gateway --> localsync: Result
localsync --> local: Upload completed

@enduml
6. UI Navigation Flow
@startuml

state "Login" as Login {
  [*] --> Login
}

state "Dashboard" as Dashboard {
  state "Main Pharmacy Dashboard" as MainDash
  state "Sub Pharmacy Dashboard" as SubDash
  state "Hospital Admin Dashboard" as AdminDash
  state "Doctor Dashboard" as DoctorDash
}

state "Patient Management" as Patient {
  state "Register Patient" as RegisterPatient
  state "Search Patient" as SearchPatient
  state "Patient Details" as PatientDetails
}

state "Prescription" as Prescription {
  state "Create Prescription" as CreatePrescription
  state "View Prescriptions" as ViewPrescriptions
  state "Prescription Queue" as PrescriptionQueue
}

state "Issuance" as Issuance {
  state "Issue Medicines" as IssueMedicines
  state "Issuance History" as IssuanceHistory
  state "Return Medicines" as ReturnMedicines
}

state "Inventory" as Inventory {
  state "Stock Overview" as StockOverview
  state "Batch Management" as BatchManagement
  state "Receive Stock (GRN)" as ReceiveStock
  state "Purchase Orders" as PurchaseOrders
}

state "Transfers" as Transfers {
  state "Create Transfer Request" as CreateTransfer
  state "Pending Requests" as PendingTransfers
  state "Approve Transfer" as ApproveTransfer
  state "Dispatch Transfer" as DispatchTransfer
  state "Receive Transfer" as ReceiveTransfer
}

state "Alerts" as Alerts {
  state "Low Stock Alerts" as LowStock
  state "Expiry Alerts" as ExpiryAlerts
  state "Alert Details" as AlertDetails
}

state "Reports" as Reports {
  state "Daily Consumption" as DailyConsumption
  state "Batch & Expiry Report" as BatchExpiry
  state "Patient Issuance Report" as PatientReport
  state "Doctor Prescription Report" as DoctorReport
  state "Transfer Report" as TransferReport
  state "Profit/Loss Report" as ProfitLoss
}

state "Settings" as Settings {
  state "Hospital Settings" as HospitalSettings
  state "User Management" as UserManagement
  state "Price Configuration" as PriceConfig
  state "Threshold Configuration" as ThresholdConfig
  state "MFA Settings" as MFASettings
}

state "Offline Sync" as Sync {
  state "Sync Status" as SyncStatus
  state "Conflict Resolution" as ConflictResolution
  state "Manual Upload" as ManualUpload
}

[*] --> Login

Login --> Dashboard : successful login

Dashboard --> Patient : register/search patient
Dashboard --> Prescription : create/view prescriptions
Dashboard --> Issuance : issue medicines
Dashboard --> Inventory : manage stock
Dashboard --> Transfers : manage transfers
Dashboard --> Alerts : view alerts
Dashboard --> Reports : generate reports
Dashboard --> Settings : configure system
Dashboard --> Sync : check sync status

' Patient flows
Patient --> RegisterPatient : new patient
Patient --> SearchPatient : find patient
SearchPatient --> PatientDetails : select patient
PatientDetails --> Patient : back
RegisterPatient --> Patient : save/cancel

' Prescription flows
Prescription --> CreatePrescription : new prescription
Prescription --> ViewPrescriptions : view all
Prescription --> PrescriptionQueue : pending queue
CreatePrescription --> Prescription : save/cancel
ViewPrescriptions --> Prescription : back
PrescriptionQueue --> IssueMedicines : issue from queue

' Issuance flows
Issuance --> IssueMedicines : new issuance
Issuance --> IssuanceHistory : view history
Issuance --> ReturnMedicines : process return
IssueMedicines --> Issuance : complete/cancel
IssuanceHistory --> Issuance : back
ReturnMedicines --> Issuance : complete/cancel

' Inventory flows
Inventory --> StockOverview : view stock
Inventory --> BatchManagement : manage batches
Inventory --> ReceiveStock : receive new stock
Inventory --> PurchaseOrders : manage POs
StockOverview --> Inventory : back
BatchManagement --> Inventory : back
ReceiveStock --> Inventory : save/cancel
PurchaseOrders --> Inventory : back

' Transfer flows
Transfers --> CreateTransfer : new request
Transfers --> PendingTransfers : view pending
PendingTransfers --> ApproveTransfer : approve request
ApproveTransfer --> DispatchTransfer : dispatch
DispatchTransfer --> Transfers : complete
Transfers --> ReceiveTransfer : receive transfer
ReceiveTransfer --> Transfers : complete/cancel

' Alert flows
Alerts --> LowStock : low stock alerts
Alerts --> ExpiryAlerts : expiry alerts
LowStock --> AlertDetails : view details
ExpiryAlerts --> AlertDetails : view details
AlertDetails --> Alerts : back

' Report flows
Reports --> DailyConsumption : daily report
Reports --> BatchExpiry : batch report
Reports --> PatientReport : patient report
Reports --> DoctorReport : doctor report
Reports --> TransferReport : transfer report
Reports --> ProfitLoss : profit/loss report
DailyConsumption --> Reports : back
BatchExpiry --> Reports : back
PatientReport --> Reports : back
DoctorReport --> Reports : back
TransferReport --> Reports : back
ProfitLoss --> Reports : back

' Settings flows
Settings --> HospitalSettings : hospital config
Settings --> UserManagement : manage users
Settings --> PriceConfig : price settings
Settings --> ThresholdConfig : threshold settings
Settings --> MFASettings : MFA config
HospitalSettings --> Settings : save/cancel
UserManagement --> Settings : back
PriceConfig --> Settings : save/cancel
ThresholdConfig --> Settings : save/cancel
MFASettings --> Settings : save/cancel

' Sync flows
Sync --> SyncStatus : view status
Sync --> ConflictResolution : resolve conflicts
Sync --> ManualUpload : manual upload
SyncStatus --> Sync : back
ConflictResolution --> Sync : resolve/back
ManualUpload --> Sync : upload/back

' Back to dashboard
Patient --> Dashboard : home
Prescription --> Dashboard : home
Issuance --> Dashboard : home
Inventory --> Dashboard : home
Transfers --> Dashboard : home
Alerts --> Dashboard : home
Reports --> Dashboard : home
Settings --> Dashboard : home
Sync --> Dashboard : home

@enduml
Navigation Principles:

Maximum depth: 3 levels from dashboard
High-frequency actions (register patient, issue medicines, view alerts) accessible within 1-2 clicks
Clear back navigation at every level
Breadcrumb navigation for deep paths
Quick actions on dashboard for common tasks
Role-based menu (users only see relevant sections)
7. Database ER Diagram (Detailed)
(Refer to Section 4.1 for the complete ERD with all entities and relationships)

Key Design Decisions:

Multi-Tenancy: Every table includes hospital_id with composite indexes
Soft Deletes: Use status enum instead of hard deletes for audit trail
Encryption: CNIC and sensitive PII encrypted at application layer before storage
Partitioning: Large tables (audit_logs, sync_operations) partitioned by hospital_id and date
Indexes:
hospital_id on all tables
r_number unique index
batch_no + pharmacy_id composite index
expiry_date + pharmacy_id for alert queries
status fields for filtering
JSONB Usage: For flexible configuration, audit state, and sync payloads
Timestamps: All tables have created_at and updated_at for audit trail
8. OpenAPI Specification (Summary)
8.1 Authentication Endpoints
/auth/login:
  post:
    summary: User login
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              email: string
              password: string
              hospitalId: string (uuid, optional)
    responses:
      200:
        description: Login successful
        content:
          application/json:
            schema:
              type: object
              properties:
                accessToken: string
                refreshToken: string
                user: object
                requiresMFA: boolean

/auth/mfa/verify:
  post:
    summary: Verify MFA token
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              userId: string (uuid)
              token: string
    responses:
      200:
        description: MFA verified
        content:
          application/json:
            schema:
              type: object
              properties:
                accessToken: string
                refreshToken: string
8.2 Patient Endpoints
/api/patients/register:
  post:
    summary: Register new patient
    security:
      - bearerAuth: []
    requestBody:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/PatientRegistrationDTO'
    responses:
      201:
        description: Patient registered
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Patient'

/api/patients/{rNumber}:
  get:
    summary: Get patient by R-Number
    security:
      - bearerAuth: []
    parameters:
      - name: rNumber
        in: path
        required: true
        schema:
          type: string
    responses:
      200:
        description: Patient details
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Patient'
8.3 Inventory Endpoints
/api/inventory/{pharmacyId}/stock:
  get:
    summary: Get stock for pharmacy
    security:
      - bearerAuth: []
    parameters:
      - name: pharmacyId
        in: path
        required: true
        schema:
          type: string (uuid)
      - name: medicineId
        in: query
        schema:
          type: string (uuid)
      - name: status
        in: query
        schema:
          type: string
          enum: [available, expired, depleted]
    responses:
      200:
        description: Stock list
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '#/components/schemas/StockBatch'

/api/inventory/batches:
  post:
    summary: Add new stock batch (GRN)
    security:
      - bearerAuth: []
    requestBody:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/StockBatchCreateDTO'
    responses:
      201:
        description: Batch created
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/StockBatch'
8.4 Issuance Endpoints
/api/pharmacies/{pharmacyId}/issue:
  post:
    summary: Issue medicines to patient
    security:
      - bearerAuth: []
    parameters:
      - name: pharmacyId
        in: path
        required: true
        schema:
          type: string (uuid)
    requestBody:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/IssueTransactionCreateDTO'
    responses:
      201:
        description: Medicines issued
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/IssueTransaction'
8.5 Transfer Endpoints
/api/transfer-requests:
  post:
    summary: Create transfer request
    security:
      - bearerAuth: []
    requestBody:
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/TransferRequestCreateDTO'
    responses:
      201:
        description: Transfer request created
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransferRequest'

/api/transfer-requests/{id}/approve:
  post:
    summary: Approve transfer request
    security:
      - bearerAuth: []
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string (uuid)
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              approvedBy: string (uuid)
              items: array
    responses:
      200:
        description: Transfer approved
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TransferRequest'
8.6 Report Endpoints
/api/reports/daily-consumption:
  get:
    summary: Generate daily consumption report
    security:
      - bearerAuth: []
    parameters:
      - name: pharmacyId
        in: query
        required: true
        schema:
          type: string (uuid)
      - name: date
        in: query
        required: true
        schema:
          type: string (date)
      - name: format
        in: query
        schema:
          type: string
          enum: [pdf, excel]
    responses:
      200:
        description: Report generated
        content:
          application/json:
            schema:
              type: object
              properties:
                reportUrl: string
8.7 Sync Endpoints
/api/sync/push:
  post:
    summary: Push local changes to cloud
    security:
      - bearerAuth: []
    requestBody:
      content:
        application/json:
          schema:
            type: object
            properties:
              pharmacyId: string (uuid)
              operations: array
    responses:
      200:
        description: Sync result
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SyncResult'

/api/sync/pull:
  get:
    summary: Pull remote changes
    security:
      - bearerAuth: []
    parameters:
      - name: pharmacyId
        in: query
        required: true
        schema:
          type: string (uuid)
      - name: since
        in: query
        required: true
        schema:
          type: string (datetime)
    responses:
      200:
        description: Remote operations
        content:
          application/json:
            schema:
              type: object
              properties:
                operations: array
(Full OpenAPI specification with all endpoints, schemas, and examples will be provided in separate openapi.yaml file)

9. Offline Sync Design
9.1 Architecture
Local Instance:

SQLite database with subset of data (pharmacy-specific)
Sync service runs as background process
Event sourcing pattern: all operations logged with version numbers
Cloud Instance:

PostgreSQL as source of truth
Sync gateway API for push/pull operations
Conflict detection and resolution service
9.2 Sync Strategy
1. Incremental Sync:

Track last_sync_timestamp per pharmacy
Only sync operations after last timestamp
Delta updates to minimize data transfer
2. Operation Logging:

Every operation (CRUD) logged in sync_operations table
Includes: operation type, entity type, entity ID, full payload, version, timestamp
3. Conflict Detection:

Compare version numbers and timestamps
Detect concurrent updates to same entity
4. Conflict Resolution Rules:

Conflict Type	Resolution Strategy
Concurrent stock update	Last-Write-Wins (timestamp)
Patient data update	Manual resolution (show diff)
Transfer status change	Cloud wins (authoritative)
Issuance transaction	Local wins if offline, else cloud
Configuration change	Cloud wins (admin authoritative)
5. Manual Conflict Resolution:

UI displays conflicts with side-by-side comparison
User selects: Keep Local, Accept Cloud, or Merge Manually
Resolution logged in audit trail
9.3 Sync Flow
Auto Sync (when online):

Every 5 minutes, check connectivity
If online, push pending operations
Pull remote changes since last sync
Apply remote changes to local DB
Update last_sync_timestamp
Manual Sync:

User clicks “Upload to Cloud” button
Force push all pending operations
Wait for sync completion
Display result (success/conflicts)
Conflict Handling:

Detect conflicts during push
Mark conflicting operations as status='conflict'
Show notification to user
User opens conflict resolution UI
User resolves conflicts
Re-push resolved operations
9.4 Data Subset for Local Instance
Included:

Pharmacy’s own stock batches
Patients registered at this pharmacy (last 30 days)
Prescriptions for this pharmacy (last 30 days)
Issuance transactions (last 30 days)
Transfer requests involving this pharmacy
Medicines catalog (full)
Users with access to this pharmacy
Configuration for this pharmacy
Excluded:

Other pharmacies’ stock
Old transactions (> 30 days, archived to cloud)
System-wide audit logs (cloud only)
Other hospitals’ data
10. Security & Compliance Plan
10.1 Data Encryption
At Rest:

AES-256 encryption for CNIC and sensitive PII
Encryption key stored in AWS KMS or HashiCorp Vault
Application-level encryption before database insert
Database-level encryption for PostgreSQL (TDE)
In Transit:

TLS 1.3 for all API communication
Certificate pinning for mobile apps (future)
VPN for on-premise to cloud sync
10.2 Authentication & Authorization
Authentication:

JWT tokens with 30-minute expiry
Refresh tokens with 7-day expiry
Argon2 for password hashing
TOTP-based MFA for privileged roles
Session management via Redis
Authorization:

Role-Based Access Control (RBAC)
Hospital-scoped permissions
Middleware validates hospital_id in JWT
Row-Level Security (RLS) in PostgreSQL
Password Policy:

Minimum 12 characters
Must include uppercase, lowercase, number, special char
Password expiry: 90 days for admins, 180 days for others
Password history: prevent reuse of last 5 passwords
10.3 Audit Logging
What to Log:

All CRUD operations
Authentication events (login, logout, MFA)
Authorization failures
Configuration changes
Stock movements (issue, transfer, return)
Report generation
Sync operations
Log Fields:

User ID, role, hospital ID
Action type, entity type, entity ID
Before state, after state (JSONB)
IP address, user agent, device ID
Timestamp (UTC)
Log Retention:

7 years for financial transactions
3 years for patient data
1 year for system logs
Configurable per hospital policy
10.4 Backup & Disaster Recovery
Backup Strategy:

PostgreSQL: Daily full backup + continuous WAL archiving
Point-in-time recovery: Restore to any second within 30 days
Backup storage: AWS S3 with versioning and lifecycle policies
On-premise: Daily backup to external NAS + weekly offsite backup
Recovery Objectives:

RTO (Recovery Time Objective): 4 hours
RPO (Recovery Point Objective): 15 minutes
Backup Schedule:

Full backup: Daily at 2 AM
Incremental backup: Every 6 hours
Transaction log backup: Every 15 minutes
Test restore: Monthly
10.5 Data Retention & Purge
Retention Policies:

Patient records: 10 years (legal requirement)
Prescriptions: 5 years
Issuance transactions: 7 years (financial)
Audit logs: 7 years
Sync operations: 90 days (after successful sync)
Expired stock records: 2 years
Purge Process:

Automated job runs monthly
Soft delete first (mark as archived)
Hard delete after retention period
Export to cold storage before deletion
Audit log of purge operations
10.6 Compliance
HIPAA (if applicable):

PHI encryption at rest and in transit
Access controls and audit trails
Business Associate Agreements (BAAs)
GDPR (if applicable):

Right to access, rectify, erase patient data
Data portability (export patient data)
Consent management
Local Regulations (Pakistan):

CNIC encryption and access restrictions
Data localization (on-premise option)
11. Deployment Plan
11.1 On-Premise Deployment (VPS)
Infrastructure:

32 GB RAM, 8 CPU cores, 500 GB SSD
Ubuntu 22.04 LTS
Docker & Docker Compose
Services:

PostgreSQL 15 (primary + read replica)
Redis 7
MinIO (S3-compatible storage)
Nginx (reverse proxy)
NestJS API (3 instances, load balanced)
Next.js frontend (SSR)
BullMQ workers (2 instances)
Docker Compose Setup:

version: '3.8'
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: mims
      POSTGRES_USER: mims_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"

  api:
    image: mims-api:latest
    environment:
      DATABASE_URL: postgresql://mims_user:${DB_PASSWORD}@postgres:5432/mims
      REDIS_URL: redis://redis:6379
      MINIO_ENDPOINT: minio:9000
    depends_on:
      - postgres
      - redis
      - minio
    deploy:
      replicas: 3

  worker:
    image: mims-worker:latest
    environment:
      DATABASE_URL: postgresql://mims_user:${DB_PASSWORD}@postgres:5432/mims
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 2

  frontend:
    image: mims-frontend:latest
    environment:
      API_URL: http://api:3000
    ports:
      - "3001:3000"

  nginx:
    image: nginx:latest
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
      - frontend

volumes:
  postgres_data:
  minio_data:
Monitoring:

Prometheus for metrics
Grafana for dashboards
Node Exporter for system metrics
Postgres Exporter for DB metrics
Backup:

Cron job for daily PostgreSQL backup
Backup script pushes to external NAS
Weekly offsite backup to cloud (optional)
11.2 Cloud Deployment (AWS)
Infrastructure:

Compute: ECS Fargate or EKS (Kubernetes)
Database: RDS PostgreSQL (Multi-AZ)
Cache: ElastiCache Redis
Storage: S3 for files, EBS for volumes
Load Balancer: ALB (Application Load Balancer)
CDN: CloudFront for frontend assets
Monitoring: CloudWatch + Prometheus + Grafana
Kubernetes Deployment (EKS):

apiVersion: apps/v1
kind: Deployment
metadata:
  name: mims-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mims-api
  template:
    metadata:
      labels:
        app: mims-api
    spec:
      containers:
      - name: api
        image: mims-api:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: mims-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: mims-api-service
spec:
  selector:
    app: mims-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
CI/CD Pipeline (GitHub Actions):

name: Deploy to Production

on:
  push:
    branches:
      - main

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker images
        run: |
          docker build -t mims-api:${{ github.sha }} ./backend
          docker build -t mims-frontend:${{ github.sha }} ./frontend
      
      - name: Push to ECR
        run: |
          aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
          docker push $ECR_REGISTRY/mims-api:${{ github.sha }}
          docker push $ECR_REGISTRY/mims-frontend:${{ github.sha }}
      
      - name: Deploy to EKS
        run: |
          kubectl set image deployment/mims-api api=$ECR_REGISTRY/mims-api:${{ github.sha }}
          kubectl set image deployment/mims-frontend frontend=$ECR_REGISTRY/mims-frontend:${{ github.sha }}
          kubectl rollout status deployment/mims-api
          kubectl rollout status deployment/mims-frontend
Monitoring & Alerts:

CloudWatch alarms for CPU, memory, disk usage
Custom metrics for API latency, error rates
Grafana dashboards for business metrics
PagerDuty integration for critical alerts
12. Testing Strategy
12.1 Unit Testing
Framework: Jest (for NestJS and Next.js)

Coverage Target: 80% code coverage

What to Test:

Service methods (business logic)
Utility functions
Validators
FIFO allocation algorithm
Conflict resolution logic
Example:

describe('InventoryService', () => {
  describe('allocateBatchesFIFO', () => {
    it('should allocate from oldest batch first', async () => {
      const batches = [
        { id: '1', receivedDate: '2024-01-01', qtyAvailable: 50 },
        { id: '2', receivedDate: '2024-02-01', qtyAvailable: 100 },
      ];
      const result = await service.allocateBatchesFIFO('pharmacy-id', 'medicine-id', 120);
      expect(result).toEqual([
        { batchId: '1', qtyAllocated: 50 },
        { batchId: '2', qtyAllocated: 70 },
      ]);
    });
  });
});
12.2 Integration Testing
Framework: Jest + Supertest (for API testing)

What to Test:

API endpoints end-to-end
Database transactions
Authentication & authorization
FIFO allocation with real DB
Transfer workflow
Example:

describe('POST /api/pharmacies/:id/issue', () => {
  it('should issue medicines and deduct stock', async () => {
    const response = await request(app)
      .post('/api/pharmacies/pharmacy-id/issue')
      .set('Authorization', `Bearer ${token}`)
      .send({
        rNumber: 'R-20250115-0001',
        items: [{ medicineId: 'med-id', qtyIssued: 30 }],
        priceType: 'government',
      });
    
    expect(response.status).toBe(201);
    expect(response.body.totalAmount).toBeGreaterThan(0);
    
    // Verify stock deducted
    const stock = await db.stockBatch.findFirst({ where: { id: 'batch-id' } });
    expect(stock.qtyAvailable).toBe(70); // was 100, issued 30
  });
});
12.3 E2E Testing
Framework: Playwright

What to Test:

Complete user workflows
UI interactions
Multi-step processes
Test Scenarios:

Patient Registration → Prescription → Issuance

Register patient, get R-Number
Doctor creates prescription
Pharmacy issues medicines
Verify receipt generated
Transfer Request → Approval → Dispatch → Receipt

Sub-pharmacy creates request
Main pharmacy approves
Main pharmacy dispatches
Sub-pharmacy receives
Verify stock updated in both pharmacies
Offline Sync with Conflict

Perform operations offline
Simulate concurrent cloud update
Trigger sync
Resolve conflict
Verify final state
Example:

test('Patient registration and issuance flow', async ({ page }) => {
  await page.goto('/patients/register');
  await page.fill('input[name="fullName"]', 'John Doe');
  await page.fill('input[name="mobile"]', '+92-300-1234567');
  await page.click('button[type="submit"]');
  
  const rNumber = await page.textContent('.r-number');
  expect(rNumber).toMatch(/^R-\d{8}-\d{4}$/);
  
  await page.goto('/prescriptions/create');
  await page.fill('input[name="rNumber"]', rNumber);
  await page.click('button:has-text("Add Medicine")');
  await page.selectOption('select[name="medicineId"]', 'medicine-uuid');
  await page.fill('input[name="qtyPrescribed"]', '30');
  await page.click('button:has-text("Save Prescription")');
  
  await page.goto('/issuance/issue');
  await page.fill('input[name="rNumber"]', rNumber);
  await page.click('button:has-text("Issue")');
  
  await expect(page.locator('.receipt')).toBeVisible();
});
12.4 Load Testing
Framework: K6

Scenarios:

Normal Load: 100 concurrent users
Peak Load: 500 concurrent users
Stress Test: 1000 concurrent users
Test Cases:

Patient registration: 50 requests/sec
Medicine issuance: 100 requests/sec
Stock queries: 200 requests/sec
Report generation: 10 requests/sec
Example:

import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '5m', target: 500 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'], // < 1% error rate
  },
};

export default function () {
  const token = 'Bearer ...';
  const res = http.post(
    'https://api.example.com/api/pharmacies/pharmacy-id/issue',
    JSON.stringify({
      rNumber: 'R-20250115-0001',
      items: [{ medicineId: 'med-id', qtyIssued: 30 }],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
    }
  );
  
  check(res, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  
  sleep(1);
}
12.5 Acceptance Testing
QA Scenarios:

FIFO Validation

Create multiple batches with different received dates
Issue medicines
Verify oldest batch allocated first
Check batch expiry considered
Automated Distribution

Set low stock threshold
Trigger auto-redistribution
Verify suggested transfers generated
Approve and verify stock moved
Offline Sync

Disconnect local instance
Perform operations offline
Reconnect and sync
Verify operations synced correctly
Test conflict resolution
Security Controls

Test role-based access (unauthorized access blocked)
Test MFA for admin roles
Test CNIC encryption (verify encrypted in DB)
Test audit logging (all actions logged)
Performance

100 concurrent users issuing medicines
Response time < 300ms for 95% of requests
No database deadlocks or race conditions
13. Answers to Architecture Questions
13.1 Tenancy Model Decision
Chosen: Single Database with Tenant Scoping

Justification:

Centralized Management: Easier backup, maintenance, and upgrades
Cost Efficiency: Lower infrastructure costs, single database instance
Cross-Hospital Analytics: Super admin can generate system-wide reports
Scalability: PostgreSQL can handle 100+ hospitals with proper indexing
Data Consistency: Easier to maintain referential integrity
Implementation:

Every table has hospital_id column (indexed)
Row-Level Security (RLS) policies enforce tenant isolation
Application middleware validates hospital context
Partition large tables by hospital_id
Trade-offs:

✅ Pros: Simpler, cheaper, better analytics
⚠️ Cons: Requires careful query design, potential noisy neighbor (mitigated by resource limits)
Alternative Considered: Separate Database per Hospital

More isolation, but higher cost and complexity
Difficult to do cross-hospital analytics
More maintenance overhead (N databases to backup/upgrade)
13.2 Offline Sync Conflict Resolution
Conflict Scenarios & Resolution:

Scenario 1: Concurrent Stock Update

Situation: Local issues 30 tablets offline, cloud issues 20 tablets online from same batch
Detection: Version mismatch when syncing
Resolution: Last-Write-Wins based on timestamp
Outcome: If local timestamp > cloud, local wins; else cloud wins
Rationale: Stock updates are time-sensitive, latest operation should prevail
Scenario 2: Patient Data Update

Situation: Local updates patient address offline, cloud updates phone number online
Detection: Different fields modified
Resolution: Merge both changes (non-conflicting fields)
Outcome: Final record has both updated address and phone number
Rationale: Patient data updates are usually non-conflicting
Scenario 3: Transfer Status Change

Situation: Local marks transfer as “dispatched” offline, cloud marks as “cancelled” online
Detection: Status field conflict
Resolution: Cloud wins (authoritative)
Outcome: Transfer remains “cancelled”, local change discarded
Rationale: Transfer workflow requires coordination, cloud is source of truth
Scenario 4: Prescription Issuance

Situation: Local issues prescription offline, cloud also issues same prescription online
Detection: Duplicate issuance transaction
Resolution: Manual resolution required
Outcome: User sees conflict UI, chooses which issuance to keep
Rationale: Critical financial transaction, requires human judgment
Conflict Resolution Algorithm:

async function resolveConflict(localOp: SyncOperation, cloudState: any): Promise<Resolution> {
  if (localOp.timestamp > cloudState.updatedAt) {
    // Local is newer
    if (localOp.entityType === 'stock_batch') {
      return { strategy: 'last-write-wins', winner: 'local' };
    } else if (localOp.entityType === 'patient') {
      return { strategy: 'merge', mergedData: mergePatientData(localOp.payload, cloudState) };
    } else if (localOp.entityType === 'transfer_request') {
      return { strategy: 'cloud-wins', winner: 'cloud' };
    } else if (localOp.entityType === 'issue_transaction') {
      return { strategy: 'manual', requiresUserInput: true };
    }
  } else {
    // Cloud is newer
    return { strategy: 'cloud-wins', winner: 'cloud' };
  }
}
13.3 Queue & Worker Architecture
Proposed Architecture:

Queue System: BullMQ (Redis-based)

Worker Types:

Alert Generator Worker

Runs every hour
Checks low stock and expiry thresholds
Generates alerts and sends notifications
Auto Redistribution Worker

Runs every 6 hours
Analyzes stock levels across pharmacies
Generates suggested transfers
Auto-triggers transfers if configured
Report Generator Worker

On-demand job triggered by user
Generates large reports (PDF/Excel)
Stores result in S3
Notifies user when ready
Sync Processor Worker

Processes sync operations from local instances
Handles conflict detection and resolution
Updates sync status
Notification Worker

Sends email, SMS, push notifications
Retries on failure
Queue Configuration:

// Alert Queue
const alertQueue = new Queue('alerts', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

// Report Queue
const reportQueue = new Queue('reports', {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    timeout: 300000, // 5 minutes
  },
});

// Sync Queue
const syncQueue = new Queue('sync', {
  connection: redis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    priority: 1, // High priority
  },
});
Worker Scaling:

Horizontal scaling: Multiple worker instances
Priority queues for critical jobs
Rate limiting to prevent overload
Dead letter queue for failed jobs
13.4 Monitoring & Observability
Proposed Stack:

Metrics: Prometheus + Grafana

Key Metrics:

System Metrics: CPU, memory, disk, network
Application Metrics:
API request rate, latency (p50, p95, p99)
Error rate (4xx, 5xx)
Database query time
Queue length, job processing time
Business Metrics:
Medicines issued per hour
Low stock alerts count
Transfer requests pending
Sync operations pending/failed
Logging: Winston + ELK Stack (optional)

Log Levels:

ERROR: Critical errors requiring immediate attention
WARN: Potential issues (low stock, near expiry)
INFO: Important events (login, issuance, transfer)
DEBUG: Detailed debugging info (development only)
Tracing: OpenTelemetry (optional for complex debugging)

Alerting: Prometheus Alertmanager + PagerDuty

Alert Rules:

API error rate > 1% for 5 minutes
Database connection pool exhausted
Disk usage > 80%
Queue length > 1000 jobs
Sync failures > 10 in 1 hour
Low stock alerts not acknowledged for 24 hours
Dashboards:

System Health: CPU, memory, disk, network
API Performance: Request rate, latency, errors
Database Performance: Query time, connections, locks
Business Metrics: Issuances, transfers, alerts
Sync Status: Pending operations, conflicts, failures
13.5 Data Retention Policies
Default Policies:

Data Type	Retention Period	Rationale
Patient records	10 years	Legal requirement (medical records)
Prescriptions	5 years	Regulatory compliance
Issuance transactions	7 years	Financial/tax records
Audit logs	7 years	Compliance and forensics
Stock batches	2 years after expiry	Inventory history
Transfer records	5 years	Operational history
Sync operations	90 days after sync	Conflict resolution window
System logs	1 year	Debugging and troubleshooting
Alerts	1 year	Historical analysis
Reports	3 years	Business intelligence
Per-Hospital Policy:

Hospitals can configure longer retention (not shorter)
Super Admin can set system-wide minimum retention
Configurable via Settings UI
Purge Process:

Automated monthly job
Soft delete first (mark as archived)
Export to cold storage (S3 Glacier)
Hard delete after grace period (30 days)
Audit log of all purge operations
PII Handling:

CNIC and sensitive PII encrypted at rest
Right to erasure (GDPR): Manual process, requires approval
Anonymization option: Replace PII with hashed values for analytics
14. File Structure Overview
mims/
├── backend/
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   ├── jwt.strategy.ts
│   │   │   │   │   └── mfa.strategy.ts
│   │   │   │   └── dto/
│   │   │   │       ├── login.dto.ts
│   │   │   │       └── mfa.dto.ts
│   │   │   ├── patients/
│   │   │   │   ├── patients.controller.ts
│   │   │   │   ├── patients.service.ts
│   │   │   │   ├── patients.module.ts
│   │   │   │   └── dto/
│   │   │   │       ├── register-patient.dto.ts
│   │   │   │       └── update-patient.dto.ts
│   │   │   ├── medicines/
│   │   │   │   ├── medicines.controller.ts
│   │   │   │   ├── medicines.service.ts
│   │   │   │   └── medicines.module.ts
│   │   │   ├── inventory/
│   │   │   │   ├── inventory.controller.ts
│   │   │   │   ├── inventory.service.ts
│   │   │   │   ├── inventory.module.ts
│   │   │   │   └── fifo-allocator.service.ts
│   │   │   ├── prescriptions/
│   │   │   │   ├── prescriptions.controller.ts
│   │   │   │   ├── prescriptions.service.ts
│   │   │   │   └── prescriptions.module.ts
│   │   │   ├── issuance/
│   │   │   │   ├── issuance.controller.ts
│   │   │   │   ├── issuance.service.ts
│   │   │   │   └── issuance.module.ts
│   │   │   ├── transfers/
│   │   │   │   ├── transfers.controller.ts
│   │   │   │   ├── transfers.service.ts
│   │   │   │   └── transfers.module.ts
│   │   │   ├── purchase-orders/
│   │   │   │   ├── po.controller.ts
│   │   │   │   ├── po.service.ts
│   │   │   │   └── po.module.ts
│   │   │   ├── alerts/
│   │   │   │   ├── alerts.controller.ts
│   │   │   │   ├── alerts.service.ts
│   │   │   │   └── alerts.module.ts
│   │   │   ├── reports/
│   │   │   │   ├── reports.controller.ts
│   │   │   │   ├── reports.service.ts
│   │   │   │   ├── reports.module.ts
│   │   │   │   └── generators/
│   │   │   │       ├── pdf.generator.ts
│   │   │   │       └── excel.generator.ts
│   │   │   ├── sync/
│   │   │   │   ├── sync.controller.ts
│   │   │   │   ├── sync.service.ts
│   │   │   │   ├── sync.module.ts
│   │   │   │   └── conflict-resolver.service.ts
│   │   │   ├── audit/
│   │   │   │   ├── audit.service.ts
│   │   │   │   └── audit.module.ts
│   │   │   └── auto-redistribution/
│   │   │       ├── redistribution.service.ts
│   │   │       └── redistribution.module.ts
│   │   ├── common/
│   │   │   ├── middleware/
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   ├── hospital-context.middleware.ts
│   │   │   │   └── rate-limit.middleware.ts
│   │   │   ├── guards/
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── hospital.guard.ts
│   │   │   ├── decorators/
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   └── hospital.decorator.ts
│   │   │   ├── filters/
│   │   │   │   └── http-exception.filter.ts
│   │   │   └── interceptors/
│   │   │       ├── logging.interceptor.ts
│   │   │       └── transform.interceptor.ts
│   │   ├── database/
│   │   │   ├── prisma.service.ts
│   │   │   └── migrations/
│   │   ├── workers/
│   │   │   ├── alert.worker.ts
│   │   │   ├── redistribution.worker.ts
│   │   │   ├── report.worker.ts
│   │   │   ├── sync.worker.ts
│   │   │   └── notification.worker.ts
│   │   ├── config/
│   │   │   ├── database.config.ts
│   │   │   ├── redis.config.ts
│   │   │   └── storage.config.ts
│   │   ├── utils/
│   │   │   ├── encryption.util.ts
│   │   │   ├── r-number.generator.ts
│   │   │   └── date.util.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── test/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── e2e/
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── mfa/
│   │   │   │       └── page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── dashboard/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── patients/
│   │   │   │   │   ├── register/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── search/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── [rNumber]/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── prescriptions/
│   │   │   │   │   ├── create/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── queue/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── issuance/
│   │   │   │   │   ├── issue/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── history/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── return/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── inventory/
│   │   │   │   │   ├── stock/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── batches/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── receive/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── purchase-orders/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── transfers/
│   │   │   │   │   ├── create/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── pending/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── approve/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── dispatch/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── receive/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── alerts/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── reports/
│   │   │   │   │   ├── daily-consumption/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── batch-expiry/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── patient-issuance/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── transfer/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── sync/
│   │   │   │   │   ├── status/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── conflicts/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── settings/
│   │   │   │       ├── hospital/
│   │   │   │       │   └── page.tsx
│   │   │   │       ├── users/
│   │   │   │       │   └── page.tsx
│   │   │   │       └── configuration/
│   │   │   │           └── page.tsx
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── button.tsx
│   │   │   │   ├── input.tsx
│   │   │   │   ├── table.tsx
│   │   │   │   ├── dialog.tsx
│   │   │   │   └── ... (shadcn-ui components)
│   │   │   ├── layout/
│   │   │   │   ├── header.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   └── footer.tsx
│   │   │   ├── forms/
│   │   │   │   ├── patient-registration-form.tsx
│   │   │   │   ├── prescription-form.tsx
│   │   │   │   ├── issuance-form.tsx
│   │   │   │   └── transfer-form.tsx
│   │   │   ├── tables/
│   │   │   │   ├── stock-table.tsx
│   │   │   │   ├── prescription-table.tsx
│   │   │   │   └── transfer-table.tsx
│   │   │   └── charts/
│   │   │       ├── consumption-chart.tsx
│   │   │       └── stock-chart.tsx
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── auth.ts
│   │   │   ├── utils.ts
│   │   │   └── constants.ts
│   │   ├── hooks/
│   │   │   ├── use-auth.ts
│   │   │   ├── use-patients.ts
│   │   │   ├── use-inventory.ts
│   │   │   └── use-sync.ts
│   │   ├── store/
│   │   │   ├── auth.store.ts
│   │   │   ├── hospital.store.ts
│   │   │   └── sync.store.ts
│   │   └── types/
│   │       ├── patient.ts
│   │       ├── medicine.ts
│   │       ├── prescription.ts
│   │       └── transfer.ts
│   ├── public/
│   │   ├── images/
│   │   └── icons/
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── next.config.js
│   └── Dockerfile
├── local-sync/
│   ├── src/
│   │   ├── sync-service.ts
│   │   ├── conflict-resolver.ts
│   │   ├── sqlite-adapter.ts
│   │   └── main.ts
│   ├── package.json
│   └── Dockerfile
├── docs/
│   ├── system_design.md
│   ├── architect.plantuml
│   ├── class_diagram.plantuml
│   ├── sequence_diagram.plantuml
│   ├── er_diagram.plantuml
│   ├── openapi.yaml
│   ├── deployment-guide.md
│   └── user-manual.md
├── infrastructure/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── kubernetes/
│   │   ├── api-deployment.yaml
│   │   ├── frontend-deployment.yaml
│   │   ├── worker-deployment.yaml
│   │   ├── postgres-statefulset.yaml
│   │   ├── redis-deployment.yaml
│   │   └── ingress.yaml
│   ├── terraform/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── scripts/
│       ├── backup.sh
│       ├── restore.sh
│       └── deploy.sh
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
├── README.md
└── LICENSE
15. Anything UNCLEAR
15.1 Clarifications Needed
Barcode/QR Scanning:

What barcode format should be supported? (EAN-13, Code 128, QR Code?)
Should we generate barcodes for batches, or scan existing vendor barcodes?
Hardware: Will hospitals provide barcode scanners, or use camera-based scanning?
SMS Gateway Integration:

Which SMS provider should we integrate with? (Twilio, local Pakistani provider?)
SMS content: What information should be included in receipt SMS?
Cost consideration: SMS per receipt or optional feature?
Alternative Medicine Approval:

Who approves substitutions: Pharmacist only, or requires doctor approval?
Should substitution rules be pre-configured (e.g., “Paracetamol 500mg can be substituted with Generic Paracetamol 500mg”)?
Automated Redistribution Thresholds:

How should safety stock be calculated? (e.g., 7 days of average consumption?)
Should redistribution consider lead time for procurement?
What confidence score threshold for auto-triggering transfers?
Test Receipts:

Requirement mentions “separate receipts for medicines and tests”
Are lab tests part of Phase 1, or just placeholder for future integration?
If Phase 1, what test management features are needed?
Government Pricing Rules:

Are government prices fixed per medicine, or vary by hospital/region?
How often do government prices change?
Should system support bulk price updates?
R-Number Format:

Suggested format: R-YYYYMMDD-XXXX (e.g., R-20250115-0001)
Should R-Number be unique per hospital or system-wide?
Should R-Number be sequential or random?
Offline Sync Frequency:

Auto-sync every 5 minutes when online, or configurable?
Should critical operations (e.g., low stock alerts) trigger immediate sync?
Bulk Upload Format:

CSV or Excel for bulk uploads?
Sample templates needed for medicines, batches, patients?
Validation rules: Should system reject entire upload on error, or import valid rows?
Multi-Hospital Rollout:

Will hospitals be onboarded one at a time, or multiple simultaneously?
Data migration: Will hospitals have existing data to import?
Training: Will there be a training/demo environment?
15.2 Assumptions Made
R-Number: Unique per hospital, sequential within each day
Alternative Medicines: Pharmacist can substitute with pre-approved alternatives without doctor approval
SMS: Optional feature, not critical for MVP
Barcode: Camera-based scanning using web APIs (no dedicated hardware required for MVP)
Test Receipts: Placeholder for future, not implemented in Phase 1
Government Prices: Fixed per medicine, updated manually by admin
Offline Sync: Auto-sync every 5 minutes, manual sync button available
Bulk Upload: CSV format with validation, reject entire upload on error
Multi-Hospital: Onboard one hospital at a time initially
Training: Separate demo environment with sample data
16. Next Steps
Review & Approval: Stakeholder (Abdul Moiz Khan) reviews this system design document
Clarifications: Address unclear points listed in Section 15
Prototype: Build proof-of-concept for FIFO allocation and offline sync
Database Schema: Finalize Prisma schema and create initial migration
API Specification: Complete OpenAPI YAML with all endpoints and examples
Frontend Mockups: Create UI wireframes for key screens
Development Kickoff: Assign tasks to development team based on this architecture
Testing Plan: Finalize test cases and acceptance criteria
Deployment Setup: Prepare Docker Compose and Kubernetes manifests
Documentation: Write user manual and deployment guide
Document Version: 1.0
Date: 2025-01-15
Author: Architecture Team
Status: Draft - Pending Approval


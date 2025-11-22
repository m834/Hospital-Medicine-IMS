M-IMS System Architecture Documentation
Overview
This directory contains the complete system architecture documentation for the Medicines Management System (M-IMS) Phase 1 project.

Documents
1. System Architecture (system_architecture.md)
Comprehensive system design document covering:

Implementation approach and technology stack decisions
Multi-tenant architecture with single database + tenant scoping
User interaction patterns and workflows
Security and compliance requirements
Deployment strategies (on-premise VPS + cloud)
Testing strategy and acceptance criteria
Answers to key architectural questions
Key Decisions:

✅ Single PostgreSQL database with Row-Level Security (RLS) for multi-tenancy
✅ NestJS backend with Prisma ORM
✅ Next.js 14+ frontend with App Router
✅ FIFO stock allocation algorithm
✅ Offline sync with conflict resolution
✅ Automated stock redistribution
2. Architecture Diagram (architect.plantuml)
High-level system architecture showing:

Client layer (web, mobile, offline terminals)
Application layer (frontend, backend API, background workers)
Data layer (PostgreSQL, Redis, SQLite for offline)
Storage layer (MinIO/S3)
External services (SMS, email, barcode)
Monitoring and logging infrastructure
Key Components:

Load balancer (Nginx)
NestJS API with multiple services
BullMQ workers for background jobs
PostgreSQL with read replica
Redis for caching and job queues
3. Class Diagram (class_diagram.plantuml)
Detailed class structure including:

Service interfaces (IAuthService, IPatientService, IInventoryService, etc.)
Service implementations
DTOs (Data Transfer Objects)
Domain models (Patient, Medicine, StockBatch, etc.)
Utility classes (FIFOAllocator, RNumberGenerator, ConflictResolver)
Enums (Gender, VisitType, MedicineForm, etc.)
Design Patterns:

Repository pattern for data access
Service layer for business logic
DTO pattern for API contracts
Strategy pattern for conflict resolution
4. Sequence Diagrams (sequence_diagram.plantuml)
Four critical workflow diagrams:

a) Patient Registration & R-Number Generation
Registration staff fills form
System generates unique R-Number (format: R-YYYYMMDD-XXXX)
CNIC encryption
Audit logging
b) Prescription → Issuance → FIFO Stock Deduction
Doctor creates e-prescription
Pharmacy staff issues medicines
FIFO batch allocation algorithm
Stock deduction with locking
Receipt generation
Low stock alerts
c) Inter-Pharmacy Transfer Request & Fulfillment
Sub-pharmacy creates transfer request
Main pharmacy approves/rejects
Dispatch with batch mapping
Receiving pharmacy confirms receipt
Stock updates in both pharmacies
d) Offline Sync & Conflict Resolution
Local operations stored in SQLite
Connectivity restoration triggers sync
Push local changes to cloud
Pull remote changes
Conflict detection and resolution
Manual conflict resolution UI
5. Entity Relationship Diagram (er_diagram.plantuml)
Complete database schema with:

20+ entities covering all business domains
Primary keys, foreign keys, and indexes
Multi-tenant design (hospital_id in every table)
Relationships and cardinality
Constraints and unique indexes
Key Entities:

hospitals, users, pharmacies, patients
medicines, stock_batches, purchase_orders, grn
prescriptions, issue_transactions, transfer_requests
alerts, audit_logs, sync_operations
Design Features:

Row-Level Security (RLS) for tenant isolation
Partitioning for large tables (audit_logs, sync_operations)
JSONB columns for flexible data (config, audit states)
Encrypted columns (CNIC, sensitive PII)
6. File Structure (file_tree.md)
Complete project folder structure:

Backend (NestJS) with modular architecture
Frontend (Next.js) with App Router
Local sync service (SQLite + sync logic)
Documentation (design, API, deployment, user manual)
Infrastructure (Docker, Kubernetes, Terraform, Ansible)
CI/CD (GitHub Actions)
Highlights:

Feature-based module organization
Colocated components in Next.js
Separate workers for background jobs
Comprehensive testing structure
Infrastructure as Code
How to Use This Documentation
For Developers
Start with system_architecture.md to understand the overall system
Review class_diagram.plantuml for code structure
Study sequence_diagram.plantuml for workflow implementation
Reference er_diagram.plantuml when working with database
Follow file_tree.md for project organization
For DevOps Engineers
Read deployment sections in system_architecture.md
Use infrastructure files in infrastructure/ directory
Follow CI/CD workflows in .github/workflows/
Reference monitoring setup in infrastructure/monitoring/
For QA Engineers
Review testing strategy in system_architecture.md
Study sequence diagrams for test case creation
Reference acceptance criteria in architecture document
Use API documentation for integration testing
For Project Managers
Read implementation approach in system_architecture.md
Review deliverables and timelines
Understand technical constraints and trade-offs
Track progress against architectural milestones
Viewing PlantUML Diagrams
Option 1: VS Code Extension
Install “PlantUML” extension
Open .plantuml files
Press Alt+D to preview
Option 2: Online Viewer
Visit https://www.plantuml.com/plantuml/uml/
Copy diagram code
Paste and view
Option 3: Generate Images
# Install PlantUML
brew install plantuml  # macOS
apt-get install plantuml  # Ubuntu

# Generate PNG
plantuml architect.plantuml
plantuml class_diagram.plantuml
plantuml sequence_diagram.plantuml
plantuml er_diagram.plantuml
Next Steps
Phase 1: Database Setup
[ ] Finalize Prisma schema based on ER diagram
[ ] Create initial migration
[ ] Set up Row-Level Security policies
[ ] Create seed data
Phase 2: Backend Development
[ ] Implement core service interfaces
[ ] Build FIFO allocation algorithm
[ ] Develop authentication and authorization
[ ] Create API endpoints per OpenAPI spec
[ ] Implement background workers
Phase 3: Frontend Development
[ ] Set up Next.js project structure
[ ] Build UI components with shadcn-ui
[ ] Implement authentication flows
[ ] Create feature pages (patients, inventory, issuance, transfers)
[ ] Build reports and dashboards
Phase 4: Offline Sync
[ ] Develop local sync service
[ ] Implement conflict resolution logic
[ ] Build sync UI components
[ ] Test offline scenarios
Phase 5: Testing
[ ] Write unit tests (80% coverage target)
[ ] Create integration tests
[ ] Build E2E test suite with Playwright
[ ] Perform load testing with K6
Phase 6: Deployment
[ ] Set up Docker Compose for development
[ ] Create Kubernetes manifests for production
[ ] Configure monitoring (Prometheus + Grafana)
[ ] Set up CI/CD pipelines
[ ] Deploy to staging environment
[ ] Production deployment
Questions & Clarifications
Refer to Section 15 (Anything UNCLEAR) in system_architecture.md for:

Open questions requiring stakeholder input
Assumptions made during architecture design
Areas needing further clarification
Contact
Project Owner: Abdul Moiz Khan
Architecture Team: Bob (System Architect)
Document Version: 1.0
Last Updated: 2025-01-15

Note: This architecture is designed for Phase 1: Inventory & Patient Issuance (Indoor + Ward). Future phases will extend to OPD, Emergency, and additional integrations (HMS, Lab, EHR).
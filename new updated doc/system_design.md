# Hospital Management System (HMS) - System Design Document

## 1. Implementation Approach

We will implement a **scalable, microservices-based, multi-tenant Hospital Management System** with the following key technical decisions:

### Core Architecture Decisions
1. **Multi-Tenancy Strategy**: Database-per-tenant with shared application layer for strict data isolation
2. **Microservices Pattern**: Domain-driven design with independent, deployable services
3. **API Gateway Pattern**: Next.js BFF layer for frontend integration and routing
4. **Event-Driven Communication**: Message queue (RabbitMQ/Redis) for inter-service communication
5. **Feature Flag System**: Dynamic module enablement per hospital using feature flags stored in database
6. **RBAC Implementation**: Hierarchical role-based access control with hospital, department, and sub-department scoping

### Technology Stack
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Shadcn-ui
- **Backend Services**: Node.js with NestJS framework
- **API Gateway/BFF**: Next.js API routes
- **Database**: PostgreSQL 15+ (one per hospital for data isolation)
- **Caching**: Redis for session management and feature flags
- **Message Queue**: RabbitMQ for async operations
- **Container Orchestration**: Docker & Docker Compose
- **Authentication**: JWT with refresh tokens
- **Audit Logging**: Centralized logging service with PostgreSQL

### Key Services Breakdown
1. **Platform Service** - Hospital management, feature allocation, master admin operations
2. **Auth Service** - Authentication, authorization, RBAC, session management
3. **Patient Service** - Patient registration, MR management, patient history
4. **Clinical Service** - OPD/IPD management, doctor consultations, clinical workflows
5. **Billing Service** - Consolidated billing, payment processing, invoicing
6. **Pharmacy Service** - Inventory management, medicine dispensing, batch tracking
7. **Lab Service** - Lab orders, test results, lab workflows
8. **Radiology Service** - Radiology orders, imaging workflows, report management
9. **Staff Service** - Staff management, roaster scheduling, shift management
10. **Audit Service** - Centralized audit logging, compliance tracking
11. **Notification Service** - Email, SMS, in-app notifications

### Critical Implementation Tasks
1. **Multi-tenant database provisioning** - Automated database creation per hospital
2. **Feature flag engine** - Real-time feature enablement/disablement
3. **MR number generation** - Hospital-scoped unique identifier with reusability
4. **Consolidated billing engine** - Aggregation of charges from multiple services
5. **Department hierarchy management** - Dynamic department/sub-department structure
6. **RBAC permission engine** - Fine-grained access control with inheritance
7. **Audit trail system** - Immutable logging of all critical operations

## 2. Main User-UI Interaction Patterns

### Master Admin Interactions
1. **Hospital Management**
   - Create/Edit/Delete hospitals
   - View list of all hospitals with status indicators
   - Select hospital to view hospital-specific dashboard
   - Generic platform analytics when no hospital selected

2. **Feature Allocation**
   - Enable/disable modules per hospital (OPD, IPD, Pharmacy, Lab, etc.)
   - Configure department and sub-department availability
   - Set feature-specific permissions

3. **User Management**
   - Create/Edit/Delete users across all hospitals
   - Assign roles and permissions
   - View user activity logs

### Super Admin Interactions
1. **Hospital Selection**
   - View list of all hospitals (read-only)
   - Select hospital to view operational dashboard
   - Generic analytics dashboard when no hospital selected

2. **Monitoring & Reports**
   - View hospital performance metrics
   - Access cross-hospital reports
   - Monitor system health

### Hospital Admin Interactions
1. **Department Management**
   - Create/Edit departments and sub-departments
   - Assign staff to departments
   - Configure department-specific workflows

2. **Staff Management**
   - Create daily roasters
   - Manage shift schedules
   - Assign staff to departments/sub-departments

3. **Inventory Management**
   - Monitor pharmacy stock levels
   - Receive low-stock alerts
   - Manage medicine batches and expiry

### Clinical Staff Interactions
1. **Patient Registration (OPD)**
   - Register new patient or search existing
   - Collect checkup fee
   - Generate/retrieve MR number
   - Assign to doctor queue

2. **Doctor Consultation**
   - View patient queue
   - Access patient history via MR
   - Create prescriptions
   - Order lab tests/radiology/pharmacy

3. **Lab/Radiology Workflow**
   - View pending orders
   - Process tests/imaging
   - Upload results linked to MR

4. **Pharmacy Dispensing**
   - View prescription orders
   - Dispense medicines with batch tracking
   - Update inventory

5. **Billing & Payment**
   - View consolidated bill (consultation + lab + radiology + pharmacy)
   - Process payment (cash/card)
   - Generate invoice

## 3. System Architecture

See `architect.plantuml` for detailed architecture diagram.

**Key Architectural Components:**
- **Next.js BFF Layer**: Frontend integration, API routing, SSR
- **API Gateway**: Request routing, authentication, rate limiting
- **Microservices**: Independent domain services with dedicated databases
- **Message Queue**: Async communication between services
- **Redis Cache**: Feature flags, session management, performance optimization
- **PostgreSQL Cluster**: Multi-tenant databases with connection pooling
- **Audit Service**: Centralized logging and compliance

## 4. Data Structures and Interfaces

See `class_diagram.plantuml` for detailed class structures.

**Core Domain Models:**
- **Hospital**: Multi-tenant root entity
- **User**: Role-based user with hospital/department scoping
- **Patient**: Patient master with MR number
- **MedicalRecord**: Visit-based record linked to MR
- **Department/SubDepartment**: Hierarchical organizational structure
- **FeatureFlag**: Module enablement per hospital
- **Bill**: Consolidated billing entity
- **Inventory**: Pharmacy stock with batch tracking
- **Roaster**: Staff scheduling entity

## 5. Program Call Flow

See `sequence_diagram.plantuml` for detailed interaction flows.

**Key Flows:**
1. **Patient Registration & MR Generation**
2. **Doctor Consultation with Orders**
3. **Lab/Radiology Order Processing**
4. **Pharmacy Dispensing**
5. **Consolidated Billing & Payment**
6. **Feature Flag Verification**

## 6. Database ER Diagram

See `er_diagram.plantuml` for detailed entity relationships.

**Key Relationships:**
- Hospital → Departments (1:N)
- Department → SubDepartments (1:N)
- Hospital → Patients (1:N)
- Patient → MedicalRecords (1:N)
- MedicalRecord → Bills (1:1)
- MedicalRecord → Orders (1:N)
- Hospital → FeatureFlags (1:N)
- Pharmacy → Inventory (1:N)

## 7. UI Navigation Flow

See `ui_navigation.plantuml` for navigation state machine.

**Navigation Depth**: Maximum 3 levels
**High-Frequency Functions**: Dashboard, Patient Search, Quick Actions
**Clear Back Navigation**: Breadcrumbs and back buttons at every level

## 8. Unclear Aspects & Assumptions

### Assumptions Made:
1. **Database Isolation**: Each hospital gets a separate PostgreSQL database for strict data isolation
2. **MR Number Format**: Hospital-specific prefix + sequential number (e.g., H001-MR-00001)
3. **Feature Flags**: Stored in centralized platform database, cached in Redis for performance
4. **Payment Gateway**: Integration with third-party payment gateway (Stripe/Razorpay) for card payments
5. **Audit Retention**: Audit logs retained for 7 years for compliance
6. **Session Management**: JWT with 1-hour access token, 7-day refresh token
7. **File Storage**: Medical images and reports stored in S3-compatible object storage

### Clarifications Needed:
1. **IPD Workflow**: Detailed requirements for In-Patient Department (admission, bed management, discharge process)
2. **Insurance Integration**: Should the system integrate with insurance providers for claim processing?
3. **Appointment Scheduling**: Is online appointment booking required for patients?
4. **Telemedicine**: Should the system support video consultations?
5. **Mobile App**: Are native mobile apps required for doctors/staff?
6. **Multi-language Support**: Should the UI support multiple languages?
7. **Reporting Requirements**: What specific reports are needed for hospital management?
8. **Data Migration**: Is there existing data that needs to be migrated from legacy systems?
9. **Compliance Standards**: Which healthcare compliance standards must be met (HIPAA, GDPR, etc.)?
10. **Disaster Recovery**: What are the RTO/RPO requirements for backup and disaster recovery?

## 9. Scalability & Deployment Strategy

### Horizontal Scalability
- **Stateless Services**: All microservices designed to be stateless for easy horizontal scaling
- **Database Sharding**: Future-ready for database sharding if single hospital database grows beyond limits
- **Load Balancing**: Nginx/HAProxy for distributing traffic across service instances
- **Auto-scaling**: Container orchestration with auto-scaling based on CPU/memory metrics

### Deployment Architecture
- **Development**: Docker Compose on local machines
- **Staging**: Kubernetes cluster with 2 replicas per service
- **Production**: Kubernetes cluster with 3+ replicas, multi-zone deployment
- **CI/CD**: GitHub Actions for automated testing and deployment
- **Monitoring**: Prometheus + Grafana for metrics, ELK stack for logs

### Performance Targets
- **API Response Time**: < 200ms for 95th percentile
- **Database Query Time**: < 50ms for 95th percentile
- **Concurrent Users**: Support 10,000+ concurrent users per hospital
- **Data Throughput**: Handle 1000+ transactions per second
- **Uptime SLA**: 99.9% availability

### Security Measures
- **Encryption**: TLS 1.3 for data in transit, AES-256 for data at rest
- **API Security**: Rate limiting, CORS, input validation, SQL injection prevention
- **Authentication**: Multi-factor authentication for admin roles
- **Network Security**: VPC isolation, security groups, firewall rules
- **Vulnerability Scanning**: Regular security audits and penetration testing
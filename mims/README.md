# M-IMS (Medicines Management System)

**Phase 1: Inventory & Patient Issuance**

A comprehensive multi-tenant Hospital Medicine Inventory Management System with FIFO stock allocation, automated redistribution, and offline sync capabilities.

## 📁 Project Structure

```
mims/
├── backend/                    # NestJS Backend API
│   ├── src/
│   │   ├── modules/           # Feature modules
│   │   │   ├── auth/          # Authentication & Authorization
│   │   │   │   ├── strategies/    # JWT, MFA strategies
│   │   │   │   ├── guards/        # Auth guards
│   │   │   │   └── dto/           # Auth DTOs
│   │   │   ├── patients/      # Patient management
│   │   │   │   ├── entities/      # Patient entities
│   │   │   │   └── dto/           # Patient DTOs
│   │   │   ├── medicines/     # Medicine catalog
│   │   │   │   ├── entities/      # Medicine entities
│   │   │   │   └── dto/           # Medicine DTOs
│   │   │   ├── inventory/     # Stock management
│   │   │   │   ├── services/      # FIFO allocation, redistribution
│   │   │   │   └── entities/      # Inventory entities
│   │   │   ├── prescriptions/ # E-prescription management
│   │   │   ├── issuance/      # Medicine issuance
│   │   │   ├── transfers/     # Inter-pharmacy transfers
│   │   │   ├── reports/       # Analytics & reports
│   │   │   └── sync/          # Offline sync
│   │   ├── common/            # Shared utilities
│   │   │   ├── decorators/    # Custom decorators
│   │   │   ├── guards/        # Global guards
│   │   │   ├── interceptors/  # Request/Response interceptors
│   │   │   ├── middleware/    # Custom middleware
│   │   │   └── pipes/         # Validation pipes
│   │   ├── database/          # Database configuration
│   │   └── config/            # App configuration
│   ├── test/                  # Testing
│   │   ├── unit/              # Unit tests
│   │   ├── integration/       # Integration tests
│   │   └── e2e/               # End-to-end tests
│   └── prisma/                # Database schema & migrations
│       └── migrations/
│
├── frontend/                   # Next.js Frontend
│   ├── src/
│   │   ├── app/               # App Router pages
│   │   │   ├── (dashboard)/   # Dashboard layout group
│   │   │   │   ├── patients/      # Patient registration & search
│   │   │   │   ├── prescriptions/ # E-prescription management
│   │   │   │   ├── issuance/      # Medicine issuance interface
│   │   │   │   ├── inventory/     # Stock management
│   │   │   │   ├── transfers/     # Transfer requests & approvals
│   │   │   │   └── reports/       # Analytics dashboard
│   │   │   ├── auth/          # Authentication pages
│   │   │   └── api/           # API routes
│   │   ├── components/        # Reusable components
│   │   │   ├── ui/            # Base UI components (shadcn-ui)
│   │   │   ├── forms/         # Form components
│   │   │   ├── tables/        # Data tables
│   │   │   └── charts/        # Dashboard charts
│   │   ├── hooks/             # Custom React hooks
│   │   ├── stores/            # Zustand state management
│   │   ├── lib/               # Utility functions
│   │   └── types/             # TypeScript type definitions
│   └── public/                # Static assets
│
├── local-sync/                 # Offline Sync Service
│   ├── src/
│   │   ├── database/          # SQLite local database
│   │   ├── sync/              # Sync algorithms
│   │   ├── conflict-resolution/ # Conflict resolution logic
│   │   ├── api/               # Local API endpoints
│   │   └── utils/             # Sync utilities
│   └── database/              # SQLite database files
│
├── infrastructure/             # DevOps & Deployment
│   ├── docker/                # Docker configurations
│   ├── kubernetes/            # K8s manifests
│   ├── terraform/             # Infrastructure as Code
│   ├── monitoring/            # Prometheus, Grafana configs
│   ├── nginx/                 # Reverse proxy configs
│   └── scripts/               # Deployment scripts
│
├── docs/                      # Documentation
│   ├── api/                   # API documentation
│   ├── architecture/          # System architecture docs
│   ├── deployment/            # Deployment guides
│   └── user-guide/            # User manuals
│
└── .github/                   # CI/CD Pipeline
    ├── workflows/             # GitHub Actions
    └── ISSUE_TEMPLATE/        # Issue templates
```

## 🏗️ Architecture Highlights

### Multi-Tenancy
- **Single Database** with tenant scoping via `hospital_id`
- **Row-Level Security (RLS)** in PostgreSQL
- **JWT tokens** carry hospital context
- **Automatic query filtering** by hospital

### FIFO Stock Allocation
- **Batch-based inventory** with expiry tracking
- **Automatic FIFO allocation** (oldest batches first)
- **Atomic stock operations** with transaction locks
- **Manual override** capability with audit trail

### Offline Sync
- **SQLite local instances** for offline operation
- **Event sourcing** pattern with operation logs
- **Conflict resolution** with Last-Write-Wins + manual resolution
- **Incremental sync** with delta updates

### Security & Compliance
- **AES-256 encryption** for sensitive PII
- **TOTP MFA** for privileged roles
- **Comprehensive audit logging**
- **Role-based access control** with hospital scoping

## 🚀 Technology Stack

### Backend
- **NestJS** (Node.js + TypeScript)
- **Prisma ORM** + **PostgreSQL 15+**
- **Redis** (caching + sessions)
- **Bull MQ** (job queues)
- **Passport.js** (authentication)

### Frontend
- **Next.js 14+** (App Router)
- **TypeScript** + **Tailwind CSS**
- **shadcn-ui** component library
- **React Query** (data fetching)
- **Zustand** (state management)

### Infrastructure
- **Docker** + **Kubernetes**
- **Nginx** (load balancer)
- **Prometheus** + **Grafana** (monitoring)
- **MinIO/S3** (file storage)

## 📋 Key Features

### Phase 1 Scope
✅ **Patient Registration** with R-Number generation  
✅ **E-Prescription Management** for doctors  
✅ **FIFO Medicine Issuance** with batch tracking  
✅ **Inter-Pharmacy Transfers** with approval workflow  
✅ **Automated Stock Redistribution** based on consumption  
✅ **Offline Sync** for remote pharmacy terminals  
✅ **Role-Based Dashboard** with real-time alerts  
✅ **Comprehensive Reporting** and audit trails  

## 🏥 Target Users

- **Super Admin**: Multi-hospital system management
- **Hospital Admin**: Hospital-specific administration
- **Main Pharmacy Manager**: Central inventory control
- **Sub-Pharmacy Manager**: Ward/department pharmacy
- **Doctors**: E-prescription creation
- **Pharmacy Staff**: Medicine issuance and returns
- **Registration Staff**: Patient registration

## 🔄 Core Workflows

1. **Patient Registration** → R-Number generation → Ward assignment
2. **Prescription Creation** → Doctor creates e-prescription → Pharmacy queue
3. **Medicine Issuance** → FIFO allocation → Stock deduction → Receipt generation
4. **Stock Transfer** → Request → Approval → Batch mapping → Receipt confirmation
5. **Offline Sync** → Local operations → Conflict detection → Resolution → Cloud sync

---

*This is the base project structure for M-IMS Phase 1. Each directory will be populated with the appropriate files as development progresses.*

# Hospital Management System - File Structure

```
hospital-management-system/
│
├── frontend/                           # Next.js Frontend Application
│   ├── app/                           # Next.js App Router
│   │   ├── (auth)/                   # Auth routes group
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (master-admin)/           # Master Admin routes
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── hospitals/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/features/
│   │   │   │       └── page.tsx
│   │   │   ├── users/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (super-admin)/            # Super Admin routes
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (hospital-admin)/         # Hospital Admin routes
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── departments/
│   │   │   │   └── page.tsx
│   │   │   ├── staff/
│   │   │   │   └── page.tsx
│   │   │   ├── roasters/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (clinical)/               # Clinical Staff routes
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── patients/
│   │   │   │   ├── register/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── search/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   ├── consultations/
│   │   │   │   └── page.tsx
│   │   │   ├── lab/
│   │   │   │   └── page.tsx
│   │   │   ├── pharmacy/
│   │   │   │   └── page.tsx
│   │   │   ├── billing/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── api/                      # Next.js API Routes (BFF)
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── logout/
│   │   │   │   │   └── route.ts
│   │   │   │   └── refresh/
│   │   │   │       └── route.ts
│   │   │   ├── hospitals/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       └── features/
│   │   │   │           └── route.ts
│   │   │   ├── patients/
│   │   │   │   ├── route.ts
│   │   │   │   ├── register/
│   │   │   │   │   └── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   ├── consultations/
│   │   │   │   └── route.ts
│   │   │   ├── orders/
│   │   │   │   └── route.ts
│   │   │   ├── bills/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   └── payments/
│   │   │       └── route.ts
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/                    # React Components
│   │   ├── ui/                       # Shadcn-ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── table.tsx
│   │   │   └── ...
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── footer.tsx
│   │   ├── patients/
│   │   │   ├── patient-form.tsx
│   │   │   ├── patient-search.tsx
│   │   │   └── patient-card.tsx
│   │   ├── consultations/
│   │   │   ├── consultation-form.tsx
│   │   │   └── order-form.tsx
│   │   ├── billing/
│   │   │   ├── bill-preview.tsx
│   │   │   └── payment-form.tsx
│   │   └── common/
│   │       ├── data-table.tsx
│   │       ├── loading-spinner.tsx
│   │       └── error-boundary.tsx
│   ├── lib/                          # Utility functions
│   │   ├── api-client.ts            # API client wrapper
│   │   ├── auth.ts                  # Auth utilities
│   │   ├── utils.ts                 # General utilities
│   │   └── validations.ts           # Form validations
│   ├── hooks/                        # Custom React hooks
│   │   ├── use-auth.ts
│   │   ├── use-feature-flags.ts
│   │   └── use-toast.ts
│   ├── types/                        # TypeScript types
│   │   ├── patient.ts
│   │   ├── consultation.ts
│   │   ├── billing.ts
│   │   └── user.ts
│   ├── styles/
│   │   └── globals.css
│   ├── public/
│   │   └── assets/
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                           # Backend Microservices
│   ├── platform-service/             # Platform & Hospital Management
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── hospitals/
│   │   │   │   ├── hospitals.module.ts
│   │   │   │   ├── hospitals.controller.ts
│   │   │   │   ├── hospitals.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-hospital.dto.ts
│   │   │   │   │   └── update-hospital.dto.ts
│   │   │   │   └── entities/
│   │   │   │       └── hospital.entity.ts
│   │   │   ├── feature-flags/
│   │   │   │   ├── feature-flags.module.ts
│   │   │   │   ├── feature-flags.controller.ts
│   │   │   │   ├── feature-flags.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── feature-flag.entity.ts
│   │   │   ├── database/
│   │   │   │   ├── database.module.ts
│   │   │   │   └── database.service.ts
│   │   │   └── common/
│   │   │       ├── guards/
│   │   │       ├── interceptors/
│   │   │       └── filters/
│   │   ├── test/
│   │   ├── Dockerfile
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── auth-service/                 # Authentication & Authorization
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── auth/
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   ├── jwt.strategy.ts
│   │   │   │   │   └── refresh.strategy.ts
│   │   │   │   └── guards/
│   │   │   │       ├── jwt-auth.guard.ts
│   │   │   │       └── roles.guard.ts
│   │   │   ├── users/
│   │   │   │   ├── users.module.ts
│   │   │   │   ├── users.controller.ts
│   │   │   │   ├── users.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── user.entity.ts
│   │   │   ├── permissions/
│   │   │   │   ├── permissions.module.ts
│   │   │   │   ├── permissions.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── permission.entity.ts
│   │   │   └── sessions/
│   │   │       ├── sessions.module.ts
│   │   │       ├── sessions.service.ts
│   │   │       └── entities/
│   │   │           └── session.entity.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── patient-service/              # Patient & Medical Records
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── patients/
│   │   │   │   ├── patients.module.ts
│   │   │   │   ├── patients.controller.ts
│   │   │   │   ├── patients.service.ts
│   │   │   │   ├── dto/
│   │   │   │   └── entities/
│   │   │   │       └── patient.entity.ts
│   │   │   ├── medical-records/
│   │   │   │   ├── medical-records.module.ts
│   │   │   │   ├── medical-records.controller.ts
│   │   │   │   ├── medical-records.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── medical-record.entity.ts
│   │   │   └── mr-generator/
│   │   │       ├── mr-generator.module.ts
│   │   │       └── mr-generator.service.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── clinical-service/             # Consultations, Departments, Orders
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── departments/
│   │   │   │   ├── departments.module.ts
│   │   │   │   ├── departments.controller.ts
│   │   │   │   ├── departments.service.ts
│   │   │   │   └── entities/
│   │   │   │       ├── department.entity.ts
│   │   │   │       └── sub-department.entity.ts
│   │   │   ├── consultations/
│   │   │   │   ├── consultations.module.ts
│   │   │   │   ├── consultations.controller.ts
│   │   │   │   ├── consultations.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── consultation.entity.ts
│   │   │   └── orders/
│   │   │       ├── orders.module.ts
│   │   │       ├── orders.controller.ts
│   │   │       ├── orders.service.ts
│   │   │       └── entities/
│   │   │           └── order.entity.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── billing-service/              # Billing & Payments
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── bills/
│   │   │   │   ├── bills.module.ts
│   │   │   │   ├── bills.controller.ts
│   │   │   │   ├── bills.service.ts
│   │   │   │   └── entities/
│   │   │   │       ├── bill.entity.ts
│   │   │   │       └── bill-line-item.entity.ts
│   │   │   ├── payments/
│   │   │   │   ├── payments.module.ts
│   │   │   │   ├── payments.controller.ts
│   │   │   │   ├── payments.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── payment.entity.ts
│   │   │   └── payment-gateway/
│   │   │       ├── payment-gateway.module.ts
│   │   │       └── payment-gateway.service.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── pharmacy-service/             # Pharmacy & Inventory
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── pharmacies/
│   │   │   │   ├── pharmacies.module.ts
│   │   │   │   ├── pharmacies.controller.ts
│   │   │   │   ├── pharmacies.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── pharmacy.entity.ts
│   │   │   ├── inventory/
│   │   │   │   ├── inventory.module.ts
│   │   │   │   ├── inventory.controller.ts
│   │   │   │   ├── inventory.service.ts
│   │   │   │   └── entities/
│   │   │   │       ├── inventory-item.entity.ts
│   │   │   │       └── medicine.entity.ts
│   │   │   └── dispensing/
│   │   │       ├── dispensing.module.ts
│   │   │       ├── dispensing.controller.ts
│   │   │       ├── dispensing.service.ts
│   │   │       └── entities/
│   │   │           └── dispensing.entity.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── lab-service/                  # Lab Tests & Orders
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── lab-tests/
│   │   │   │   ├── lab-tests.module.ts
│   │   │   │   ├── lab-tests.controller.ts
│   │   │   │   ├── lab-tests.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── lab-test.entity.ts
│   │   │   └── lab-orders/
│   │   │       ├── lab-orders.module.ts
│   │   │       ├── lab-orders.controller.ts
│   │   │       ├── lab-orders.service.ts
│   │   │       └── entities/
│   │   │           └── lab-order.entity.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── radiology-service/            # Radiology Tests & Orders
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── radiology-tests/
│   │   │   │   ├── radiology-tests.module.ts
│   │   │   │   ├── radiology-tests.controller.ts
│   │   │   │   ├── radiology-tests.service.ts
│   │   │   │   └── entities/
│   │   │   │       └── radiology-test.entity.ts
│   │   │   └── radiology-orders/
│   │   │       ├── radiology-orders.module.ts
│   │   │       ├── radiology-orders.controller.ts
│   │   │       ├── radiology-orders.service.ts
│   │   │       └── entities/
│   │   │           └── radiology-order.entity.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── staff-service/                # Staff & Roaster Management
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   └── roasters/
│   │   │       ├── roasters.module.ts
│   │   │       ├── roasters.controller.ts
│   │   │       ├── roasters.service.ts
│   │   │       └── entities/
│   │   │           └── roaster.entity.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── audit-service/                # Audit Logging
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   └── audit-logs/
│   │   │       ├── audit-logs.module.ts
│   │   │       ├── audit-logs.controller.ts
│   │   │       ├── audit-logs.service.ts
│   │   │       └── entities/
│   │   │           └── audit-log.entity.ts
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── notification-service/         # Notifications (Email, SMS)
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── email/
│       │   │   ├── email.module.ts
│       │   │   └── email.service.ts
│       │   └── sms/
│       │       ├── sms.module.ts
│       │       └── sms.service.ts
│       ├── Dockerfile
│       └── package.json
│
├── infrastructure/                    # Infrastructure Configuration
│   ├── docker/
│   │   ├── docker-compose.yml        # Local development
│   │   ├── docker-compose.prod.yml   # Production
│   │   └── nginx/
│   │       └── nginx.conf
│   ├── kubernetes/                   # K8s manifests (if needed)
│   │   ├── deployments/
│   │   ├── services/
│   │   └── ingress/
│   └── scripts/
│       ├── init-databases.sh
│       └── seed-data.sh
│
├── shared/                           # Shared Libraries
│   ├── types/                       # Shared TypeScript types
│   │   ├── patient.types.ts
│   │   ├── user.types.ts
│   │   └── common.types.ts
│   └── utils/                       # Shared utilities
│       ├── logger.ts
│       └── validators.ts
│
├── docs/                            # Documentation
│   ├── system_design.md
│   ├── architect.plantuml
│   ├── class_diagram.plantuml
│   ├── sequence_diagram.plantuml
│   ├── er_diagram.plantuml
│   ├── ui_navigation.plantuml
│   ├── api-documentation.md
│   └── deployment-guide.md
│
├── .gitignore
├── README.md
└── package.json                     # Root package.json for workspace
```

## Key Directory Explanations

### Frontend (`/frontend`)
- **Next.js 14+** with App Router for modern React development
- **Route Groups**: Organized by user role for clear separation
- **API Routes**: BFF layer that communicates with backend microservices
- **Components**: Reusable UI components using Shadcn-ui
- **Types**: TypeScript type definitions for type safety

### Backend (`/backend`)
- **Microservices**: Each service is independent and focused on a specific domain
- **NestJS**: Structured, scalable Node.js framework
- **Modular Architecture**: Each service follows NestJS module pattern
- **DTOs & Entities**: Clear separation of data transfer objects and database entities

### Infrastructure (`/infrastructure`)
- **Docker Compose**: For local development and testing
- **Kubernetes**: For production deployment (optional)
- **Nginx**: API Gateway and load balancing

### Shared (`/shared`)
- **Types**: Shared TypeScript types across frontend and backend
- **Utils**: Common utility functions

## Technology Stack Summary

- **Frontend**: Next.js 14+, TypeScript, Tailwind CSS, Shadcn-ui
- **Backend**: Node.js, NestJS, TypeScript
- **Database**: PostgreSQL (multi-tenant)
- **Cache**: Redis
- **Message Queue**: RabbitMQ
- **Storage**: S3/MinIO
- **Container**: Docker
- **Orchestration**: Kubernetes (optional)
- **API Gateway**: Nginx/Kong
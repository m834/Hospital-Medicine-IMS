M-IMS Project File Structure
Overview
This document outlines the complete file and folder structure for the Medicines Management System (M-IMS) Phase 1 project.

Root Structure
mims/
├── backend/                    # NestJS backend application
├── frontend/                   # Next.js frontend application
├── local-sync/                 # Offline sync service
├── docs/                       # Documentation
├── infrastructure/             # Deployment and infrastructure
├── .github/                    # GitHub Actions CI/CD
├── README.md
├── LICENSE
└── .gitignore
Backend Structure (backend/)
backend/
├── src/
│   ├── modules/                # Feature modules
│   │   ├── auth/
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   ├── strategies/
│   │   │   │   ├── jwt.strategy.ts
│   │   │   │   └── mfa.strategy.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   └── dto/
│   │   │       ├── login.dto.ts
│   │   │       ├── mfa.dto.ts
│   │   │       └── register.dto.ts
│   │   │
│   │   ├── patients/
│   │   │   ├── patients.controller.ts
│   │   │   ├── patients.service.ts
│   │   │   ├── patients.module.ts
│   │   │   ├── entities/
│   │   │   │   └── patient.entity.ts
│   │   │   └── dto/
│   │   │       ├── register-patient.dto.ts
│   │   │       ├── update-patient.dto.ts
│   │   │       └── patient-filters.dto.ts
│   │   │
│   │   ├── medicines/
│   │   │   ├── medicines.controller.ts
│   │   │   ├── medicines.service.ts
│   │   │   ├── medicines.module.ts
│   │   │   ├── entities/
│   │   │   │   ├── medicine.entity.ts
│   │   │   │   └── medicine-alternative.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-medicine.dto.ts
│   │   │       ├── update-medicine.dto.ts
│   │   │       └── medicine-filters.dto.ts
│   │   │
│   │   ├── inventory/
│   │   │   ├── inventory.controller.ts
│   │   │   ├── inventory.service.ts
│   │   │   ├── inventory.module.ts
│   │   │   ├── services/
│   │   │   │   ├── fifo-allocator.service.ts
│   │   │   │   └── stock-valuation.service.ts
│   │   │   ├── entities/
│   │   │   │   └── stock-batch.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-batch.dto.ts
│   │   │       ├── stock-filters.dto.ts
│   │   │       └── batch-allocation.dto.ts
│   │   │
│   │   ├── prescriptions/
│   │   │   ├── prescriptions.controller.ts
│   │   │   ├── prescriptions.service.ts
│   │   │   ├── prescriptions.module.ts
│   │   │   ├── entities/
│   │   │   │   ├── prescription.entity.ts
│   │   │   │   └── prescription-item.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-prescription.dto.ts
│   │   │       ├── prescription-item.dto.ts
│   │   │       └── prescription-filters.dto.ts
│   │   │
│   │   ├── issuance/
│   │   │   ├── issuance.controller.ts
│   │   │   ├── issuance.service.ts
│   │   │   ├── issuance.module.ts
│   │   │   ├── entities/
│   │   │   │   ├── issue-transaction.entity.ts
│   │   │   │   └── issue-item.entity.ts
│   │   │   └── dto/
│   │   │       ├── issue-medicines.dto.ts
│   │   │       ├── issue-item.dto.ts
│   │   │       └── issuance-filters.dto.ts
│   │   │
│   │   ├── transfers/
│   │   │   ├── transfers.controller.ts
│   │   │   ├── transfers.service.ts
│   │   │   ├── transfers.module.ts
│   │   │   ├── entities/
│   │   │   │   ├── transfer-request.entity.ts
│   │   │   │   ├── transfer-item.entity.ts
│   │   │   │   └── transfer-batch-mapping.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-transfer.dto.ts
│   │   │       ├── approve-transfer.dto.ts
│   │   │       ├── dispatch-transfer.dto.ts
│   │   │       └── receive-transfer.dto.ts
│   │   │
│   │   ├── purchase-orders/
│   │   │   ├── po.controller.ts
│   │   │   ├── po.service.ts
│   │   │   ├── po.module.ts
│   │   │   ├── entities/
│   │   │   │   ├── purchase-order.entity.ts
│   │   │   │   ├── po-item.entity.ts
│   │   │   │   ├── grn.entity.ts
│   │   │   │   └── grn-item.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-po.dto.ts
│   │   │       ├── create-grn.dto.ts
│   │   │       └── po-filters.dto.ts
│   │   │
│   │   ├── alerts/
│   │   │   ├── alerts.controller.ts
│   │   │   ├── alerts.service.ts
│   │   │   ├── alerts.module.ts
│   │   │   ├── entities/
│   │   │   │   └── alert.entity.ts
│   │   │   └── dto/
│   │   │       ├── alert-filters.dto.ts
│   │   │       └── acknowledge-alert.dto.ts
│   │   │
│   │   ├── reports/
│   │   │   ├── reports.controller.ts
│   │   │   ├── reports.service.ts
│   │   │   ├── reports.module.ts
│   │   │   ├── generators/
│   │   │   │   ├── pdf.generator.ts
│   │   │   │   ├── excel.generator.ts
│   │   │   │   ├── daily-consumption.generator.ts
│   │   │   │   ├── batch-expiry.generator.ts
│   │   │   │   ├── patient-issuance.generator.ts
│   │   │   │   └── profit-loss.generator.ts
│   │   │   ├── entities/
│   │   │   │   └── report.entity.ts
│   │   │   └── dto/
│   │   │       ├── report-filters.dto.ts
│   │   │       └── export-report.dto.ts
│   │   │
│   │   ├── sync/
│   │   │   ├── sync.controller.ts
│   │   │   ├── sync.service.ts
│   │   │   ├── sync.module.ts
│   │   │   ├── services/
│   │   │   │   ├── conflict-resolver.service.ts
│   │   │   │   └── sync-processor.service.ts
│   │   │   ├── entities/
│   │   │   │   └── sync-operation.entity.ts
│   │   │   └── dto/
│   │   │       ├── push-sync.dto.ts
│   │   │       ├── pull-sync.dto.ts
│   │   │       └── resolve-conflict.dto.ts
│   │   │
│   │   ├── audit/
│   │   │   ├── audit.service.ts
│   │   │   ├── audit.module.ts
│   │   │   ├── entities/
│   │   │   │   └── audit-log.entity.ts
│   │   │   └── dto/
│   │   │       ├── audit-log.dto.ts
│   │   │       └── audit-filters.dto.ts
│   │   │
│   │   ├── auto-redistribution/
│   │   │   ├── redistribution.service.ts
│   │   │   ├── redistribution.module.ts
│   │   │   ├── services/
│   │   │   │   ├── consumption-analyzer.service.ts
│   │   │   │   └── transfer-suggester.service.ts
│   │   │   └── dto/
│   │   │       ├── redistribution-analysis.dto.ts
│   │   │       └── transfer-suggestion.dto.ts
│   │   │
│   │   ├── hospitals/
│   │   │   ├── hospitals.controller.ts
│   │   │   ├── hospitals.service.ts
│   │   │   ├── hospitals.module.ts
│   │   │   ├── entities/
│   │   │   │   └── hospital.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-hospital.dto.ts
│   │   │       └── update-hospital.dto.ts
│   │   │
│   │   ├── pharmacies/
│   │   │   ├── pharmacies.controller.ts
│   │   │   ├── pharmacies.service.ts
│   │   │   ├── pharmacies.module.ts
│   │   │   ├── entities/
│   │   │   │   └── pharmacy.entity.ts
│   │   │   └── dto/
│   │   │       ├── create-pharmacy.dto.ts
│   │   │       └── update-pharmacy.dto.ts
│   │   │
│   │   └── returns/
│   │       ├── returns.controller.ts
│   │       ├── returns.service.ts
│   │       ├── returns.module.ts
│   │       ├── entities/
│   │       │   ├── return-transaction.entity.ts
│   │       │   └── return-item.entity.ts
│   │       └── dto/
│   │           ├── create-return.dto.ts
│   │           └── return-filters.dto.ts
│   │
│   ├── common/
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts
│   │   │   ├── hospital-context.middleware.ts
│   │   │   ├── rate-limit.middleware.ts
│   │   │   └── logger.middleware.ts
│   │   ├── guards/
│   │   │   ├── roles.guard.ts
│   │   │   ├── hospital.guard.ts
│   │   │   └── mfa.guard.ts
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   ├── hospital.decorator.ts
│   │   │   ├── current-user.decorator.ts
│   │   │   └── audit-log.decorator.ts
│   │   ├── filters/
│   │   │   ├── http-exception.filter.ts
│   │   │   └── validation-exception.filter.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   ├── transform.interceptor.ts
│   │   │   └── timeout.interceptor.ts
│   │   ├── pipes/
│   │   │   ├── validation.pipe.ts
│   │   │   └── parse-uuid.pipe.ts
│   │   ├── enums/
│   │   │   ├── user-role.enum.ts
│   │   │   ├── medicine-form.enum.ts
│   │   │   ├── prescription-status.enum.ts
│   │   │   ├── transfer-status.enum.ts
│   │   │   └── alert-type.enum.ts
│   │   └── interfaces/
│   │       ├── jwt-payload.interface.ts
│   │       ├── pagination.interface.ts
│   │       └── api-response.interface.ts
│   │
│   ├── database/
│   │   ├── prisma.service.ts
│   │   ├── database.module.ts
│   │   ├── seeds/
│   │   │   ├── seed.ts
│   │   │   ├── hospitals.seed.ts
│   │   │   ├── users.seed.ts
│   │   │   └── medicines.seed.ts
│   │   └── migrations/
│   │       └── (auto-generated by Prisma)
│   │
│   ├── workers/
│   │   ├── alert.worker.ts
│   │   ├── redistribution.worker.ts
│   │   ├── report.worker.ts
│   │   ├── sync.worker.ts
│   │   ├── notification.worker.ts
│   │   └── worker.module.ts
│   │
│   ├── config/
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   ├── storage.config.ts
│   │   ├── jwt.config.ts
│   │   ├── mfa.config.ts
│   │   └── app.config.ts
│   │
│   ├── utils/
│   │   ├── encryption.util.ts
│   │   ├── r-number.generator.ts
│   │   ├── date.util.ts
│   │   ├── pagination.util.ts
│   │   └── file.util.ts
│   │
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   └── main.ts
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── test/
│   ├── unit/
│   │   ├── auth.service.spec.ts
│   │   ├── inventory.service.spec.ts
│   │   ├── fifo-allocator.spec.ts
│   │   └── ...
│   ├── integration/
│   │   ├── patients.e2e-spec.ts
│   │   ├── issuance.e2e-spec.ts
│   │   ├── transfers.e2e-spec.ts
│   │   └── ...
│   └── e2e/
│       └── app.e2e-spec.ts
│
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── .env.example
├── .env
├── .eslintrc.js
├── .prettierrc
├── Dockerfile
├── Dockerfile.worker
└── README.md
Frontend Structure (frontend/)
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── mfa/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── components/
│   │   │   │   │   ├── stats-card.tsx
│   │   │   │   │   ├── alerts-widget.tsx
│   │   │   │   │   ├── pending-transfers-widget.tsx
│   │   │   │   │   └── quick-actions.tsx
│   │   │   │   └── loading.tsx
│   │   │   │
│   │   │   ├── patients/
│   │   │   │   ├── register/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── search/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── [rNumber]/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── components/
│   │   │   │   │       ├── patient-details.tsx
│   │   │   │   │       ├── prescription-history.tsx
│   │   │   │   │       └── issuance-history.tsx
│   │   │   │   └── components/
│   │   │   │       ├── patient-registration-form.tsx
│   │   │   │       ├── patient-search-form.tsx
│   │   │   │       └── patient-table.tsx
│   │   │   │
│   │   │   ├── prescriptions/
│   │   │   │   ├── create/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── queue/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── prescription-form.tsx
│   │   │   │       ├── prescription-queue-table.tsx
│   │   │   │       ├── prescription-item-form.tsx
│   │   │   │       └── upload-prescription.tsx
│   │   │   │
│   │   │   ├── issuance/
│   │   │   │   ├── issue/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── history/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── return/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── issuance-form.tsx
│   │   │   │       ├── batch-selector.tsx
│   │   │   │       ├── alternative-selector.tsx
│   │   │   │       ├── receipt-viewer.tsx
│   │   │   │       └── return-form.tsx
│   │   │   │
│   │   │   ├── inventory/
│   │   │   │   ├── stock/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── batches/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── receive/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── purchase-orders/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── create/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── stock-table.tsx
│   │   │   │       ├── batch-form.tsx
│   │   │   │       ├── grn-form.tsx
│   │   │   │       ├── po-form.tsx
│   │   │   │       └── stock-filters.tsx
│   │   │   │
│   │   │   ├── transfers/
│   │   │   │   ├── create/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── pending/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── approve/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── dispatch/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── receive/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── transfer-request-form.tsx
│   │   │   │       ├── transfer-table.tsx
│   │   │   │       ├── approve-transfer-form.tsx
│   │   │   │       ├── dispatch-transfer-form.tsx
│   │   │   │       └── receive-transfer-form.tsx
│   │   │   │
│   │   │   ├── alerts/
│   │   │   │   ├── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── alerts-table.tsx
│   │   │   │       ├── alert-details.tsx
│   │   │   │       └── alert-filters.tsx
│   │   │   │
│   │   │   ├── reports/
│   │   │   │   ├── daily-consumption/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── batch-expiry/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── patient-issuance/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── doctor-prescription/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── transfer/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── profit-loss/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── report-filters.tsx
│   │   │   │       ├── report-viewer.tsx
│   │   │   │       └── export-buttons.tsx
│   │   │   │
│   │   │   ├── sync/
│   │   │   │   ├── status/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── conflicts/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── sync-status-widget.tsx
│   │   │   │       ├── conflict-resolver.tsx
│   │   │   │       └── manual-upload-button.tsx
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   ├── hospital/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── users/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── configuration/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── thresholds/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── pricing/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── components/
│   │   │   │       ├── hospital-settings-form.tsx
│   │   │   │       ├── user-management-table.tsx
│   │   │   │       ├── threshold-config-form.tsx
│   │   │   │       └── price-config-form.tsx
│   │   │   │
│   │   │   └── layout.tsx
│   │   │
│   │   ├── api/
│   │   │   └── [...all routes handled by backend]
│   │   │
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   └── not-found.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── form.tsx
│   │   │   ├── label.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── ... (other shadcn-ui components)
│   │   │
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── footer.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   └── mobile-nav.tsx
│   │   │
│   │   ├── charts/
│   │   │   ├── consumption-chart.tsx
│   │   │   ├── stock-chart.tsx
│   │   │   ├── expiry-chart.tsx
│   │   │   └── trend-chart.tsx
│   │   │
│   │   └── common/
│   │       ├── loading-spinner.tsx
│   │       ├── error-boundary.tsx
│   │       ├── pagination.tsx
│   │       ├── search-bar.tsx
│   │       ├── date-picker.tsx
│   │       └── file-upload.tsx
│   │
│   ├── lib/
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── utils.ts
│   │   ├── constants.ts
│   │   ├── validators.ts
│   │   └── formatters.ts
│   │
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-patients.ts
│   │   ├── use-medicines.ts
│   │   ├── use-inventory.ts
│   │   ├── use-prescriptions.ts
│   │   ├── use-issuance.ts
│   │   ├── use-transfers.ts
│   │   ├── use-alerts.ts
│   │   ├── use-reports.ts
│   │   ├── use-sync.ts
│   │   ├── use-toast.ts
│   │   └── use-debounce.ts
│   │
│   ├── store/
│   │   ├── auth.store.ts
│   │   ├── hospital.store.ts
│   │   ├── sync.store.ts
│   │   └── ui.store.ts
│   │
│   ├── types/
│   │   ├── patient.ts
│   │   ├── medicine.ts
│   │   ├── prescription.ts
│   │   ├── issuance.ts
│   │   ├── transfer.ts
│   │   ├── alert.ts
│   │   ├── report.ts
│   │   ├── sync.ts
│   │   └── api.ts
│   │
│   └── styles/
│       └── globals.css
│
├── public/
│   ├── images/
│   │   ├── logo.svg
│   │   └── placeholder.png
│   ├── icons/
│   │   └── favicon.ico
│   └── fonts/
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.js
├── postcss.config.js
├── components.json
├── .env.local.example
├── .env.local
├── .eslintrc.json
├── .prettierrc
├── Dockerfile
└── README.md
Local Sync Service Structure (local-sync/)
local-sync/
├── src/
│   ├── services/
│   │   ├── sync.service.ts
│   │   ├── conflict-resolver.service.ts
│   │   ├── sqlite-adapter.service.ts
│   │   └── network-monitor.service.ts
│   ├── models/
│   │   ├── sync-operation.model.ts
│   │   └── conflict.model.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── encryption.ts
│   ├── config/
│   │   ├── database.config.ts
│   │   └── sync.config.ts
│   └── main.ts
│
├── sqlite/
│   └── local.db (generated at runtime)
│
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
Documentation Structure (docs/)
docs/
├── design/
│   ├── system_architecture.md
│   ├── architect.plantuml
│   ├── class_diagram.plantuml
│   ├── sequence_diagram.plantuml
│   ├── er_diagram.plantuml
│   └── file_tree.md (this file)
│
├── api/
│   ├── openapi.yaml
│   ├── postman-collection.json
│   └── api-examples.md
│
├── deployment/
│   ├── deployment-guide.md
│   ├── on-premise-setup.md
│   ├── cloud-setup.md
│   └── backup-restore.md
│
├── user-manual/
│   ├── getting-started.md
│   ├── patient-registration.md
│   ├── inventory-management.md
│   ├── prescription-issuance.md
│   ├── transfers.md
│   ├── reports.md
│   └── troubleshooting.md
│
└── development/
    ├── setup-guide.md
    ├── coding-standards.md
    ├── testing-guide.md
    └── contribution-guide.md
Infrastructure Structure (infrastructure/)
infrastructure/
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   ├── docker-compose.prod.yml
│   └── .env.example
│
├── kubernetes/
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── api-deployment.yaml
│   ├── api-service.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── worker-deployment.yaml
│   ├── postgres-statefulset.yaml
│   ├── postgres-service.yaml
│   ├── redis-deployment.yaml
│   ├── redis-service.yaml
│   ├── minio-deployment.yaml
│   ├── minio-service.yaml
│   ├── ingress.yaml
│   └── hpa.yaml
│
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── providers.tf
│   ├── modules/
│   │   ├── vpc/
│   │   ├── rds/
│   │   ├── elasticache/
│   │   ├── s3/
│   │   ├── eks/
│   │   └── alb/
│   └── environments/
│       ├── dev/
│       ├── staging/
│       └── production/
│
├── ansible/
│   ├── playbooks/
│   │   ├── setup-server.yml
│   │   ├── deploy-app.yml
│   │   └── backup.yml
│   ├── inventory/
│   │   ├── dev.ini
│   │   └── prod.ini
│   └── roles/
│       ├── docker/
│       ├── nginx/
│       └── postgres/
│
├── monitoring/
│   ├── prometheus/
│   │   ├── prometheus.yml
│   │   └── alerts.yml
│   ├── grafana/
│   │   ├── dashboards/
│   │   │   ├── system-health.json
│   │   │   ├── api-performance.json
│   │   │   └── business-metrics.json
│   │   └── datasources.yml
│   └── alertmanager/
│       └── config.yml
│
└── scripts/
    ├── backup.sh
    ├── restore.sh
    ├── deploy.sh
    ├── rollback.sh
    ├── migrate.sh
    └── health-check.sh
CI/CD Structure (.github/)
.github/
└── workflows/
    ├── ci.yml
    ├── cd-dev.yml
    ├── cd-staging.yml
    ├── cd-production.yml
    ├── test.yml
    ├── lint.yml
    └── security-scan.yml
Root Configuration Files
/
├── .gitignore
├── .dockerignore
├── .editorconfig
├── .prettierrc
├── .eslintrc.js
├── README.md
├── LICENSE
├── CHANGELOG.md
└── CONTRIBUTING.md
Key Design Decisions
1. Modular Architecture
Backend organized by feature modules (patients, inventory, prescriptions, etc.)
Each module is self-contained with controllers, services, entities, and DTOs
Promotes separation of concerns and maintainability
2. Next.js App Router
Using Next.js 14+ App Router for better performance and SEO
Route groups for authentication and dashboard sections
Colocated components within feature folders
3. Shared UI Components
Shadcn-ui for consistent, accessible UI components
Custom components in components/ directory
Reusable across all features
4. Type Safety
TypeScript throughout the stack
Shared types between frontend and backend
Prisma for type-safe database access
5. Testing Structure
Unit tests colocated with source files
Integration tests in dedicated test/integration/ folder
E2E tests in test/e2e/ folder
6. Infrastructure as Code
Docker Compose for local development
Kubernetes manifests for cloud deployment
Terraform for infrastructure provisioning
Ansible for server configuration
7. Documentation
Comprehensive documentation in docs/ folder
Separate sections for design, API, deployment, and user manual
PlantUML diagrams for visual documentation
8. Environment-Specific Configuration
Separate Docker Compose files for dev and prod
Environment-specific Kubernetes manifests
Terraform workspaces for different environments
This file structure ensures:

✅ Clear separation of concerns
✅ Easy navigation and discoverability
✅ Scalability for future features
✅ Consistency across the codebase
✅ Support for both on-premise and cloud deployments
✅ Comprehensive testing and documentation

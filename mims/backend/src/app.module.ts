import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

// Import common modules
import { CommonModule } from './common/common.module';
import { PerformanceInterceptor } from './common/interceptors/performance.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

// Import feature modules
import { AuthModule } from './modules/auth/auth.module';
import { PatientsModule } from './modules/patients/patients.module';
import { SyncModule } from './modules/sync/sync.module';
import { MedicinesModule } from './modules/medicines/medicines.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { MedicineTemplatesModule } from './modules/medicine-templates/medicine-templates.module';
import { IssuanceModule } from './modules/issuance/issuance.module';
import { PharmaciesModule } from './modules/pharmacies/pharmacies.module';
import { UsersModule } from './modules/users/users.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { SubDepartmentsModule } from './modules/sub-departments/sub-departments.module';

// Phase 2: Clinical Services modules
import { ClinicsModule } from './modules/clinics/clinics.module';
import { VisitsModule } from './modules/visits/visits.module';
import { TokensModule } from './modules/tokens/tokens.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { ReceiptsModule } from './modules/receipts/receipts.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PatientVisitsModule } from './modules/patient-visits/patient-visits.module';
// Phase 2: In-House (Indoor/Admission) modules
import { RoomsModule } from './modules/rooms/rooms.module';
import { BedsModule } from './modules/beds/beds.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { OperationsModule } from './modules/operations/operations.module';
// Phase 3: Lab Services modules
import { LabTestsModule } from './modules/lab-tests/lab-tests.module';
import { LabOrdersModule } from './modules/lab-orders/lab-orders.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { ExpenditureModule } from './modules/expenditure/expenditure.module';

// Attendance & HR modules
import { AttendanceModule } from './modules/attendance/attendance.module';

// License & IP Protection
import { LicenseModule } from './common/license/license.module';

// Import configuration
import { DatabaseModule } from './database/database.module';
import { HospitalsModule } from './modules/hospitals/hospitals.module';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';

@Module({
  imports: [
    // License Protection (must be first)
    LicenseModule,

    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
      envFilePath: ['.env.local', '.env'],
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Scheduling (cron jobs)
    ScheduleModule.forRoot(),

    // Database
    DatabaseModule,

    // Common services (global)
    CommonModule,

    // Feature modules
    AuthModule,
    PatientsModule,
    SyncModule,
    MedicinesModule,
    InventoryModule,
    PrescriptionsModule,
    MedicineTemplatesModule,
    IssuanceModule,
    HospitalsModule,
    PharmaciesModule,
    UsersModule,
    TransfersModule,
    ReportsModule,
    AnalyticsModule,
    FeatureFlagsModule,
    PermissionsModule,
    DepartmentsModule,
    SubDepartmentsModule,
    // Phase 2: Clinical Services
    ClinicsModule,
    VisitsModule,
    TokensModule,
    ReferralsModule,
    ReceiptsModule,
    PaymentsModule,
    PatientVisitsModule,
    // Phase 2: In-House (Indoor/Admission)
    RoomsModule,
    BedsModule,
    AdmissionsModule,
    OperationsModule,
    // Phase 3: Lab Services
    LabTestsModule,
    LabOrdersModule,
    // Attendance & HR
    AttendanceModule,
    PayrollModule,
    ExpenditureModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: PerformanceInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}

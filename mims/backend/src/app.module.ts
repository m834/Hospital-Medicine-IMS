import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

// Import common modules
import { CommonModule } from './common/common.module';

// Import feature modules
import { AuthModule } from './modules/auth/auth.module';
import { PatientsModule } from './modules/patients/patients.module';
import { SyncModule } from './modules/sync/sync.module';
import { MedicinesModule } from './modules/medicines/medicines.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { IssuanceModule } from './modules/issuance/issuance.module';
import { PharmaciesModule } from './modules/pharmacies/pharmacies.module';
import { UsersModule } from './modules/users/users.module';
import { TransfersModule } from './modules/transfers/transfers.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';

// Import configuration
import { DatabaseModule } from './database/database.module';
import { HospitalsModule } from './modules/hospitals/hospitals.module';
import databaseConfig from './config/database.config';
import appConfig from './config/app.config';

@Module({
  imports: [
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
    IssuanceModule,
    HospitalsModule,
    PharmaciesModule,
    UsersModule,
    TransfersModule,
    ReportsModule,
    AnalyticsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

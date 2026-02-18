import { Module, Global } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { RedisService } from './services/redis.service';
import { AuditService } from './services/audit.service';
import { EncryptionService } from './services/encryption.service';
import { EntityEncryptionService } from './services/entity-encryption.service';
import { AuditLogViewerService } from './services/audit-log-viewer.service';
import { ThreatDetectionService } from './services/threat-detection.service';
import { AlertService } from './services/alert.service';
import { DashboardService } from './services/dashboard.service';
import { ExportService } from './services/export.service';
import { ComplianceService } from './services/compliance.service';
import { AuditModule } from './modules/audit.module';

/**
 * Common Module - Global services like caching, encryption, auditing, threat detection
 * Marked as @Global so services are available everywhere without importing
 */
@Global()
@Module({
  imports: [AuditModule],
  providers: [
    CacheService,
    RedisService,
    AuditService,
    EncryptionService,
    EntityEncryptionService,
    AuditLogViewerService,
    ThreatDetectionService,
    AlertService,
    DashboardService,
    ExportService,
    ComplianceService,
  ],
  exports: [
    CacheService,
    RedisService,
    AuditService,
    EncryptionService,
    EntityEncryptionService,
    AuditLogViewerService,
    ThreatDetectionService,
    AlertService,
    DashboardService,
    ExportService,
    ComplianceService,
  ],
})
export class CommonModule {}

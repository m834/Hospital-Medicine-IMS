import { Module, Global } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { RedisService } from './services/redis.service';
import { AuditService } from './services/audit.service';
import { EncryptionService } from './services/encryption.service';
import { EntityEncryptionService } from './services/entity-encryption.service';

/**
 * Common Module - Global services like caching, encryption, auditing
 * Marked as @Global so services are available everywhere without importing
 */
@Global()
@Module({
  providers: [CacheService, RedisService, AuditService, EncryptionService, EntityEncryptionService],
  exports: [CacheService, RedisService, AuditService, EncryptionService, EntityEncryptionService],
})
export class CommonModule {}

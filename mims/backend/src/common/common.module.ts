import { Module, Global } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { RedisService } from './services/redis.service';

/**
 * Common Module - Global services like caching
 * Marked as @Global so services are available everywhere without importing
 */
@Global()
@Module({
  providers: [CacheService, RedisService],
  exports: [CacheService, RedisService],
})
export class CommonModule {}

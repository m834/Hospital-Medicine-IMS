import { Module, Global } from '@nestjs/common';
import { CacheService } from './services/cache.service';

/**
 * Common Module - Global services like caching
 * Marked as @Global so CacheService is available everywhere without importing
 */
@Global()
@Module({
  providers: [CacheService],
  exports: [CacheService],
})
export class CommonModule {}

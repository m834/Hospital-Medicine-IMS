import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { DatabaseModule } from '../../database/database.module';
import { CacheService } from '../../common/services/cache.service';

@Module({
  imports: [DatabaseModule],
  controllers: [InventoryController],
  providers: [InventoryService, CacheService],
  exports: [InventoryService],
})
export class InventoryModule {}

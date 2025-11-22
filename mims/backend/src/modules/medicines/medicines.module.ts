import { Module } from '@nestjs/common';
import { MedicinesService } from './medicines.service';
import { MedicinesController } from './medicines.controller';
import { DatabaseModule } from '../../database/database.module';
import { CacheService } from '../../common/services/cache.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MedicinesController],
  providers: [MedicinesService, CacheService],
  exports: [MedicinesService],
})
export class MedicinesModule {}

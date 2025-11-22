import { Module } from '@nestjs/common';
import { IssuanceService } from './issuance.service';
import { IssuanceController } from './issuance.controller';
import { DatabaseModule } from '../../database/database.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [DatabaseModule, InventoryModule],
  controllers: [IssuanceController],
  providers: [IssuanceService],
  exports: [IssuanceService],
})
export class IssuanceModule {}

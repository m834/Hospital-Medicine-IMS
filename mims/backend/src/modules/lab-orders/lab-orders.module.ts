import { Module } from '@nestjs/common';
import { LabOrdersController } from './lab-orders.controller';
import { LabOrdersService } from './lab-orders.service';
import { LabResultPdfService } from './lab-result-pdf.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [LabOrdersController],
  providers: [LabOrdersService, LabResultPdfService],
  exports: [LabOrdersService],
})
export class LabOrdersModule {}

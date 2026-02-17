import { Module } from '@nestjs/common';
import { LabTestsController } from './lab-tests.controller';
import { LabTestsService } from './lab-tests.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [LabTestsController],
  providers: [LabTestsService],
  exports: [LabTestsService],
})
export class LabTestsModule {}

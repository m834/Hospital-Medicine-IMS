import { Module } from '@nestjs/common';
import { MedicineTemplatesService } from './medicine-templates.service';
import { MedicineTemplatesController } from './medicine-templates.controller';
import { DatabaseModule } from '../../database/database.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [DatabaseModule, CommonModule],
  controllers: [MedicineTemplatesController],
  providers: [MedicineTemplatesService],
  exports: [MedicineTemplatesService],
})
export class MedicineTemplatesModule {}

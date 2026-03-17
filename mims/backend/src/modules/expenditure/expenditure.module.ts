import { Module } from '@nestjs/common';
import { ExpenditureController } from './expenditure.controller';
import { ExpenditureService } from './expenditure.service';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ExpenditureController],
  providers: [ExpenditureService],
  exports: [ExpenditureService],
})
export class ExpenditureModule {}

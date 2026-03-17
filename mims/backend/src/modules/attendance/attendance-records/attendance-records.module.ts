import { Module } from '@nestjs/common';
import { AttendanceRecordsService } from './attendance-records.service';
import { AttendanceAutoAbsentService } from './attendance-auto-absent.service';
import { AttendanceRecordsController } from './attendance-records.controller';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [AttendanceRecordsController],
  providers: [AttendanceRecordsService, AttendanceAutoAbsentService],
  exports: [AttendanceRecordsService],
})
export class AttendanceRecordsModule {}

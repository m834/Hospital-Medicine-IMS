import { Module } from '@nestjs/common';
import { BiometricDevicesModule } from './biometric-devices/biometric-devices.module';
import { BiometricEnrollmentsModule } from './biometric-enrollments/biometric-enrollments.module';
import { AttendanceRecordsModule } from './attendance-records/attendance-records.module';

@Module({
  imports: [
    BiometricDevicesModule,
    BiometricEnrollmentsModule,
    AttendanceRecordsModule,
    // ShiftsModule (Task 9),
    // LeavesModule (Task 10),
    // DeviceSyncModule (Task 11-12),
  ],
  exports: [BiometricDevicesModule, BiometricEnrollmentsModule, AttendanceRecordsModule],
})
export class AttendanceModule {}

import { Module } from '@nestjs/common';
import { BiometricDevicesModule } from './biometric-devices/biometric-devices.module';

@Module({
  imports: [
    BiometricDevicesModule,
    // BiometricEnrollmentsModule (Task 7),
    // AttendanceRecordsModule (Task 8),
    // ShiftsModule (Task 9),
    // LeavesModule (Task 10),
    // DeviceSyncModule (Task 11-12),
  ],
  exports: [BiometricDevicesModule],
})
export class AttendanceModule {}

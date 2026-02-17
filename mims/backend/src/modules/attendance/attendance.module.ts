import { Module } from '@nestjs/common';
import { BiometricDevicesModule } from './biometric-devices/biometric-devices.module';
import { BiometricEnrollmentsModule } from './biometric-enrollments/biometric-enrollments.module';

@Module({
  imports: [
    BiometricDevicesModule,
    BiometricEnrollmentsModule,
    // BiometricEnrollmentsModule (Task 7),
    // AttendanceRecordsModule (Task 8),
    // ShiftsModule (Task 9),
    // LeavesModule (Task 10),
    // DeviceSyncModule (Task 11-12),
  ],
  exports: [BiometricDevicesModule, BiometricEnrollmentsModule],
})
export class AttendanceModule {}

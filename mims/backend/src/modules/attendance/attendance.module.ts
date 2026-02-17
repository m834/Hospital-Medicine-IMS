import { Module } from '@nestjs/common';
import { BiometricDevicesModule } from './biometric-devices/biometric-devices.module';
import { BiometricEnrollmentsModule } from './biometric-enrollments/biometric-enrollments.module';
import { AttendanceRecordsModule } from './attendance-records/attendance-records.module';
import { ShiftsModule } from './shifts/shifts.module';
import { LeavesModule } from './leaves/leaves.module';

@Module({
  imports: [
    BiometricDevicesModule,
    BiometricEnrollmentsModule,
    AttendanceRecordsModule,
    ShiftsModule,
    LeavesModule,
    // DeviceSyncModule (Task 11-12),
  ],
  exports: [BiometricDevicesModule, BiometricEnrollmentsModule, AttendanceRecordsModule, ShiftsModule, LeavesModule],
})
export class AttendanceModule {}

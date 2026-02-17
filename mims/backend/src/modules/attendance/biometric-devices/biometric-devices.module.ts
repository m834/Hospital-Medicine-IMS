import { Module } from '@nestjs/common';
import { BiometricDevicesService } from './biometric-devices.service';
import { BiometricDevicesController } from './biometric-devices.controller';
import { DatabaseModule } from '@/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BiometricDevicesController],
  providers: [BiometricDevicesService],
  exports: [BiometricDevicesService],
})
export class BiometricDevicesModule {}

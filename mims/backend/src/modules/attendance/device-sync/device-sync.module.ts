import { Module } from '@nestjs/common';
import { DeviceSyncService } from './device-sync.service';
import { DeviceSyncController } from './device-sync.controller';

@Module({
  controllers: [DeviceSyncController],
  providers: [DeviceSyncService],
  exports: [DeviceSyncService],
})
export class DeviceSyncModule {}

import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { LicenseService } from './license.service';

@Global()
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [LicenseService],
  exports: [LicenseService],
})
export class LicenseModule {}

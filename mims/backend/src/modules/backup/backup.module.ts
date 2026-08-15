import { Module } from '@nestjs/common';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';
import { RestoreService } from './restore.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [BackupController],
  providers: [BackupService, RestoreService],
  exports: [BackupService],
})
export class BackupModule {}

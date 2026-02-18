import { Module } from '@nestjs/common';
import { AuditLogViewerService } from '../services/audit-log-viewer.service';
import { AuditLogController } from '../controllers/audit-log.controller';

@Module({
  providers: [AuditLogViewerService],
  controllers: [AuditLogController],
  exports: [AuditLogViewerService],
})
export class AuditModule {}

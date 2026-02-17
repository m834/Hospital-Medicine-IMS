import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentHospital } from '@/common/decorators/current-hospital.decorator';
import { DeviceSyncService } from './device-sync.service';
import {
  TriggerDeviceSyncDto,
  ProcessAttendanceLogsDto,
  QuerySyncLogsDto,
  ConfigureSyncSettingsDto,
  RetrySyncDto,
  ResolveSyncErrorDto,
  BatchDeviceSyncDto,
  SyncStatisticsQueryDto,
  VerifyLogIntegrityDto,
  UpdateDeviceSyncStatusDto,
} from './dto/device-sync.dto';

@ApiTags('Device Synchronization')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('device-sync')
export class DeviceSyncController {
  constructor(private deviceSyncService: DeviceSyncService) {}

  /**
   * SYNC OPERATIONS
   */

  @ApiOperation({ summary: 'Trigger device synchronization' })
  @Post('trigger')
  @HttpCode(HttpStatus.CREATED)
  async triggerSync(
    @CurrentHospital() hospitalId: string,
    @Body() dto: TriggerDeviceSyncDto,
  ) {
    return this.deviceSyncService.triggerDeviceSync(hospitalId, dto);
  }

  @ApiOperation({ summary: 'Get sync log by ID' })
  @Get('logs/:syncLogId')
  @HttpCode(HttpStatus.OK)
  async getSyncLog(
    @CurrentHospital() hospitalId: string,
    @Param('syncLogId') syncLogId: string,
  ) {
    return this.deviceSyncService.getSyncLogById(hospitalId, syncLogId);
  }

  @ApiOperation({ summary: 'Query sync logs with filtering' })
  @Get('logs')
  @HttpCode(HttpStatus.OK)
  async querySyncLogs(
    @CurrentHospital() hospitalId: string,
    @Query() query: QuerySyncLogsDto,
  ) {
    return this.deviceSyncService.querySyncLogs(hospitalId, query);
  }

  @ApiOperation({ summary: 'Process attendance logs from device' })
  @Post('process-logs')
  @HttpCode(HttpStatus.CREATED)
  async processLogs(
    @CurrentHospital() hospitalId: string,
    @Body() dto: ProcessAttendanceLogsDto,
  ) {
    return this.deviceSyncService.processAttendanceLogs(hospitalId, dto);
  }

  @ApiOperation({ summary: 'Get attendance logs from sync' })
  @Get('logs/:syncLogId/logs')
  @HttpCode(HttpStatus.OK)
  async getAttendanceLogs(
    @CurrentHospital() hospitalId: string,
    @Param('syncLogId') syncLogId: string,
  ) {
    return this.deviceSyncService.getAttendanceLogsFromSync(hospitalId, syncLogId);
  }

  /**
   * SYNC CONFIGURATION
   */

  @ApiOperation({ summary: 'Configure device sync settings' })
  @Post('configure')
  @HttpCode(HttpStatus.OK)
  async configureSyncSettings(
    @CurrentHospital() hospitalId: string,
    @Body() dto: ConfigureSyncSettingsDto,
  ) {
    return this.deviceSyncService.configureSyncSettings(hospitalId, dto);
  }

  @ApiOperation({ summary: 'Retry failed sync' })
  @Post('retry')
  @HttpCode(HttpStatus.OK)
  async retrySync(
    @CurrentHospital() hospitalId: string,
    @Body() dto: RetrySyncDto,
  ) {
    return this.deviceSyncService.retrySync(hospitalId, dto);
  }

  @ApiOperation({ summary: 'Resolve sync error' })
  @Post('resolve-error')
  @HttpCode(HttpStatus.OK)
  async resolveError(
    @CurrentHospital() hospitalId: string,
    @Body() dto: ResolveSyncErrorDto,
  ) {
    return this.deviceSyncService.resolveSyncError(hospitalId, dto);
  }

  /**
   * BATCH OPERATIONS
   */

  @ApiOperation({ summary: 'Batch synchronize multiple devices' })
  @Post('batch-sync')
  @HttpCode(HttpStatus.CREATED)
  async batchSync(
    @CurrentHospital() hospitalId: string,
    @Body() dto: BatchDeviceSyncDto,
  ) {
    return this.deviceSyncService.batchDeviceSync(hospitalId, dto);
  }

  /**
   * STATISTICS & MONITORING
   */

  @ApiOperation({ summary: 'Get sync statistics' })
  @Get('statistics/summary')
  @HttpCode(HttpStatus.OK)
  async getSyncStatistics(
    @CurrentHospital() hospitalId: string,
    @Query() query: SyncStatisticsQueryDto,
  ) {
    return this.deviceSyncService.getSyncStatistics(hospitalId, query);
  }

  @ApiOperation({ summary: 'Verify log integrity' })
  @Post('verify-integrity')
  @HttpCode(HttpStatus.OK)
  async verifyIntegrity(
    @CurrentHospital() hospitalId: string,
    @Body() dto: VerifyLogIntegrityDto,
  ) {
    return this.deviceSyncService.verifyLogIntegrity(hospitalId, dto);
  }

  /**
   * DEVICE STATUS MANAGEMENT
   */

  @ApiOperation({ summary: 'Update device sync status' })
  @Put('devices/:deviceId/sync-status')
  @HttpCode(HttpStatus.OK)
  async updateDeviceSyncStatus(
    @CurrentHospital() hospitalId: string,
    @Param('deviceId') deviceId: string,
    @Body() dto: UpdateDeviceSyncStatusDto,
  ) {
    return this.deviceSyncService.updateDeviceSyncStatus(hospitalId, dto);
  }

  /**
   * LOG PROCESSING
   */

  @ApiOperation({ summary: 'Get unprocessed attendance logs' })
  @Get('unprocessed-logs')
  @HttpCode(HttpStatus.OK)
  async getUnprocessedLogs(
    @CurrentHospital() hospitalId: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return this.deviceSyncService.getUnprocessedLogs(hospitalId, deviceId);
  }

  @ApiOperation({ summary: 'Mark logs as processed' })
  @Post('mark-processed')
  @HttpCode(HttpStatus.OK)
  async markLogsAsProcessed(
    @Body() dto: { logIds: string[] },
  ) {
    return this.deviceSyncService.markLogsAsProcessed(dto.logIds);
  }
}

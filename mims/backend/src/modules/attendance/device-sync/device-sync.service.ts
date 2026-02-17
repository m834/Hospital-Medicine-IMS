import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { DeviceSyncLog, BiometricDevice, AttendanceLog } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
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

@Injectable()
export class DeviceSyncService {
  constructor(private prisma: PrismaService) {}

  /**
   * Trigger device synchronization
   */
  async triggerDeviceSync(hospitalId: string, dto: TriggerDeviceSyncDto): Promise<DeviceSyncLog> {
    // Verify device exists
    const device = await this.prisma.biometricDevice.findFirst({
      where: { id: dto.deviceId, hospitalId },
    });

    if (!device) {
      throw new NotFoundException(`Device not found`);
    }

    if (device.status !== 'ACTIVE') {
      throw new BadRequestException(`Device is not active`);
    }

    const syncLog = await this.prisma.deviceSyncLog.create({
      data: {
        hospitalId,
        deviceId: dto.deviceId,
        syncStartTime: new Date(),
        status: 'PENDING',
      },
    });

    // In a real implementation, this would call the device API
    // For now, we'll return the sync log and let it be processed later
    return syncLog;
  }

  /**
   * Get sync log by ID
   */
  async getSyncLogById(hospitalId: string, syncLogId: string): Promise<DeviceSyncLog> {
    const syncLog = await this.prisma.deviceSyncLog.findFirst({
      where: {
        id: syncLogId,
        hospitalId,
      },
      include: {
        device: true,
      },
    });

    if (!syncLog) {
      throw new NotFoundException(`Sync log not found`);
    }

    return syncLog;
  }

  /**
   * Query sync logs with filtering
   */
  async querySyncLogs(hospitalId: string, query?: QuerySyncLogsDto): Promise<DeviceSyncLog[]> {
    const { deviceId, status, fromDate, toDate, skip = 0, take = 10 } = query || {};

    return this.prisma.deviceSyncLog.findMany({
      where: {
        hospitalId,
        ...(deviceId && { deviceId }),
        ...(status && { status }),
        ...(fromDate &&
          toDate && {
            syncStartTime: { gte: new Date(fromDate) },
            syncEndTime: { lte: new Date(toDate) },
          }),
      },
      skip,
      take,
      orderBy: { syncStartTime: 'desc' },
      include: { device: true },
    });
  }

  /**
   * Process attendance logs from device
   */
  async processAttendanceLogs(hospitalId: string, dto: ProcessAttendanceLogsDto): Promise<any> {
    // Verify device exists
    const device = await this.prisma.biometricDevice.findFirst({
      where: { id: dto.deviceId, hospitalId },
    });

    if (!device) {
      throw new NotFoundException(`Device not found`);
    }

    const syncLog = await this.prisma.deviceSyncLog.create({
      data: {
        hospitalId,
        deviceId: dto.deviceId,
        syncStartTime: new Date(),
        logsReceived: dto.logs.length,
        status: 'PENDING',
      },
    });

    let processed = 0;
    let skipped = 0;
    let errors = 0;
    const processedLogIds: string[] = [];

    // Map DTO logType to database LogType enum
    const logTypeMap: Record<string, 'CHECK_IN' | 'CHECK_OUT' | 'ENTRY' | 'EXIT' | 'UNKNOWN'> = {
      'CHECKIN': 'CHECK_IN',
      'CHECK_IN': 'CHECK_IN',
      'CHECKOUT': 'CHECK_OUT',
      'CHECK_OUT': 'CHECK_OUT',
      'ENTRY': 'ENTRY',
      'EXIT': 'EXIT',
      'VERIFY': 'CHECK_IN',
      'UNKNOWN': 'UNKNOWN',
    };

    // Pre-load all enrollments for this device to match logs
    const enrollments = await this.prisma.biometricEnrollment.findMany({
      where: {
        deviceId: dto.deviceId,
        isActive: true,
      },
      include: { user: true },
    });

    // Create a map of enrollments by enrollmentType for quick lookup
    const enrollmentsByType = new Map<string, typeof enrollments>();
    for (const enrollment of enrollments) {
      const key = enrollment.enrollmentType;
      if (!enrollmentsByType.has(key)) {
        enrollmentsByType.set(key, []);
      }
      enrollmentsByType.get(key)!.push(enrollment);
    }

    for (const logEntry of dto.logs) {
      try {
        // For now, we'll use a simple approach:
        // Match the first enrollment with active status for this device
        // In production, you'd have a better mapping between device's local employee ID and our system
        let enrollment = enrollments[0];

        // If we have the employeeId from the device, try to find a more specific match
        // by checking if the enrollmentType name contains a reference to it
        // Or use any active enrollment (simplified approach for now)
        if (!enrollment) {
          errors++;
          continue;
        }

        // Check if log already exists for this user at this time
        const logDate = new Date(logEntry.timestamp * 1000);
        const existing = await this.prisma.attendanceLog.findFirst({
          where: {
            deviceId: dto.deviceId,
            userId: enrollment.userId,
            logTime: logDate,
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Map logType from device format to database format
        const dbLogType = logTypeMap[logEntry.logType] || 'UNKNOWN';

        // Determine verification method from enrollment type
        let verificationMethod: 'FINGERPRINT' | 'FACE' | 'RFID' | 'MANUAL' | 'UNKNOWN' = 'FINGERPRINT';
        if (enrollment.enrollmentType.includes('FACE')) {
          verificationMethod = 'FACE';
        } else if (enrollment.enrollmentType.includes('RFID')) {
          verificationMethod = 'RFID';
        }

        // Create attendance log
        const attendanceLog = await this.prisma.attendanceLog.create({
          data: {
            hospitalId,
            deviceId: dto.deviceId,
            userId: enrollment.userId,
            enrollmentId: enrollment.id,
            logTime: logDate,
            logType: dbLogType,
            verificationMethod,
            verificationScore: 95, // Default high score for device-recorded logs
            isProcessed: false,
          },
        });

        processedLogIds.push(attendanceLog.id);
        processed++;

        // Update device last sync time
        await this.prisma.biometricDevice.update({
          where: { id: dto.deviceId },
          data: { lastSyncTime: new Date() },
        });
      } catch (error) {
        errors++;
      }
    }

    // Update sync log with results
    const syncEndTime = new Date();
    const durationMs = syncEndTime.getTime() - syncLog.syncStartTime.getTime();

    const updatedSyncLog = await this.prisma.deviceSyncLog.update({
      where: { id: syncLog.id },
      data: {
        syncEndTime,
        durationMs,
        logsProcessed: processed,
        logsSkipped: skipped,
        logsErrors: errors,
        status: errors > 0 && processed === 0 ? 'FAILURE' : (errors > 0 ? 'PARTIAL' : 'SUCCESS'),
        lastLogTime: dto.logs.length > 0 ? new Date(Math.max(...dto.logs.map((l) => l.timestamp * 1000))) : null,
      },
    });

    return {
      syncLogId: updatedSyncLog.id,
      total: dto.logs.length,
      processed,
      skipped,
      errors,
      processedLogIds,
      duration: durationMs,
      status: updatedSyncLog.status,
    };
  }

  /**
   * Get attendance logs from sync
   */
  async getAttendanceLogsFromSync(hospitalId: string, syncLogId: string): Promise<AttendanceLog[]> {
    const syncLog = await this.getSyncLogById(hospitalId, syncLogId);

    return this.prisma.attendanceLog.findMany({
      where: {
        hospitalId,
        deviceId: syncLog.deviceId,
        logTime: {
          gte: syncLog.syncStartTime,
          lte: syncLog.syncEndTime || new Date(),
        },
      },
      orderBy: { logTime: 'asc' },
    });
  }

  /**
   * Configure device sync settings
   */
  async configureSyncSettings(hospitalId: string, dto: ConfigureSyncSettingsDto): Promise<any> {
    // Verify device exists
    await this.prisma.biometricDevice.findFirstOrThrow({
      where: { id: dto.deviceId, hospitalId },
    });

    // Store sync settings in config
    const configEntries = [];

    if (dto.syncIntervalMinutes !== undefined) {
      configEntries.push({
        hospitalId,
        configKey: `sync_interval_${dto.deviceId}`,
        configValue: dto.syncIntervalMinutes.toString(),
        dataType: 'number',
        description: `Sync interval for device ${dto.deviceId} in minutes`,
      });
    }

    if (dto.enableAutoSync !== undefined) {
      configEntries.push({
        hospitalId,
        configKey: `auto_sync_${dto.deviceId}`,
        configValue: dto.enableAutoSync.toString(),
        dataType: 'boolean',
        description: `Auto sync enabled for device ${dto.deviceId}`,
      });
    }

    if (dto.maxRetries !== undefined) {
      configEntries.push({
        hospitalId,
        configKey: `max_retries_${dto.deviceId}`,
        configValue: dto.maxRetries.toString(),
        dataType: 'number',
        description: `Max retries for device ${dto.deviceId}`,
      });
    }

    // Upsert configurations
    for (const entry of configEntries) {
      await this.prisma.attendanceConfig.upsert({
        where: {
          hospitalId_configKey: {
            hospitalId: entry.hospitalId,
            configKey: entry.configKey,
          },
        },
        create: entry,
        update: { configValue: entry.configValue },
      });
    }

    return { success: true, message: 'Sync settings configured', deviceId: dto.deviceId };
  }

  /**
   * Retry failed sync
   */
  async retrySync(hospitalId: string, dto: RetrySyncDto): Promise<DeviceSyncLog> {
    const syncLog = await this.getSyncLogById(hospitalId, dto.syncLogId);

    if (syncLog.status !== 'FAILURE') {
      throw new BadRequestException('Only failed syncs can be retried');
    }

    // Create new sync log for retry
    const newSyncLog = await this.prisma.deviceSyncLog.create({
      data: {
        hospitalId,
        deviceId: syncLog.deviceId,
        syncStartTime: new Date(),
        status: 'PENDING',
      },
    });

    return newSyncLog;
  }

  /**
   * Resolve sync error
   */
  async resolveSyncError(hospitalId: string, dto: ResolveSyncErrorDto): Promise<DeviceSyncLog> {
    const syncLog = await this.getSyncLogById(hospitalId, dto.syncLogId);

    const updated = await this.prisma.deviceSyncLog.update({
      where: { id: syncLog.id },
      data: {
        status: 'SUCCESS',
        errorMessage: dto.resolution,
      },
    });

    // Optionally retry the sync
    if (dto.retrySync) {
      await this.retrySync(hospitalId, { syncLogId: dto.syncLogId, reason: dto.resolution });
    }

    return updated;
  }

  /**
   * Batch device sync
   */
  async batchDeviceSync(hospitalId: string, dto: BatchDeviceSyncDto): Promise<any> {
    const results = [];

    for (const deviceId of dto.deviceIds) {
      try {
        const syncLog = await this.triggerDeviceSync(hospitalId, {
          deviceId,
          fullSync: dto.fullSync,
          reason: dto.reason,
        });

        results.push({ deviceId, success: true, syncLogId: syncLog.id });
      } catch (error) {
        results.push({ deviceId, success: false, error: error.message });
      }
    }

    return {
      total: dto.deviceIds.length,
      successful: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Get sync statistics
   */
  async getSyncStatistics(hospitalId: string, query?: SyncStatisticsQueryDto): Promise<any> {
    const fromDate = query?.fromDate ? new Date(query.fromDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = query?.toDate ? new Date(query.toDate) : new Date();

    const syncLogs = await this.prisma.deviceSyncLog.findMany({
      where: {
        hospitalId,
        ...(query?.deviceId && { deviceId: query.deviceId }),
        syncStartTime: { gte: fromDate, lte: toDate },
      },
      include: { device: true },
    });

    const successful = syncLogs.filter((s) => s.status === 'SUCCESS').length;
    const failed = syncLogs.filter((s) => s.status === 'FAILURE').length;
    const pending = syncLogs.filter((s) => s.status === 'PENDING').length;

    const totalLogsProcessed = syncLogs.reduce((sum, s) => sum + s.logsProcessed, 0);
    const totalLogsSkipped = syncLogs.reduce((sum, s) => sum + s.logsSkipped, 0);
    const totalLogsErrors = syncLogs.reduce((sum, s) => sum + s.logsErrors, 0);

    const avgDuration = syncLogs.filter((s) => s.durationMs).reduce((sum, s) => sum + (s.durationMs || 0), 0) / syncLogs.filter((s) => s.durationMs).length || 0;

    return {
      period: { from: fromDate, to: toDate },
      totalSyncs: syncLogs.length,
      successful,
      failed,
      pending,
      totalLogsProcessed,
      totalLogsSkipped,
      totalLogsErrors,
      averageDurationMs: Math.round(avgDuration),
      successRate: syncLogs.length > 0 ? Math.round((successful / syncLogs.length) * 100) : 0,
      byDevice: this.groupByDevice(syncLogs),
    };
  }

  /**
   * Verify log integrity
   */
  async verifyLogIntegrity(hospitalId: string, dto: VerifyLogIntegrityDto): Promise<any> {
    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);

    const logs = await this.prisma.attendanceLog.findMany({
      where: {
        hospitalId,
        deviceId: dto.deviceId,
        logTime: { gte: fromDate, lte: toDate },
      },
    });

    const unprocessed = logs.filter((l) => !l.isProcessed);
    const processed = logs.filter((l) => l.isProcessed);

    return {
      deviceId: dto.deviceId,
      period: { from: fromDate, to: toDate },
      totalLogs: logs.length,
      processedLogs: processed.length,
      unprocessedLogs: unprocessed.length,
      integrity: unprocessed.length === 0 ? 'OK' : 'PENDING_PROCESSING',
      unprocessedLogIds: unprocessed.map((l) => l.id),
    };
  }

  /**
   * Update device sync status
   */
  async updateDeviceSyncStatus(hospitalId: string, dto: UpdateDeviceSyncStatusDto): Promise<BiometricDevice> {
    // Verify device exists
    const device = await this.prisma.biometricDevice.findFirst({
      where: { id: dto.deviceId, hospitalId },
    });

    if (!device) {
      throw new NotFoundException(`Device not found`);
    }

    // Map DeviceOperationStatus to DeviceStatus
    const statusMap: Record<string, 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'OFFLINE' | 'DISABLED'> = {
      'PENDING': 'ACTIVE',
      'SUCCESS': 'ACTIVE',
      'FAILURE': 'OFFLINE',
      'PARTIAL': 'ACTIVE',
      'TIMEOUT': 'OFFLINE',
    };

    const mappedStatus = statusMap[dto.status];
    if (!mappedStatus) {
      throw new BadRequestException(`Invalid device operation status`);
    }

    return this.prisma.biometricDevice.update({
      where: { id: dto.deviceId },
      data: {
        status: mappedStatus,
      },
    });
  }

  /**
   * Get unprocessed logs
   */
  async getUnprocessedLogs(hospitalId: string, deviceId?: string): Promise<AttendanceLog[]> {
    return this.prisma.attendanceLog.findMany({
      where: {
        hospitalId,
        isProcessed: false,
        ...(deviceId && { deviceId }),
      },
      orderBy: { logTime: 'asc' },
      take: 1000, // Limit to prevent memory issues
    });
  }

  /**
   * Mark logs as processed
   */
  async markLogsAsProcessed(logIds: string[]): Promise<any> {
    const result = await this.prisma.attendanceLog.updateMany({
      where: { id: { in: logIds } },
      data: { isProcessed: true },
    });

    return { processed: result.count };
  }

  /**
   * Helper: Group by device
   */
  private groupByDevice(syncLogs: any[]): any {
    const grouped = {};

    syncLogs.forEach((log) => {
      const deviceId = log.deviceId;
      if (!grouped[deviceId]) {
        grouped[deviceId] = { syncs: 0, logsProcessed: 0, errors: 0 };
      }
      grouped[deviceId].syncs += 1;
      grouped[deviceId].logsProcessed += log.logsProcessed;
      grouped[deviceId].errors += log.logsErrors;
    });

    return grouped;
  }
}

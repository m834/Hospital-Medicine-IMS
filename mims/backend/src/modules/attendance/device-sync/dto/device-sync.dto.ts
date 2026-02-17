import {
  IsString,
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  IsEnum,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeviceOperationStatus } from '@prisma/client';

/**
 * Trigger device synchronization
 */
export class TriggerDeviceSyncDto {
  @IsUUID()
  @IsNotEmpty()
  deviceId: string;

  @IsBoolean()
  @IsOptional()
  fullSync?: boolean;

  @IsDateString()
  @IsOptional()
  syncFromTime?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * Process attendance logs from device
 */
export class ProcessAttendanceLogsDto {
  @IsUUID()
  @IsNotEmpty()
  deviceId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttendanceLogEntry)
  logs: AttendanceLogEntry[];

  @IsDateString()
  @IsNotEmpty()
  syncTime: string;
}

export class AttendanceLogEntry {
  @IsNumber()
  @IsNotEmpty()
  logId: number;

  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsNumber()
  @IsNotEmpty()
  timestamp: number; // Unix timestamp

  @IsString()
  @IsNotEmpty()
  logType: string; // 'CHECKIN' | 'CHECKOUT' | 'VERIFY'

  @IsNumber()
  @IsOptional()
  temperature?: number;

  @IsString()
  @IsOptional()
  biometricType?: string;

  @IsString()
  @IsOptional()
  deviceSN?: string;

  @IsNumber()
  @IsOptional()
  workCode?: number;
}

/**
 * Query sync logs
 */
export class QuerySyncLogsDto {
  @IsUUID()
  @IsOptional()
  deviceId?: string;

  @IsEnum(DeviceOperationStatus)
  @IsOptional()
  status?: DeviceOperationStatus;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  skip?: number = 0;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  take?: number = 10;
}

/**
 * Configure sync settings
 */
export class ConfigureSyncSettingsDto {
  @IsUUID()
  @IsNotEmpty()
  deviceId: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(1440)
  syncIntervalMinutes?: number;

  @IsBoolean()
  @IsOptional()
  enableAutoSync?: boolean;

  @IsBoolean()
  @IsOptional()
  enableErrorNotification?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(10)
  maxRetries?: number;

  @IsNumber()
  @IsOptional()
  @Min(30)
  @Max(300)
  retryIntervalSeconds?: number;
}

/**
 * Retry failed sync
 */
export class RetrySyncDto {
  @IsUUID()
  @IsNotEmpty()
  syncLogId: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * Resolve sync error
 */
export class ResolveSyncErrorDto {
  @IsUUID()
  @IsNotEmpty()
  syncLogId: string;

  @IsString()
  @IsNotEmpty()
  resolution: string;

  @IsBoolean()
  @IsOptional()
  retrySync?: boolean;
}

/**
 * Batch device sync
 */
export class BatchDeviceSyncDto {
  @IsArray()
  @IsUUID('all', { each: true })
  deviceIds: string[];

  @IsBoolean()
  @IsOptional()
  fullSync?: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * Get sync statistics
 */
export class SyncStatisticsQueryDto {
  @IsUUID()
  @IsOptional()
  deviceId?: string;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;
}

/**
 * Verify log integrity
 */
export class VerifyLogIntegrityDto {
  @IsUUID()
  @IsNotEmpty()
  deviceId: string;

  @IsDateString()
  @IsNotEmpty()
  fromDate: string;

  @IsDateString()
  @IsNotEmpty()
  toDate: string;
}

/**
 * Update device sync status
 */
export class UpdateDeviceSyncStatusDto {
  @IsUUID()
  @IsNotEmpty()
  deviceId: string;

  @IsEnum(DeviceOperationStatus)
  @IsNotEmpty()
  status: DeviceOperationStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

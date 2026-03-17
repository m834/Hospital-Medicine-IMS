/**
 * Copyright (c) 2026 Code Hustlers. All rights reserved.
 * M-IMS — Hospital Medicine Inventory Management System
 * Unauthorized use or distribution is strictly prohibited.
 */
  import{IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export enum ThreatSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}
import { Type } from 'class-transformer';

export class ThreatAlertDto {
  id: string;
  hospitalId: string;
  userId?: string;
  alertType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  actionRequired: boolean;
  read: boolean;
  createdAt: Date;
  dismissedAt?: Date;
}

export class CreateThreatAlertDto {
  @IsString()
  hospitalId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  alertType: string;

  @IsEnum(ThreatSeverity)
  severity: ThreatSeverity;

  @IsString()
  description: string;

  @IsBoolean()
  requiresAction: boolean;
}

export class ThreatAlertFilterDto {
  @IsOptional()
  @IsEnum(ThreatSeverity)
  severity?: ThreatSeverity;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unreadOnly?: boolean;
}

export class PaginatedAlertsDto {
  alerts: ThreatAlertDto[];
  total: number;
  limit: number;
  offset: number;
}

export class AlertSummaryDto {
  unreadCount: number;
  unreadCritical: number;
  unreadHigh: number;
  unreadMedium: number;
  requiresAction: number;
}

export class ThreatSummaryDto {
  criticalAlerts: number;
  highAlerts: number;
  mediumAlerts: number;
  lowAlerts: number;
  totalAlerts: number;
  requiresImmediateAction: number;
}

export class FailedLoginAttemptDto {
  @IsString()
  userId: string;

  @IsString()
  ipAddress: string;

  @IsString()
  userAgent: string;

  @IsString()
  reason: string;
}

export class BulkOperationDetectionDto {
  @IsString()
  hospitalId: string;

  @IsOptional()
  @IsString()
  userId?: string;
}

export class PermissionEscalationCheckDto {
  @IsString()
  hospitalId: string;

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(1440)
  @Type(() => Number)
  lookbackMinutes?: number = 30;
}

export class SuspiciousIPCheckDto {
  @IsString()
  hospitalId: string;

  @IsString()
  userId: string;

  @IsString()
  ipAddress: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  @Type(() => Number)
  lookbackHours?: number = 24;
}

export class MarkAlertAsReadDto {
  @IsString()
  alertId: string;
}

export class DismissAlertDto {
  @IsString()
  alertId: string;
}

export class ComprehensiveThreatScanDto {
  @IsString()
  hospitalId: string;
}

export class AlertQueryDto {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(500)
  limit?: number = 50;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsEnum(ThreatSeverity)
  severity?: ThreatSeverity;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unreadOnly?: boolean;
}

import { IsString, IsNumber, IsDate, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * ============ Dashboard Metrics DTOs ============
 */

export class TimeRangeDto {
  @ApiProperty({ example: '2026-02-18T00:00:00Z' })
  start: Date;

  @ApiProperty({ example: '2026-02-19T00:00:00Z' })
  end: Date;

  @ApiPropertyOptional({ example: 24 })
  hoursBack?: number;
}

export class ThreatSeverityDistributionDto {
  @ApiProperty({ example: 5 })
  CRITICAL: number;

  @ApiProperty({ example: 12 })
  HIGH: number;

  @ApiProperty({ example: 8 })
  MEDIUM: number;

  @ApiProperty({ example: 3 })
  LOW: number;
}

export class ThreatTypeDistributionDto {
  @ApiProperty({ example: 5 })
  FAILED_LOGIN_ATTEMPTS: number;

  @ApiProperty({ example: 3 })
  BULK_OPERATIONS: number;

  @ApiProperty({ example: 2 })
  PERMISSION_ESCALATION: number;

  @ApiProperty({ example: 8 })
  SUSPICIOUS_IP: number;
}

export class AuditActionCountsDto {
  @ApiProperty({ example: 150 })
  CREATE: number;

  @ApiProperty({ example: 85 })
  UPDATE: number;

  @ApiProperty({ example: 12 })
  DELETE: number;
}

export class DashboardMetricsDto {
  @ApiProperty()
  hospitalId: string;

  @ApiProperty()
  timeRange: TimeRangeDto;

  @ApiProperty({ example: 28 })
  totalThreats: number;

  @ApiProperty({ example: 28 })
  totalAlerts: number;

  @ApiProperty({ example: 5 })
  unreadAlerts: number;

  @ApiProperty()
  threatsBySeverity: ThreatSeverityDistributionDto;

  @ApiProperty()
  threatsByType: ThreatTypeDistributionDto;

  @ApiProperty({ example: 247 })
  totalAuditActions: number;

  @ApiProperty()
  auditActionsByType: AuditActionCountsDto;

  @ApiProperty({ example: 45 })
  uniqueUsersActive: number;

  @ApiProperty({ enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] })
  overallSeverityLevel: string;

  @ApiProperty({ example: 5 })
  criticalThreatCount: number;

  @ApiProperty({ example: 8 })
  alertsRequiringAction: number;

  @ApiProperty({ example: 3 })
  dismissedAlerts: number;
}

/**
 * ============ Threat Trend DTOs ============
 */

export class SeverityDistributionByDayDto {
  [day: string]: ThreatSeverityDistributionDto;
}

export class ThreatTypeDistributionByDayDto {
  [day: string]: ThreatTypeDistributionDto;
}

export class ThreatTrendDto {
  @ApiProperty()
  hospitalId: string;

  @ApiProperty({ example: 7 })
  daysBack: number;

  @ApiProperty()
  period: { start: Date; end: Date };

  @ApiProperty({ example: 150 })
  totalThreatsInPeriod: number;

  @ApiProperty({
    example: {
      '2026-02-18': 25,
      '2026-02-17': 20,
      '2026-02-16': 15,
    },
  })
  dailyThreatCount: { [day: string]: number };

  @ApiProperty()
  dailySeverityDistribution: SeverityDistributionByDayDto;

  @ApiProperty()
  dailyTypeDistribution: ThreatTypeDistributionByDayDto;

  @ApiProperty({ example: 21.4 })
  averageThreatsPerDay: number;

  @ApiProperty({ example: '2026-02-18' })
  peakThreatDay: string;

  @ApiProperty({ example: 45 })
  peakThreatCount: number;

  @ApiProperty({ enum: ['INCREASING', 'DECREASING', 'STABLE'] })
  trendDirection: string;
}

/**
 * ============ Compliance Status DTOs ============
 */

export class ComplianceCheckDto {
  @ApiProperty({ example: true })
  compliant: boolean;

  @ApiProperty({ example: '0 records potentially unencrypted' })
  details: string;
}

export class ComplianceChecksDto {
  @ApiProperty()
  dataEncryption: ComplianceCheckDto;

  @ApiProperty()
  authenticationSecurity: ComplianceCheckDto;

  @ApiProperty()
  accessControl: ComplianceCheckDto;

  @ApiProperty()
  suspiciousActivityMonitoring: ComplianceCheckDto;
}

export class ComplianceStatusDto {
  @ApiProperty()
  hospitalId: string;

  @ApiProperty({ example: 92 })
  complianceScore: number;

  @ApiProperty({ enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'] })
  complianceLevel: string;

  @ApiProperty()
  period: { start: Date; end: Date };

  @ApiProperty()
  checks: ComplianceChecksDto;

  @ApiProperty({ example: [] })
  recommendations: string[];
}

/**
 * ============ Encryption Status DTOs ============
 */

export class ComplianceRequirementsDto {
  @ApiProperty()
  algorithm: string;

  @ApiProperty()
  keyRotation: string;

  @ApiProperty()
  dataClassification: string;
}

export class EncryptionStatusDto {
  @ApiProperty()
  hospitalId: string;

  @ApiProperty({ example: 'AES-256-GCM' })
  encryptionAlgorithm: string;

  @ApiProperty({ example: 1500 })
  encryptedRecords: number;

  @ApiProperty({ example: 100 })
  encryptionCoverage: number;

  @ApiProperty()
  lastKeyRotation: Date;

  @ApiProperty()
  nextKeyRotationDate: Date;

  @ApiProperty({ example: 30 })
  daysUntilNextRotation: number;

  @ApiProperty({ enum: ['OK', 'WARNING', 'URGENT'] })
  keyRotationStatus: string;

  @ApiProperty({ example: ['fingerprintData', 'faceData'] })
  encryptedFieldsTypes: string[];

  @ApiProperty()
  complianceRequirements: ComplianceRequirementsDto;
}

/**
 * ============ Alert Distribution DTOs ============
 */

export class AlertCountsDto {
  @ApiProperty({ example: 5 })
  CRITICAL: number;

  @ApiProperty({ example: 8 })
  HIGH: number;

  @ApiProperty({ example: 10 })
  MEDIUM: number;

  @ApiProperty({ example: 5 })
  LOW: number;
}

export class AlertTypeCountsDto {
  @ApiProperty({ example: 5 })
  FAILED_LOGIN_ATTEMPTS: number;

  @ApiProperty({ example: 3 })
  BULK_OPERATIONS: number;

  @ApiProperty({ example: 8 })
  PERMISSION_ESCALATION: number;

  @ApiProperty({ example: 12 })
  SUSPICIOUS_IP: number;
}

export class AlertDistributionDto {
  @ApiProperty()
  hospitalId: string;

  @ApiProperty()
  period: { start: Date; end: Date };

  @ApiProperty({ example: 28 })
  totalAlerts: number;

  @ApiProperty({ example: 23 })
  readAlerts: number;

  @ApiProperty({ example: 5 })
  unreadAlerts: number;

  @ApiProperty({ example: 3 })
  dismissedAlerts: number;

  @ApiProperty({ example: 8 })
  requiresActionCount: number;

  @ApiProperty()
  bySeverity: AlertCountsDto;

  @ApiProperty()
  byType: AlertTypeCountsDto;
}

/**
 * ============ Audit Activity DTOs ============
 */

export class RecentActionDto {
  @ApiProperty({ example: 'CREATE' })
  action: string;

  @ApiProperty({ example: 'BiometricEnrollment' })
  entityType: string;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty({ example: 'user-123' })
  userId: string;

  @ApiProperty({ example: 'CREATE BiometricEnrollment (enrollment-456)' })
  description: string;
}

export class AuditActivityDto {
  @ApiProperty()
  hospitalId: string;

  @ApiProperty()
  period: { start: Date; end: Date };

  @ApiProperty({ example: 247 })
  totalActions: number;

  @ApiProperty()
  actionsByType: AuditActionCountsDto;

  @ApiProperty({ example: { BiometricEnrollment: 45, User: 38 } })
  actionsByEntity: { [entity: string]: number };

  @ApiProperty({ example: 45 })
  uniqueUsersActive: number;

  @ApiProperty()
  recentActions: RecentActionDto[];
}

/**
 * ============ Compliance Report DTOs ============
 */

export class ComplianceMetricsDto {
  @ApiProperty({ example: 85 })
  complianceScore: number;

  @ApiProperty({ example: 90 })
  authenticationScore: number;

  @ApiProperty({ example: 85 })
  accessControlScore: number;

  @ApiProperty({ example: 80 })
  dataProtectionScore: number;

  @ApiProperty({ example: 75 })
  incidentDetectionScore: number;

  @ApiProperty({ example: 95 })
  auditTrailScore: number;

  @ApiProperty({ example: 28 })
  totalThreatsDetected: number;

  @ApiProperty()
  threatsBySeverity: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };

  @ApiProperty()
  threatsByType: {
    failedLoginAttempts: number;
    bulkOperations: number;
    permissionEscalations: number;
    suspiciousIPs: number;
  };

  @ApiProperty({ example: 2500 })
  totalAuditLogsGenerated: number;

  @ApiProperty({ example: 150 })
  uniqueUsersTracked: number;

  @ApiProperty({ example: 15 })
  criticalIncidentsResolved: number;

  @ApiProperty({ example: 5 })
  pendingIncidents: number;
}

export class ComplianceReportDto {
  @ApiProperty()
  hospitalId: string;

  @ApiProperty({ enum: ['MONTHLY', 'QUARTERLY', 'ANNUAL'] })
  reportType: string;

  @ApiProperty()
  reportPeriod: { start: Date; end: Date };

  @ApiProperty()
  generatedDate: Date;

  @ApiProperty()
  metrics: ComplianceMetricsDto;

  @ApiProperty({ example: ['Authentication mechanisms are adequately controlled.'] })
  findings: string[];

  @ApiProperty({
    example: [
      'Implement stricter password policies',
      'Review user roles and permissions',
    ],
  })
  recommendations: string[];

  @ApiProperty({ enum: ['COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT'] })
  overallComplianceStatus: string;
}

/**
 * ============ Export Request DTOs ============
 */

export enum ReportFormat {
  CSV = 'CSV',
  JSON = 'JSON',
  PDF = 'PDF',
}

export enum DataType {
  AUDIT = 'audit',
  THREATS = 'threats',
}

export class ExportRequestDto {
  @ApiPropertyOptional({ example: '2026-02-01T00:00:00Z' })
  @IsOptional()
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ example: '2026-02-28T23:59:59Z' })
  @IsOptional()
  @IsDate()
  endDate?: Date;

  @ApiProperty({ enum: ReportFormat })
  @IsEnum(ReportFormat)
  format: ReportFormat;

  @ApiProperty({ enum: DataType })
  @IsEnum(DataType)
  dataType: DataType;
}

export class ExportResponseDto {
  @ApiProperty()
  hospitalId: string;

  @ApiProperty()
  dataType: string;

  @ApiProperty()
  format: string;

  @ApiProperty()
  generatedDate: Date;

  @ApiProperty({ example: 'audit_logs_2026-02-18.csv' })
  filename: string;

  @ApiProperty({ example: 'text/csv' })
  mimeType: string;

  @ApiProperty()
  data: string; // The exported content
}

/**
 * ============ Dashboard Configuration DTOs ============
 */

export class DashboardSettingsDto {
  @ApiPropertyOptional({ example: 24 })
  @IsOptional()
  @IsNumber()
  metricsRefreshInterval?: number; // seconds

  @ApiPropertyOptional({ example: 7 })
  @IsOptional()
  @IsNumber()
  trendAnalysisPeriod?: number; // days

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  enableWebSocketUpdates?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  showEncryptionStatus?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  showComplianceMetrics?: boolean;
}

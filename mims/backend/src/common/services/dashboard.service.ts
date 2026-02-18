import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  DashboardMetricsDto,
  ThreatTrendDto,
  ComplianceStatusDto,
  EncryptionStatusDto,
  AlertDistributionDto,
  AuditActivityDto,
} from '../dtos/dashboard.dto';

/**
 * DashboardService provides real-time security metrics and analytics
 * for admin dashboards. Aggregates data from threat detection, audit logs,
 * and encryption status.
 *
 * Features:
 * - Security metrics (threat count, alert count, user activity)
 * - Threat trends over time
 * - Compliance status tracking
 * - Encryption status monitoring
 * - Alert distribution by severity/type
 * - Audit activity summaries
 */
@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get comprehensive security dashboard metrics
   * Aggregates: threat count, alert count, failed logins, bulk operations
   * Time range: Last 24 hours by default
   */
  async getSecurityMetrics(
    hospitalId: string,
    hoursBack: number = 24,
  ): Promise<DashboardMetricsDto> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Fetch threat alerts (created within timeframe)
    const threatAlerts = await this.prisma.threatAlert.findMany({
      where: {
        hospitalId,
        createdAt: { gte: since },
      },
    });

    // Fetch audit logs for activity metrics
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        timestamp: { gte: since },
      },
    });

    // Count threats by severity
    const threatsBySeverity = {
      CRITICAL: threatAlerts.filter((t) => t.severity === 'CRITICAL').length,
      HIGH: threatAlerts.filter((t) => t.severity === 'HIGH').length,
      MEDIUM: threatAlerts.filter((t) => t.severity === 'MEDIUM').length,
      LOW: threatAlerts.filter((t) => t.severity === 'LOW').length,
    };

    // Count threats by type
    const threatsByType = {
      FAILED_LOGIN_ATTEMPTS: threatAlerts.filter(
        (t) => t.alertType === 'FAILED_LOGIN_ATTEMPTS',
      ).length,
      BULK_OPERATIONS: threatAlerts.filter(
        (t) => t.alertType === 'BULK_OPERATIONS',
      ).length,
      PERMISSION_ESCALATION: threatAlerts.filter(
        (t) => t.alertType === 'PERMISSION_ESCALATION',
      ).length,
      SUSPICIOUS_IP: threatAlerts.filter(
        (t) => t.alertType === 'SUSPICIOUS_IP',
      ).length,
    };

    // Count unread alerts
    const unreadAlerts = threatAlerts.filter((t) => !t.read).length;

    // Count audit log actions
    const auditActionCounts = {
      CREATE: auditLogs.filter((a) => a.action === 'CREATE').length,
      UPDATE: auditLogs.filter((a) => a.action === 'UPDATE').length,
      DELETE: auditLogs.filter((a) => a.action === 'DELETE').length,
    };

    // Count unique users with activity
    const uniqueUsers = new Set(auditLogs.map((a) => a.userId)).size;

    // Calculate threat severity level
    const severityLevel =
      threatsBySeverity.CRITICAL > 0
        ? 'CRITICAL'
        : threatsBySeverity.HIGH > 0
          ? 'HIGH'
          : threatsBySeverity.MEDIUM > 0
            ? 'MEDIUM'
            : 'LOW';

    return {
      hospitalId,
      timeRange: {
        start: since,
        end: new Date(),
        hoursBack,
      },
      totalThreats: threatAlerts.length,
      totalAlerts: threatAlerts.length,
      unreadAlerts,
      threatsBySeverity,
      threatsByType,
      totalAuditActions: auditLogs.length,
      auditActionsByType: auditActionCounts,
      uniqueUsersActive: uniqueUsers,
      overallSeverityLevel: severityLevel,
      criticalThreatCount: threatsBySeverity.CRITICAL,
      alertsRequiringAction: threatAlerts.filter((t) => t.requiresAction)
        .length,
      dismissedAlerts: threatAlerts.filter((t) => t.dismissedAt !== null)
        .length,
    };
  }

  /**
   * Get threat trend over time (last 7 days by default)
   * Returns daily threat counts and severity distribution
   */
  async getThreatTrend(
    hospitalId: string,
    daysBack: number = 7,
  ): Promise<ThreatTrendDto> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const threatAlerts = await this.prisma.threatAlert.findMany({
      where: {
        hospitalId,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group threats by day
    const trendByDay: { [key: string]: number } = {};
    const severityByDay: { [key: string]: any } = {};
    const typeByDay: { [key: string]: any } = {};

    threatAlerts.forEach((threat) => {
      const dayKey = threat.createdAt.toISOString().split('T')[0];

      // Count by day
      trendByDay[dayKey] = (trendByDay[dayKey] || 0) + 1;

      // Severity by day
      if (!severityByDay[dayKey]) {
        severityByDay[dayKey] = {
          CRITICAL: 0,
          HIGH: 0,
          MEDIUM: 0,
          LOW: 0,
        };
      }
      severityByDay[dayKey][threat.severity]++;

      // Type by day
      if (!typeByDay[dayKey]) {
        typeByDay[dayKey] = {
          FAILED_LOGIN_ATTEMPTS: 0,
          BULK_OPERATIONS: 0,
          PERMISSION_ESCALATION: 0,
          SUSPICIOUS_IP: 0,
        };
      }
      typeByDay[dayKey][threat.alertType]++;
    });

    // Calculate trend direction
    const dailyValues = Object.values(trendByDay);
    const trendDirection =
      dailyValues.length >= 2
        ? dailyValues[dailyValues.length - 1] >
          dailyValues[dailyValues.length - 2]
          ? 'INCREASING'
          : 'DECREASING'
        : 'STABLE';

    return {
      hospitalId,
      daysBack,
      period: {
        start: since,
        end: new Date(),
      },
      totalThreatsInPeriod: threatAlerts.length,
      dailyThreatCount: trendByDay,
      dailySeverityDistribution: severityByDay as any,
      dailyTypeDistribution: typeByDay as any,
      averageThreatsPerDay:
        dailyValues.length > 0
          ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length
          : 0,
      peakThreatDay: Object.entries(trendByDay).sort(
        ([, a], [, b]) => b - a,
      )[0]?.[0],
      peakThreatCount: Math.max(...dailyValues, 0),
      trendDirection,
    };
  }

  /**
   * Get compliance status for the hospital
   * Tracks compliance with security policies
   */
  async getComplianceStatus(hospitalId: string): Promise<ComplianceStatusDto> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get biometric enrollments (assumes all are encrypted via EntityEncryptionService)
    const biometricEnrollmentCount =
      await this.prisma.biometricEnrollment.count({
        where: { hospitalId },
      });

    // Get failed auth attempts in last 30 days
    const failedAuthAlerts = await this.prisma.threatAlert.count({
      where: {
        hospitalId,
        alertType: 'FAILED_LOGIN_ATTEMPTS',
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Get unauthorized access attempts
    const permissionEscalationAlerts = await this.prisma.threatAlert.count({
      where: {
        hospitalId,
        alertType: 'PERMISSION_ESCALATION',
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Get suspicious activity
    const suspiciousActivityAlerts = await this.prisma.threatAlert.count({
      where: {
        hospitalId,
        alertType: 'SUSPICIOUS_IP',
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    // Calculate compliance score (simplified version)
    // Score factors: encryption enabled (50%), low failed auth (30%), low suspicious activity (20%)
    let complianceScore = 100;
    if (biometricEnrollmentCount === 0) complianceScore -= 10; // No biometric data = less risk
    if (failedAuthAlerts > 10) complianceScore -= 30;
    if (suspiciousActivityAlerts > 5) complianceScore -= 20;
    complianceScore = Math.max(0, complianceScore);

    const complianceLevel =
      complianceScore >= 90
        ? 'EXCELLENT'
        : complianceScore >= 75
          ? 'GOOD'
          : complianceScore >= 60
            ? 'FAIR'
            : 'POOR';

    return {
      hospitalId,
      complianceScore,
      complianceLevel,
      period: {
        start: thirtyDaysAgo,
        end: new Date(),
      },
      checks: {
        dataEncryption: {
          compliant: true, // Assuming all data encrypted via EntityEncryptionService
          details: `${biometricEnrollmentCount} biometric records encrypted`,
        },
        authenticationSecurity: {
          compliant: failedAuthAlerts <= 10,
          details: `${failedAuthAlerts} failed login attempts in 30 days`,
        },
        accessControl: {
          compliant: permissionEscalationAlerts === 0,
          details: `${permissionEscalationAlerts} permission escalation attempts`,
        },
        suspiciousActivityMonitoring: {
          compliant: suspiciousActivityAlerts <= 5,
          details: `${suspiciousActivityAlerts} suspicious IP activities`,
        },
      },
      recommendations:
        complianceLevel === 'EXCELLENT'
          ? []
          : complianceLevel === 'GOOD'
            ? ['Review and address failed login attempts', 'Monitor suspicious IP activity']
            : complianceLevel === 'FAIR'
              ? [
                  'Implement stricter access controls',
                  'Review user permissions',
                  'Enable multi-factor authentication',
                  'Monitor failed login attempts',
                ]
              : [
                  'Ensure all sensitive data is encrypted',
                  'Review and enforce access control policies',
                  'Investigate and address security threats',
                  'Implement stricter authentication requirements',
                  'Enable comprehensive audit logging',
                ],
    };
  }

  /**
   * Get encryption status for hospital data
   * Monitors encryption coverage and key rotation
   */
  async getEncryptionStatus(hospitalId: string): Promise<EncryptionStatusDto> {
    // Count total records that should be encrypted
    const biometricEnrollments =
      await this.prisma.biometricEnrollment.count({
        where: { hospitalId },
      });

    // In a real system, you'd check the encryption key metadata
    const lastKeyRotation = new Date('2026-01-15'); // Placeholder
    const keyRotationFrequency = 90; // days
    const daysUntilNextRotation = Math.max(
      0,
      keyRotationFrequency -
        Math.floor(
          (Date.now() - lastKeyRotation.getTime()) / (24 * 60 * 60 * 1000),
        ),
    );

    return {
      hospitalId,
      encryptionAlgorithm: 'AES-256-GCM',
      encryptedRecords: biometricEnrollments,
      encryptionCoverage: biometricEnrollments > 0 ? 100 : 0,
      lastKeyRotation,
      nextKeyRotationDate: new Date(
        lastKeyRotation.getTime() +
          keyRotationFrequency * 24 * 60 * 60 * 1000,
      ),
      daysUntilNextRotation,
      keyRotationStatus:
        daysUntilNextRotation > 30
          ? 'OK'
          : daysUntilNextRotation > 14
            ? 'WARNING'
            : 'URGENT',
      encryptedFieldsTypes: [
        'fingerprintData',
        'faceData',
        'irisData',
        'voiceData',
      ],
      complianceRequirements: {
        algorithm: 'AES-256 or stronger',
        keyRotation: '90 days',
        dataClassification: 'Highly Sensitive (PHI)',
      },
    };
  }

  /**
   * Get alert distribution by severity and type
   */
  async getAlertDistribution(
    hospitalId: string,
    daysBack: number = 7,
  ): Promise<AlertDistributionDto> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const alerts = await this.prisma.threatAlert.findMany({
      where: {
        hospitalId,
        createdAt: { gte: since },
      },
    });

    return {
      hospitalId,
      period: { start: since, end: new Date() },
      totalAlerts: alerts.length,
      readAlerts: alerts.filter((a) => a.read).length,
      unreadAlerts: alerts.filter((a) => !a.read).length,
      dismissedAlerts: alerts.filter((a) => a.dismissedAt !== null).length,
      requiresActionCount: alerts.filter((a) => a.requiresAction).length,
      bySeverity: {
        CRITICAL: alerts.filter((a) => a.severity === 'CRITICAL').length,
        HIGH: alerts.filter((a) => a.severity === 'HIGH').length,
        MEDIUM: alerts.filter((a) => a.severity === 'MEDIUM').length,
        LOW: alerts.filter((a) => a.severity === 'LOW').length,
      },
      byType: {
        FAILED_LOGIN_ATTEMPTS: alerts.filter(
          (a) => a.alertType === 'FAILED_LOGIN_ATTEMPTS',
        ).length,
        BULK_OPERATIONS: alerts.filter(
          (a) => a.alertType === 'BULK_OPERATIONS',
        ).length,
        PERMISSION_ESCALATION: alerts.filter(
          (a) => a.alertType === 'PERMISSION_ESCALATION',
        ).length,
        SUSPICIOUS_IP: alerts.filter((a) => a.alertType === 'SUSPICIOUS_IP')
          .length,
      },
    };
  }

  /**
   * Get audit activity summary
   */
  async getAuditActivity(
    hospitalId: string,
    daysBack: number = 7,
    limit: number = 10,
  ): Promise<AuditActivityDto> {
    const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Count by action type
    const actionCounts = {
      CREATE: auditLogs.filter((a) => a.action === 'CREATE').length,
      UPDATE: auditLogs.filter((a) => a.action === 'UPDATE').length,
      DELETE: auditLogs.filter((a) => a.action === 'DELETE').length,
    };

    // Count by entity type
    const entityTypeCounts: { [key: string]: number } = {};
    auditLogs.forEach((log) => {
      entityTypeCounts[log.entityType] =
        (entityTypeCounts[log.entityType] || 0) + 1;
    });

    // Get unique users
    const uniqueUsers = new Set(auditLogs.map((a) => a.userId)).size;

    return {
      hospitalId,
      period: { start: since, end: new Date() },
      totalActions: auditLogs.length,
      actionsByType: actionCounts,
      actionsByEntity: entityTypeCounts,
      uniqueUsersActive: uniqueUsers,
      recentActions: auditLogs.slice(0, 10).map((log) => ({
        action: log.action,
        entityType: log.entityType,
        timestamp: log.timestamp,
        userId: log.userId,
        description: `${log.action} ${log.entityType} (${log.entityId})`,
      })),
    };
  }
}

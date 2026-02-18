import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ComplianceReportDto,
  ComplianceMetricsDto,
} from '../dtos/dashboard.dto';

/**
 * ComplianceService generates compliance reports and metrics
 * Tracks compliance with security policies and regulations
 *
 * Features:
 * - Monthly/Quarterly/Annual compliance reports
 * - Policy compliance tracking
 * - Security incident metrics
 * - Encryption coverage reporting
 * - User access audit
 */
@Injectable()
export class ComplianceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate monthly compliance report
   */
  async generateMonthlyReport(
    hospitalId: string,
    year: number,
    month: number,
  ): Promise<ComplianceReportDto> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    return this.generateComplianceReport(
      hospitalId,
      startDate,
      endDate,
      'MONTHLY',
    );
  }

  /**
   * Generate quarterly compliance report
   */
  async generateQuarterlyReport(
    hospitalId: string,
    year: number,
    quarter: number, // 1-4
  ): Promise<ComplianceReportDto> {
    const monthStart = (quarter - 1) * 3 + 1;
    const startDate = new Date(year, monthStart - 1, 1);
    const endDate = new Date(year, monthStart + 2, 0, 23, 59, 59);

    return this.generateComplianceReport(
      hospitalId,
      startDate,
      endDate,
      'QUARTERLY',
    );
  }

  /**
   * Generate annual compliance report
   */
  async generateAnnualReport(
    hospitalId: string,
    year: number,
  ): Promise<ComplianceReportDto> {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31, 23, 59, 59);

    return this.generateComplianceReport(
      hospitalId,
      startDate,
      endDate,
      'ANNUAL',
    );
  }

  /**
   * Generate comprehensive compliance report for period
   */
  private async generateComplianceReport(
    hospitalId: string,
    startDate: Date,
    endDate: Date,
    reportType: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
  ): Promise<ComplianceReportDto> {
    // Fetch audit logs for period
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        timestamp: { gte: startDate, lte: endDate },
      },
    });

    // Fetch threat alerts for period
    const threatAlerts = await this.prisma.threatAlert.findMany({
      where: {
        hospitalId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    // Calculate compliance metrics
    const metrics = await this.calculateComplianceMetrics(
      hospitalId,
      auditLogs,
      threatAlerts,
      startDate,
      endDate,
    );

    // Generate findings
    const findings = this.generateFindings(metrics, reportType);

    // Generate recommendations
    const recommendations = this.generateRecommendations(metrics);

    return {
      hospitalId,
      reportType,
      reportPeriod: { start: startDate, end: endDate },
      generatedDate: new Date(),
      metrics,
      findings,
      recommendations,
      overallComplianceStatus: metrics.complianceScore >= 80
        ? 'COMPLIANT'
        : metrics.complianceScore >= 60
          ? 'PARTIALLY_COMPLIANT'
          : 'NON_COMPLIANT',
    };
  }

  /**
   * Calculate compliance metrics from audit and threat data
   */
  private async calculateComplianceMetrics(
    hospitalId: string,
    auditLogs: any[],
    threatAlerts: any[],
    startDate: Date,
    endDate: Date,
  ): Promise<ComplianceMetricsDto> {
    // Count threats by severity
    const criticalThreats = threatAlerts.filter(
      (t) => t.severity === 'CRITICAL',
    ).length;
    const highThreats = threatAlerts.filter(
      (t) => t.severity === 'HIGH',
    ).length;
    const mediumThreats = threatAlerts.filter(
      (t) => t.severity === 'MEDIUM',
    ).length;

    // Count by threat type
    const failedLoginAttempts = threatAlerts.filter(
      (t) => t.alertType === 'FAILED_LOGIN_ATTEMPTS',
    ).length;
    const bulkOperations = threatAlerts.filter(
      (t) => t.alertType === 'BULK_OPERATIONS',
    ).length;
    const permissionEscalations = threatAlerts.filter(
      (t) => t.alertType === 'PERMISSION_ESCALATION',
    ).length;
    const suspiciousIPs = threatAlerts.filter(
      (t) => t.alertType === 'SUSPICIOUS_IP',
    ).length;

    // Calculate baseline scores
    let authenticationScore = 100;
    if (failedLoginAttempts > 20) authenticationScore -= 30;
    else if (failedLoginAttempts > 10) authenticationScore -= 15;

    let accessControlScore = 100;
    if (permissionEscalations > 5) accessControlScore -= 50;
    else if (permissionEscalations > 0) accessControlScore -= 20;

    let dataProtectionScore = 100;
    if (bulkOperations > 10) dataProtectionScore -= 20;

    let incidentDetectionScore = 100;
    if (criticalThreats > 0) incidentDetectionScore -= 50;
    else if (highThreats > 5) incidentDetectionScore -= 30;

    // Audit trail completeness
    const auditTrailScore =
      auditLogs.length > 1000 ? 100 : (auditLogs.length / 1000) * 100;

    // Calculate overall compliance score
    const complianceScore =
      (authenticationScore * 0.25 +
        accessControlScore * 0.25 +
        dataProtectionScore * 0.2 +
        incidentDetectionScore * 0.2 +
        auditTrailScore * 0.1) /
      100;

    return {
      complianceScore: Math.round(complianceScore),
      authenticationScore: Math.round(authenticationScore),
      accessControlScore: Math.round(accessControlScore),
      dataProtectionScore: Math.round(dataProtectionScore),
      incidentDetectionScore: Math.round(incidentDetectionScore),
      auditTrailScore: Math.round(auditTrailScore),
      totalThreatsDetected: threatAlerts.length,
      threatsBySeverity: {
        CRITICAL: criticalThreats,
        HIGH: highThreats,
        MEDIUM: mediumThreats,
        LOW: threatAlerts.filter((t) => t.severity === 'LOW').length,
      },
      threatsByType: {
        failedLoginAttempts,
        bulkOperations,
        permissionEscalations,
        suspiciousIPs,
      },
      totalAuditLogsGenerated: auditLogs.length,
      uniqueUsersTracked: new Set(auditLogs.map((a) => a.userId)).size,
      criticalIncidentsResolved:
        threatAlerts.filter((t) => t.read && t.dismissedAt).length,
      pendingIncidents: threatAlerts.filter((t) => !t.read).length,
    };
  }

  /**
   * Generate compliance findings based on metrics
   */
  private generateFindings(
    metrics: ComplianceMetricsDto,
    reportType: string,
  ): string[] {
    const findings: string[] = [];

    // Authentication findings
    if (metrics.authenticationScore < 80) {
      findings.push(
        `Authentication security score is ${metrics.authenticationScore}%. ` +
          `${metrics.threatsByType.failedLoginAttempts} failed login attempts detected.`,
      );
    } else {
      findings.push('Authentication mechanisms are adequately controlled.');
    }

    // Access control findings
    if (metrics.accessControlScore < 100) {
      findings.push(
        `Access control findings: ${metrics.threatsByType.permissionEscalations} permission escalation attempts detected.`,
      );
    } else {
      findings.push('No permission escalation attempts detected.');
    }

    // Incident detection findings
    if (metrics.threatsBySeverity.CRITICAL > 0) {
      findings.push(
        `CRITICAL FINDING: ${metrics.threatsBySeverity.CRITICAL} critical security threats detected.`,
      );
    }
    if (metrics.threatsBySeverity.HIGH > 5) {
      findings.push(
        `WARNING: ${metrics.threatsBySeverity.HIGH} high-severity threats detected.`,
      );
    }

    // Audit trail findings
    if (metrics.auditTrailScore === 100) {
      findings.push('Comprehensive audit trail maintained throughout period.');
    } else {
      findings.push(
        `Audit trail completeness: ${metrics.auditTrailScore}%. ` +
          `${metrics.totalAuditLogsGenerated} audit logs recorded.`,
      );
    }

    // Data protection findings
    if (metrics.dataProtectionScore >= 80) {
      findings.push('Data protection controls are in place.');
    }

    // Overall compliance
    if (metrics.complianceScore >= 80) {
      findings.push(
        `Overall compliance score: ${metrics.complianceScore}% - Hospital meets security requirements.`,
      );
    } else if (metrics.complianceScore >= 60) {
      findings.push(
        `Overall compliance score: ${metrics.complianceScore}% - Hospital partially meets security requirements. Improvements needed.`,
      );
    } else {
      findings.push(
        `Overall compliance score: ${metrics.complianceScore}% - Hospital does not meet security requirements. Urgent action required.`,
      );
    }

    return findings;
  }

  /**
   * Generate compliance recommendations
   */
  private generateRecommendations(metrics: ComplianceMetricsDto): string[] {
    const recommendations: string[] = [];

    if (metrics.authenticationScore < 100) {
      recommendations.push(
        'Implement stricter password policies and multi-factor authentication.',
      );
      recommendations.push(
        'Review and address failed login attempts. Consider implementing account lockout policies.',
      );
    }

    if (metrics.accessControlScore < 100) {
      recommendations.push(
        'Review user roles and permissions. Implement principle of least privilege.',
      );
      recommendations.push(
        'Conduct access control audit. Remove unnecessary admin privileges.',
      );
    }

    if (metrics.threatsBySeverity.CRITICAL > 0) {
      recommendations.push(
        'Immediately investigate and remediate critical security threats.',
      );
      recommendations.push(
        'Implement additional monitoring and alerting for critical threats.',
      );
    }

    if (metrics.threatsBySeverity.HIGH > 0) {
      recommendations.push(
        'Review high-severity threats and implement mitigating controls.',
      );
    }

    if (metrics.dataProtectionScore < 100) {
      recommendations.push(
        'Ensure all sensitive data is properly encrypted and protected.',
      );
      recommendations.push(
        'Review data classification and implement appropriate protection measures.',
      );
    }

    if (metrics.complianceScore < 80) {
      recommendations.push('Develop comprehensive security improvement plan.');
      recommendations.push(
        'Schedule security training for staff to improve awareness.',
      );
      recommendations.push('Conduct full security assessment and audit.');
    }

    recommendations.push('Schedule regular (monthly) compliance reviews.');
    recommendations.push(
      'Keep encryption keys and security credentials current.',
    );

    return recommendations;
  }

  /**
   * Get current compliance metrics snapshot
   */
  async getComplianceMetrics(hospitalId: string): Promise<ComplianceMetricsDto> {
    // Get last 30 days data
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        timestamp: { gte: thirtyDaysAgo },
      },
    });

    const threatAlerts = await this.prisma.threatAlert.findMany({
      where: {
        hospitalId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    return this.calculateComplianceMetrics(
      hospitalId,
      auditLogs,
      threatAlerts,
      thirtyDaysAgo,
      new Date(),
    );
  }
}

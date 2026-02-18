import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogViewerService } from './audit-log-viewer.service';

export interface ThreatAlert {
  type:
    | 'FAILED_LOGIN_ATTEMPTS'
    | 'BULK_OPERATIONS'
    | 'PERMISSION_ESCALATION'
    | 'SUSPICIOUS_IP';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  userId?: string;
  hospitalId: string;
  description: string;
  details: Record<string, any>;
  timestamp: Date;
  requiresAction: boolean;
}

export interface FailedLoginEvent {
  userId: string;
  hospitalId: string;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
  reason: string;
}

export interface BulkOperationEvent {
  userId: string;
  hospitalId: string;
  operationCount: number;
  timeWindowSeconds: number;
  entityTypes: string[];
  timestamp: Date;
}

@Injectable()
export class ThreatDetectionService {
  private readonly logger = new Logger(ThreatDetectionService.name);
  private failedLoginAttempts = new Map<string, FailedLoginEvent[]>();
  private bulkOperationWindow = 60; // 60 seconds for bulk operation detection

  constructor(
    private prisma: PrismaService,
    private auditLogViewerService: AuditLogViewerService,
  ) {}

  /**
   * Track failed login attempt and detect threats
   */
  async trackFailedLoginAttempt(
    userId: string,
    hospitalId: string,
    ipAddress: string,
    userAgent: string,
    reason: string,
  ): Promise<ThreatAlert | null> {
    const key = `${userId}:${hospitalId}`;
    const now = new Date();

    // Initialize if not exists
    if (!this.failedLoginAttempts.has(key)) {
      this.failedLoginAttempts.set(key, []);
    }

    const attempts = this.failedLoginAttempts.get(key);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Remove old attempts (older than 5 minutes)
    const recentAttempts = attempts.filter((a) => a.timestamp > fiveMinutesAgo);
    recentAttempts.push({
      userId,
      hospitalId,
      ipAddress,
      userAgent,
      timestamp: now,
      reason,
    });

    this.failedLoginAttempts.set(key, recentAttempts);

    // Alert if 3+ failed attempts in 5 minutes
    if (recentAttempts.length >= 3) {
      const alert: ThreatAlert = {
        type: 'FAILED_LOGIN_ATTEMPTS',
        severity: recentAttempts.length >= 5 ? 'CRITICAL' : 'HIGH',
        userId,
        hospitalId,
        description: `${recentAttempts.length} failed login attempts detected for user ${userId}`,
        details: {
          attemptCount: recentAttempts.length,
          timeWindowMinutes: 5,
          ipAddresses: [...new Set(recentAttempts.map((a) => a.ipAddress))],
          reasons: [...new Set(recentAttempts.map((a) => a.reason))],
          firstAttempt: recentAttempts[0].timestamp,
          lastAttempt: recentAttempts[recentAttempts.length - 1].timestamp,
        },
        timestamp: now,
        requiresAction: recentAttempts.length >= 5,
      };

      this.logger.warn(`🚨 THREAT DETECTED: ${alert.description}`);
      return alert;
    }

    return null;
  }

  /**
   * Detect bulk operations (> 100 operations per minute)
   */
  async detectBulkOperations(
    hospitalId: string,
    userId?: string,
  ): Promise<ThreatAlert | null> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - this.bulkOperationWindow * 1000);

    // Get operations in last minute
    const logs = await this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        ...(userId && { userId }),
        timestamp: { gte: oneMinuteAgo },
      },
      select: {
        userId: true,
        entityType: true,
        action: true,
        timestamp: true,
      },
    });

    // Check for bulk operations (threshold: 100 in 60 seconds)
    const threshold = 100;
    if (logs.length > threshold) {
      const entityTypes = [...new Set(logs.map((l) => l.entityType))];
      const bulkUserId = userId || 'UNKNOWN';

      const alert: ThreatAlert = {
        type: 'BULK_OPERATIONS',
        severity: logs.length > 500 ? 'CRITICAL' : 'HIGH',
        userId: bulkUserId,
        hospitalId,
        description: `Bulk operations detected: ${logs.length} operations in 60 seconds`,
        details: {
          operationCount: logs.length,
          threshold,
          timeWindowSeconds: this.bulkOperationWindow,
          entityTypes,
          timeRange: {
            start: oneMinuteAgo,
            end: now,
          },
        },
        timestamp: now,
        requiresAction: logs.length > 500,
      };

      this.logger.warn(`🚨 THREAT DETECTED: ${alert.description}`);
      return alert;
    }

    return null;
  }

  /**
   * Detect permission escalation attempts
   */
  async detectPermissionEscalation(
    hospitalId: string,
    lookbackMinutes: number = 30,
  ): Promise<ThreatAlert[]> {
    const alerts: ThreatAlert[] = [];
    const cutoffTime = new Date(Date.now() - lookbackMinutes * 60 * 1000);

    // Look for multiple permission/role changes by same user
    const permissionLogs = await this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        entityType: { in: ['Permission', 'Role'] },
        action: 'UPDATE',
        timestamp: { gte: cutoffTime },
      },
      select: {
        userId: true,
        entityId: true,
        entityType: true,
        beforeState: true,
        afterState: true,
        timestamp: true,
      },
    });

    // Group by userId to detect pattern
    const userPermissionChanges = new Map<string, typeof permissionLogs>();
    for (const log of permissionLogs) {
      const key = log.userId;
      if (!userPermissionChanges.has(key)) {
        userPermissionChanges.set(key, []);
      }
      userPermissionChanges.get(key)!.push(log);
    }

    // Alert if single user modified multiple permissions/roles
    const now = new Date();
    for (const [userId, changes] of userPermissionChanges.entries()) {
      if (changes.length >= 5) {
        const alert: ThreatAlert = {
          type: 'PERMISSION_ESCALATION',
          severity: changes.length >= 10 ? 'CRITICAL' : 'HIGH',
          userId,
          hospitalId,
          description: `Permission escalation attempt: ${userId} modified ${changes.length} permissions/roles`,
          details: {
            changeCount: changes.length,
            timeWindowMinutes: lookbackMinutes,
            entityTypes: [...new Set(changes.map((c) => c.entityType))],
            entities: changes.map((c) => c.entityId),
            timeRange: {
              start: cutoffTime,
              end: now,
            },
          },
          timestamp: now,
          requiresAction: changes.length >= 10,
        };

        this.logger.warn(`🚨 THREAT DETECTED: ${alert.description}`);
        alerts.push(alert);
      }
    }

    return alerts;
  }

  /**
   * Detect suspicious IP addresses (accessing from multiple locations)
   */
  async detectSuspiciousIP(
    hospitalId: string,
    userId: string,
    currentIP: string,
    lookbackHours: number = 24,
  ): Promise<ThreatAlert | null> {
    const cutoffTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

    // Get all IPs used by this user in recent timeframe
    const logs = await this.prisma.auditLog.findMany({
      where: {
        hospitalId,
        userId,
        timestamp: { gte: cutoffTime },
      },
      select: {
        ipAddress: true,
        timestamp: true,
      },
    });

    const uniqueIPs = [...new Set(logs.map((l) => l.ipAddress).filter(Boolean))];

    // Alert if user accessing from 5+ different IPs in 24 hours
    const ipThreshold = 5;
    if (uniqueIPs.length >= ipThreshold) {
      const now = new Date();
      const alert: ThreatAlert = {
        type: 'SUSPICIOUS_IP',
        severity: uniqueIPs.length >= 10 ? 'CRITICAL' : 'MEDIUM',
        userId,
        hospitalId,
        description: `Suspicious activity: ${userId} accessing from ${uniqueIPs.length} different IP addresses`,
        details: {
          ipCount: uniqueIPs.length,
          threshold: ipThreshold,
          ips: uniqueIPs,
          currentIP,
          timeWindowHours: lookbackHours,
        },
        timestamp: now,
        requiresAction: uniqueIPs.length >= 10,
      };

      this.logger.warn(`🚨 THREAT DETECTED: ${alert.description}`);
      return alert;
    }

    return null;
  }

  /**
   * Comprehensive threat detection scan for hospital
   */
  async comprehensiveThreatScan(hospitalId: string): Promise<ThreatAlert[]> {
    const alerts: ThreatAlert[] = [];

    try {
      // Check for bulk operations
      const bulkOpAlert = await this.detectBulkOperations(hospitalId);
      if (bulkOpAlert) {
        alerts.push(bulkOpAlert);
      }

      // Check for permission escalation
      const permissionAlerts = await this.detectPermissionEscalation(
        hospitalId,
      );
      alerts.push(...permissionAlerts);

      this.logger.log(
        `Threat scan completed for ${hospitalId}: ${alerts.length} alerts detected`,
      );
    } catch (error) {
      this.logger.error(`Threat scan failed for ${hospitalId}: ${error.message}`);
    }

    return alerts;
  }

  /**
   * Get threat alert summary for hospital
   */
  async getThreatSummary(hospitalId: string): Promise<{
    criticalAlerts: number;
    highAlerts: number;
    mediumAlerts: number;
    lowAlerts: number;
    totalAlerts: number;
    requiresImmediateAction: number;
  }> {
    try {
      const alerts = await this.prisma.threatAlert.findMany({
        where: {
          hospitalId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
        select: {
          severity: true,
          requiresAction: true,
        },
      });

      const summary = {
        criticalAlerts: alerts.filter((a) => a.severity === 'CRITICAL').length,
        highAlerts: alerts.filter((a) => a.severity === 'HIGH').length,
        mediumAlerts: alerts.filter((a) => a.severity === 'MEDIUM').length,
        lowAlerts: alerts.filter((a) => a.severity === 'LOW').length,
        totalAlerts: alerts.length,
        requiresImmediateAction: alerts.filter((a) => a.requiresAction).length,
      };

      return summary;
    } catch (error) {
      this.logger.error(`Failed to get threat summary: ${error.message}`);
      return {
        criticalAlerts: 0,
        highAlerts: 0,
        mediumAlerts: 0,
        lowAlerts: 0,
        totalAlerts: 0,
        requiresImmediateAction: 0,
      };
    }
  }

  /**
   * Reset failed login attempts for user (after successful login)
   */
  resetFailedLoginAttempts(userId: string, hospitalId: string): void {
    const key = `${userId}:${hospitalId}`;
    this.failedLoginAttempts.delete(key);
  }

  /**
   * Get failed login attempt count for user
   */
  getFailedLoginAttemptCount(userId: string, hospitalId: string): number {
    const key = `${userId}:${hospitalId}`;
    const attempts = this.failedLoginAttempts.get(key) || [];
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return attempts.filter((a) => a.timestamp > fiveMinutesAgo).length;
  }
}

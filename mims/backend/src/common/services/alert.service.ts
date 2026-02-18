import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ThreatAlert } from './threat-detection.service';

export interface AlertNotification {
  id: string;
  hospitalId: string;
  adminId?: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  actionRequired: boolean;
  read: boolean;
  createdAt: Date;
  dismissedAt?: Date;
}

@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);
  private alerts = new Map<string, AlertNotification[]>();

  constructor(private prisma: PrismaService) {}

  /**
   * Create and store a threat alert
   */
  async createAlert(
    threat: ThreatAlert,
    adminId?: string,
  ): Promise<AlertNotification> {
    const notification: AlertNotification = {
      id: this.generateAlertId(),
      hospitalId: threat.hospitalId,
      adminId,
      alertType: threat.type,
      severity: threat.severity,
      title: this.generateAlertTitle(threat.type, threat.severity),
      message: threat.description,
      actionRequired: threat.requiresAction,
      read: false,
      createdAt: threat.timestamp,
    };

    // Store in memory for immediate access
    const key = threat.hospitalId;
    if (!this.alerts.has(key)) {
      this.alerts.set(key, []);
    }
    this.alerts.get(key)!.push(notification);

    // Store in database for persistence
    try {
      await this.prisma.threatAlert.create({
        data: {
          hospitalId: threat.hospitalId,
          userId: threat.userId,
          alertType: threat.type,
          severity: threat.severity,
          description: threat.description,
          details: threat.details as any,
          requiresAction: threat.requiresAction,
          read: false,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to persist alert: ${error.message}`);
    }

    this.logger.log(
      `Alert created: ${notification.alertType} (${notification.severity}) for ${notification.hospitalId}`,
    );

    return notification;
  }

  /**
   * Get all unread alerts for hospital
   */
  async getUnreadAlerts(hospitalId: string): Promise<AlertNotification[]> {
    const alerts = this.alerts.get(hospitalId) || [];
    return alerts.filter((a) => !a.read);
  }

  /**
   * Get all alerts for hospital with pagination
   */
  async getAlerts(
    hospitalId: string,
    options: {
      limit?: number;
      offset?: number;
      severity?: string;
      unreadOnly?: boolean;
    } = {},
  ): Promise<{
    alerts: AlertNotification[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(options.limit || 50, 500);
    const offset = options.offset || 0;

    try {
      const where: any = { hospitalId };
      if (options.severity) {
        where.severity = options.severity;
      }
      if (options.unreadOnly) {
        where.read = false;
      }

      const alerts = await this.prisma.threatAlert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      });

      const total = await this.prisma.threatAlert.count({ where });

      return {
        alerts: alerts.map((a) => this.mapToNotification(a)),
        total,
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve alerts: ${error.message}`);
      return {
        alerts: [],
        total: 0,
        limit,
        offset,
      };
    }
  }

  /**
   * Mark alert as read
   */
  async markAlertAsRead(alertId: string, hospitalId: string): Promise<void> {
    const alerts = this.alerts.get(hospitalId) || [];
    const alert = alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.read = true;
    }

    try {
      await this.prisma.threatAlert.update({
        where: { id: alertId },
        data: { read: true },
      });
    } catch (error) {
      this.logger.error(`Failed to mark alert as read: ${error.message}`);
    }
  }

  /**
   * Mark all alerts as read for hospital
   */
  async markAllAlertsAsRead(hospitalId: string): Promise<void> {
    const alerts = this.alerts.get(hospitalId) || [];
    alerts.forEach((a) => {
      a.read = true;
    });

    try {
      await this.prisma.threatAlert.updateMany({
        where: { hospitalId, read: false },
        data: { read: true },
      });
    } catch (error) {
      this.logger.error(`Failed to mark all alerts as read: ${error.message}`);
    }
  }

  /**
   * Dismiss an alert
   */
  async dismissAlert(alertId: string, hospitalId: string): Promise<void> {
    const alerts = this.alerts.get(hospitalId) || [];
    const alertIndex = alerts.findIndex((a) => a.id === alertId);
    if (alertIndex >= 0) {
      alerts[alertIndex].dismissedAt = new Date();
    }

    try {
      await this.prisma.threatAlert.update({
        where: { id: alertId },
        data: { dismissedAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`Failed to dismiss alert: ${error.message}`);
    }
  }

  /**
   * Get alert by ID
   */
  async getAlertById(alertId: string): Promise<AlertNotification | null> {
    try {
      const alert = await this.prisma.threatAlert.findUnique({
        where: { id: alertId },
      });

      return alert ? this.mapToNotification(alert) : null;
    } catch (error) {
      this.logger.error(`Failed to retrieve alert: ${error.message}`);
      return null;
    }
  }

  /**
   * Get alert summary for hospital
   */
  async getAlertSummary(hospitalId: string): Promise<{
    unreadCount: number;
    unreadCritical: number;
    unreadHigh: number;
    unreadMedium: number;
    requiresAction: number;
  }> {
    try {
      const alerts = await this.prisma.threatAlert.findMany({
        where: { hospitalId, read: false },
        select: {
          severity: true,
          requiresAction: true,
        },
      });

      return {
        unreadCount: alerts.length,
        unreadCritical: alerts.filter((a) => a.severity === 'CRITICAL').length,
        unreadHigh: alerts.filter((a) => a.severity === 'HIGH').length,
        unreadMedium: alerts.filter((a) => a.severity === 'MEDIUM').length,
        requiresAction: alerts.filter((a) => a.requiresAction).length,
      };
    } catch (error) {
      this.logger.error(`Failed to get alert summary: ${error.message}`);
      return {
        unreadCount: 0,
        unreadCritical: 0,
        unreadHigh: 0,
        unreadMedium: 0,
        requiresAction: 0,
      };
    }
  }

  /**
   * Clear old alerts (older than 30 days)
   */
  async clearOldAlerts(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

      const result = await this.prisma.threatAlert.deleteMany({
        where: {
          dismissedAt: { lt: cutoffDate },
        },
      });

      this.logger.log(
        `Cleared ${result.count} old alerts (older than ${daysOld} days)`,
      );

      return result.count;
    } catch (error) {
      this.logger.error(`Failed to clear old alerts: ${error.message}`);
      return 0;
    }
  }

  /**
   * Generate alert ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate alert title based on type and severity
   */
  private generateAlertTitle(alertType: string, severity: string): string {
    const typeLabels: Record<string, string> = {
      FAILED_LOGIN_ATTEMPTS: 'Failed Login Attempts',
      BULK_OPERATIONS: 'Bulk Operations Detected',
      PERMISSION_ESCALATION: 'Permission Escalation Attempt',
      SUSPICIOUS_IP: 'Suspicious IP Activity',
    };

    const label = typeLabels[alertType] || 'Security Alert';
    return `[${severity}] ${label}`;
  }

  /**
   * Map Prisma alert to notification
   */
  private mapToNotification(alert: any): AlertNotification {
    return {
      id: alert.id,
      hospitalId: alert.hospitalId,
      adminId: alert.adminId,
      alertType: alert.alertType,
      severity: alert.severity,
      title: this.generateAlertTitle(alert.alertType, alert.severity),
      message: alert.description,
      actionRequired: alert.requiresAction,
      read: alert.read,
      createdAt: alert.createdAt,
      dismissedAt: alert.dismissedAt,
    };
  }
}

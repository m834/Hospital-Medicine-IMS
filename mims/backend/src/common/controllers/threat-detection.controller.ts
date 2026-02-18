import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ThreatDetectionService } from '../../common/services/threat-detection.service';
import { AlertService } from '../../common/services/alert.service';
import {
  FailedLoginAttemptDto,
  BulkOperationDetectionDto,
  PermissionEscalationCheckDto,
  SuspiciousIPCheckDto,
  AlertQueryDto,
  MarkAlertAsReadDto,
  DismissAlertDto,
  ComprehensiveThreatScanDto,
  ThreatAlertDto,
  PaginatedAlertsDto,
  AlertSummaryDto,
  ThreatSummaryDto,
} from '../../common/dtos/threat-detection.dto';

@Controller('api/v1/security/threats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ThreatDetectionController {
  private readonly logger = new Logger(ThreatDetectionController.name);

  constructor(
    private threatDetectionService: ThreatDetectionService,
    private alertService: AlertService,
  ) {}

  /**
   * POST /api/v1/security/threats/login-failure
   * Report failed login attempt and check for threats
   */
  @Post('login-failure')
  @Roles('SYSTEM', 'SUPER_ADMIN')
  async reportFailedLogin(
    @Body() body: FailedLoginAttemptDto,
    @CurrentUser() user: any,
  ): Promise<{ threatDetected: boolean; threat?: ThreatAlertDto }> {
    try {
      const alert = await this.threatDetectionService.trackFailedLoginAttempt(
        body.userId,
        user.hospitalId,
        body.ipAddress,
        body.userAgent,
        body.reason,
      );

      if (alert) {
        const notification = await this.alertService.createAlert(alert);
        return {
          threatDetected: true,
          threat: this.mapToThreatAlertDto(notification),
        };
      }

      return { threatDetected: false };
    } catch (error) {
      this.logger.error(`Failed login attempt tracking failed: ${error.message}`);
      throw new HttpException(
        'Failed to process login attempt',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/security/threats/reset-login-attempts
   * Reset failed login counter for user (after successful login)
   */
  @Post('reset-login-attempts/:userId')
  @Roles('SYSTEM', 'SUPER_ADMIN')
  async resetLoginAttempts(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean }> {
    try {
      this.threatDetectionService.resetFailedLoginAttempts(
        userId,
        user.hospitalId,
      );
      return { success: true };
    } catch (error) {
      this.logger.error(`Reset login attempts failed: ${error.message}`);
      throw new HttpException(
        'Failed to reset login attempts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/security/threats/login-attempts/:userId
   * Get current failed login attempt count
   */
  @Get('login-attempts/:userId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getLoginAttempts(
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ): Promise<{ userId: string; attemptCount: number }> {
    try {
      const count = this.threatDetectionService.getFailedLoginAttemptCount(
        userId,
        user.hospitalId,
      );

      return { userId, attemptCount: count };
    } catch (error) {
      this.logger.error(`Failed to get login attempts: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve login attempts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/security/threats/bulk-operations
   * Check for bulk operations
   */
  @Post('detect/bulk-operations')
  @Roles('SUPER_ADMIN', 'SECURITY_OFFICER')
  async detectBulkOperations(
    @Body() body: BulkOperationDetectionDto,
    @CurrentUser() user: any,
  ): Promise<{ threatDetected: boolean; threat?: ThreatAlertDto }> {
    try {
      // Verify hospital access
      if (
        user.role !== 'SUPER_ADMIN' &&
        body.hospitalId !== user.hospitalId
      ) {
        throw new HttpException(
          'Unauthorized to scan this hospital',
          HttpStatus.FORBIDDEN,
        );
      }

      const alert = await this.threatDetectionService.detectBulkOperations(
        body.hospitalId,
        body.userId,
      );

      if (alert) {
        const notification = await this.alertService.createAlert(alert);
        return {
          threatDetected: true,
          threat: this.mapToThreatAlertDto(notification),
        };
      }

      return { threatDetected: false };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Bulk operation detection failed: ${error.message}`);
      throw new HttpException(
        'Detection failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/security/threats/permission-escalation
   * Check for permission escalation attempts
   */
  @Post('detect/permission-escalation')
  @Roles('SUPER_ADMIN', 'SECURITY_OFFICER')
  async detectPermissionEscalation(
    @Body() body: PermissionEscalationCheckDto,
    @CurrentUser() user: any,
  ): Promise<{ threatsDetected: ThreatAlertDto[] }> {
    try {
      // Verify hospital access
      if (
        user.role !== 'SUPER_ADMIN' &&
        body.hospitalId !== user.hospitalId
      ) {
        throw new HttpException(
          'Unauthorized to scan this hospital',
          HttpStatus.FORBIDDEN,
        );
      }

      const alerts = await this.threatDetectionService.detectPermissionEscalation(
        body.hospitalId,
        body.lookbackMinutes,
      );

      for (const alert of alerts) {
        await this.alertService.createAlert(alert);
      }

      return {
        threatsDetected: alerts.map((a) =>
          this.mapToThreatAlertDto({ ...a, id: 'temp' }),
        ),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Permission escalation detection failed: ${error.message}`,
      );
      throw new HttpException(
        'Detection failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/security/threats/suspicious-ip
   * Check for suspicious IP activity
   */
  @Post('detect/suspicious-ip')
  @Roles('SUPER_ADMIN', 'SECURITY_OFFICER')
  async detectSuspiciousIP(
    @Body() body: SuspiciousIPCheckDto,
    @CurrentUser() user: any,
  ): Promise<{ threatDetected: boolean; threat?: ThreatAlertDto }> {
    try {
      // Verify hospital access
      if (
        user.role !== 'SUPER_ADMIN' &&
        body.hospitalId !== user.hospitalId
      ) {
        throw new HttpException(
          'Unauthorized to scan this hospital',
          HttpStatus.FORBIDDEN,
        );
      }

      const alert = await this.threatDetectionService.detectSuspiciousIP(
        body.hospitalId,
        body.userId,
        body.ipAddress,
        body.lookbackHours,
      );

      if (alert) {
        const notification = await this.alertService.createAlert(alert);
        return {
          threatDetected: true,
          threat: this.mapToThreatAlertDto(notification),
        };
      }

      return { threatDetected: false };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Suspicious IP detection failed: ${error.message}`);
      throw new HttpException(
        'Detection failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/security/threats/comprehensive-scan
   * Run comprehensive threat scan for hospital
   */
  @Post('comprehensive-scan')
  @Roles('SUPER_ADMIN', 'SECURITY_OFFICER')
  async comprehensiveScan(
    @Body() body: ComprehensiveThreatScanDto,
    @CurrentUser() user: any,
  ): Promise<{ alertsDetected: ThreatAlertDto[] }> {
    try {
      // Verify hospital access
      if (
        user.role !== 'SUPER_ADMIN' &&
        body.hospitalId !== user.hospitalId
      ) {
        throw new HttpException(
          'Unauthorized to scan this hospital',
          HttpStatus.FORBIDDEN,
        );
      }

      const alerts = await this.threatDetectionService.comprehensiveThreatScan(
        body.hospitalId,
      );

      for (const alert of alerts) {
        await this.alertService.createAlert(alert);
      }

      return {
        alertsDetected: alerts.map((a) =>
          this.mapToThreatAlertDto({ ...a, id: 'temp' }),
        ),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Comprehensive scan failed: ${error.message}`);
      throw new HttpException(
        'Scan failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/security/alerts
   * Get alerts for hospital
   */
  @Get('/alerts')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getAlerts(
    @Query() query: AlertQueryDto,
    @CurrentUser() user: any,
  ): Promise<PaginatedAlertsDto> {
    try {
      const result = await this.alertService.getAlerts(user.hospitalId, {
        limit: query.limit,
        offset: query.offset,
        severity: query.severity,
        unreadOnly: query.unreadOnly,
      });

      return {
        alerts: result.alerts.map((a) => this.mapToThreatAlertDto(a)),
        total: result.total,
        limit: result.limit,
        offset: result.offset,
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve alerts: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve alerts',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/security/alerts/:alertId
   * Get single alert
   */
  @Get('/alerts/:alertId')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getAlert(
    @Param('alertId') alertId: string,
  ): Promise<ThreatAlertDto> {
    try {
      const alert = await this.alertService.getAlertById(alertId);

      if (!alert) {
        throw new HttpException('Alert not found', HttpStatus.NOT_FOUND);
      }

      return this.mapToThreatAlertDto(alert);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to retrieve alert: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve alert',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /api/v1/security/alerts/:alertId/read
   * Mark alert as read
   */
  @Put('/alerts/:alertId/read')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async markAsRead(
    @Param('alertId') alertId: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean }> {
    try {
      await this.alertService.markAlertAsRead(alertId, user.hospitalId);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to mark alert as read: ${error.message}`);
      throw new HttpException(
        'Failed to mark alert as read',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * PUT /api/v1/security/alerts/read-all
   * Mark all alerts as read
   */
  @Put('/alerts/read-all')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async markAllAsRead(
    @CurrentUser() user: any,
  ): Promise<{ success: boolean }> {
    try {
      await this.alertService.markAllAlertsAsRead(user.hospitalId);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to mark all alerts as read: ${error.message}`);
      throw new HttpException(
        'Failed to mark alerts as read',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * DELETE /api/v1/security/alerts/:alertId
   * Dismiss alert
   */
  @Put('/alerts/:alertId/dismiss')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async dismissAlert(
    @Param('alertId') alertId: string,
    @CurrentUser() user: any,
  ): Promise<{ success: boolean }> {
    try {
      await this.alertService.dismissAlert(alertId, user.hospitalId);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to dismiss alert: ${error.message}`);
      throw new HttpException(
        'Failed to dismiss alert',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/security/alerts/summary
   * Get alert summary for hospital
   */
  @Get('/alerts/summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getAlertSummary(
    @CurrentUser() user: any,
  ): Promise<AlertSummaryDto> {
    try {
      return await this.alertService.getAlertSummary(user.hospitalId);
    } catch (error) {
      this.logger.error(`Failed to get alert summary: ${error.message}`);
      throw new HttpException(
        'Failed to get alert summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/security/threat-summary
   * Get threat summary
   */
  @Get('threat-summary')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getThreatSummary(
    @CurrentUser() user: any,
  ): Promise<ThreatSummaryDto> {
    try {
      return await this.threatDetectionService.getThreatSummary(
        user.hospitalId,
      );
    } catch (error) {
      this.logger.error(`Failed to get threat summary: ${error.message}`);
      throw new HttpException(
        'Failed to get threat summary',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Helper to map notification to DTO
   */
  private mapToThreatAlertDto(notification: any): ThreatAlertDto {
    return {
      id: notification.id,
      hospitalId: notification.hospitalId,
      userId: notification.userId,
      alertType: notification.alertType,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      actionRequired: notification.actionRequired,
      read: notification.read,
      createdAt: notification.createdAt,
      dismissedAt: notification.dismissedAt,
    };
  }
}

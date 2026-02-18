import {
  Controller,
  Get,
  Query,
  Param,
  Post,
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
import { AuditLogViewerService } from '../../common/services/audit-log-viewer.service';
import {
  AuditLogFilterDto,
  PaginationDto,
  PaginatedAuditLogsDto,
  AuditStatisticsDto,
  EntityHistoryDto,
  UserActivityDto,
  SensitiveOperationsDto,
} from '../../common/dtos/audit-log.dto';

@Controller('api/v1/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditLogController {
  private readonly logger = new Logger(AuditLogController.name);

  constructor(private auditLogViewerService: AuditLogViewerService) {}

  /**
   * GET /api/v1/audit-logs
   * List paginated audit logs with optional filtering
   */
  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getAuditLogs(
    @Query() filters: AuditLogFilterDto,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: any,
  ): Promise<PaginatedAuditLogsDto> {
    try {
      // Restrict non-super-admin users to their own hospital
      const hospitalId = user.role === 'SUPER_ADMIN'
        ? filters.hospitalId || user.hospitalId
        : user.hospitalId;

      const auditFilters = {
        ...filters,
        hospitalId,
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      };

      return await this.auditLogViewerService.getAuditLogs(
        auditFilters,
        pagination,
      );
    } catch (error) {
      this.logger.error(`Failed to fetch audit logs: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve audit logs',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/audit-logs/:id
   * Get a specific audit log entry
   */
  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getAuditLog(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    try {
      const log = await this.auditLogViewerService.getAuditLogById(id);

      if (!log) {
        throw new HttpException('Audit log not found', HttpStatus.NOT_FOUND);
      }

      // Check authorization (only see hospital's logs)
      if (user.role !== 'SUPER_ADMIN' && log.hospitalId !== user.hospitalId) {
        throw new HttpException(
          'Unauthorized to view this audit log',
          HttpStatus.FORBIDDEN,
        );
      }

      return log;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to fetch audit log ${id}: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve audit log',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/v1/audit-logs/search
   * Advanced search with complex filtering
   */
  @Post('search')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async searchAuditLogs(
    @Body() body: {
      filters: AuditLogFilterDto;
      pagination: PaginationDto;
    },
    @CurrentUser() user: any,
  ): Promise<PaginatedAuditLogsDto> {
    try {
      const hospitalId = user.role === 'SUPER_ADMIN'
        ? body.filters.hospitalId || user.hospitalId
        : user.hospitalId;

      const auditFilters = {
        ...body.filters,
        hospitalId,
        startDate: body.filters.startDate
          ? new Date(body.filters.startDate)
          : undefined,
        endDate: body.filters.endDate
          ? new Date(body.filters.endDate)
          : undefined,
      };

      return await this.auditLogViewerService.getAuditLogs(
        auditFilters,
        body.pagination || { limit: 50 },
      );
    } catch (error) {
      this.logger.error(`Search failed: ${error.message}`);
      throw new HttpException(
        'Search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/audit-logs/entity/:type/:id/history
   * Get change history for a specific entity
   */
  @Get('entity/:type/:id/history')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getEntityHistory(
    @CurrentUser() user: any,
    @Param('type') entityType: string,
    @Param('id') entityId: string,
  ): Promise<EntityHistoryDto> {
    try {
      const logs = await this.auditLogViewerService.getEntityHistory(
        entityType,
        entityId,
      );

      // Check authorization (only see hospital's logs)
      if (
        logs.length > 0 &&
        user.role !== 'SUPER_ADMIN' &&
        logs[0].hospitalId !== user.hospitalId
      ) {
        throw new HttpException(
          'Unauthorized to view this entity history',
          HttpStatus.FORBIDDEN,
        );
      }

      const lastLog = logs[0];
      return {
        logs,
        entityType,
        entityId,
        totalChanges: logs.length,
        lastModifiedAt: lastLog?.timestamp || null,
        lastModifiedBy: lastLog?.userId || null,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Failed to fetch entity history: ${error.message}`,
      );
      throw new HttpException(
        'Failed to retrieve entity history',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/audit-logs/user/:userId/activity
   * Get activity log for a specific user
   */
  @Get('user/:userId/activity')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getUserActivity(
    @CurrentUser() user: any,
    @Param('userId') userId: string,
    @Query('days') days?: string,
  ): Promise<UserActivityDto> {
    try {
      const daysToFetch = days ? Math.min(parseInt(days), 90) : 30;
      const logs = await this.auditLogViewerService.getUserActivity(
        userId,
        user.hospitalId,
        daysToFetch,
      );

      const actionsByType: Record<string, number> = {};
      for (const log of logs) {
        actionsByType[log.action] = (actionsByType[log.action] || 0) + 1;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysToFetch);

      return {
        logs,
        userId,
        totalActions: logs.length,
        actionsByType,
        dateRange: {
          startDate,
          endDate: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch user activity: ${error.message}`);
      throw new HttpException(
        'Failed to retrieve user activity',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/audit-logs/sensitive
   * Get sensitive operations in the hospital
   */
  @Get('sensitive')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getSensitiveOperations(
    @CurrentUser() user: any,
    @Query('days') days?: string,
  ): Promise<SensitiveOperationsDto> {
    try {
      const daysToFetch = days ? Math.min(parseInt(days), 90) : 30;
      const logs = await this.auditLogViewerService.getSensitiveOperations(
        user.hospitalId,
        daysToFetch,
      );

      const operationsByType: Record<string, number> = {};
      const operationsByEntity: Record<string, number> = {};

      for (const log of logs) {
        operationsByType[log.action] =
          (operationsByType[log.action] || 0) + 1;
        operationsByEntity[log.entityType] =
          (operationsByEntity[log.entityType] || 0) + 1;
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysToFetch);

      return {
        logs,
        hospitalId: user.hospitalId,
        totalOperations: logs.length,
        operationsByType,
        operationsByEntity,
        dateRange: {
          startDate,
          endDate: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch sensitive operations: ${error.message}`,
      );
      throw new HttpException(
        'Failed to retrieve sensitive operations',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/audit-logs/suspicious
   * Get suspicious activities in the hospital
   */
  @Get('suspicious')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getSuspiciousActivity(
    @CurrentUser() user: any,
    @Query('days') days?: string,
  ) {
    try {
      const daysToFetch = days ? Math.min(parseInt(days), 90) : 7;
      const logs = await this.auditLogViewerService.getSuspiciousActivity(
        user.hospitalId,
        daysToFetch,
      );

      return {
        logs,
        hospitalId: user.hospitalId,
        count: logs.length,
        dateRange: {
          startDate: new Date(Date.now() - daysToFetch * 24 * 60 * 60 * 1000),
          endDate: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch suspicious activities: ${error.message}`,
      );
      throw new HttpException(
        'Failed to retrieve suspicious activities',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/v1/audit-logs/statistics
   * Get audit statistics for the hospital
   */
  @Get('statistics')
  @Roles('SUPER_ADMIN', 'ADMIN', 'AUDIT_MANAGER')
  async getAuditStatistics(
    @CurrentUser() user: any,
    @Query('days') days?: string,
  ): Promise<AuditStatisticsDto> {
    try {
      const daysToFetch = days ? Math.min(parseInt(days), 365) : 30;
      return await this.auditLogViewerService.getAuditStatistics(
        user.hospitalId,
        daysToFetch,
      );
    } catch (error) {
      this.logger.error(
        `Failed to fetch audit statistics: ${error.message}`,
      );
      throw new HttpException(
        'Failed to retrieve audit statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

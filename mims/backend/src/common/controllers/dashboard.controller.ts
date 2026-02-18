import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { CurrentHospital } from '../../common/decorators/current-hospital.decorator';
import { DashboardService } from '../services/dashboard.service';
import { ExportService } from '../services/export.service';
import { ComplianceService } from '../services/compliance.service';
import {
  DashboardMetricsDto,
  ThreatTrendDto,
  ComplianceStatusDto,
  EncryptionStatusDto,
  AlertDistributionDto,
  AuditActivityDto,
  ExportRequestDto,
  ExportResponseDto,
  ComplianceReportDto,
  ComplianceMetricsDto,
} from '../dtos/dashboard.dto';

/**
 * DashboardController provides security dashboard endpoints for admin users
 * All endpoints require JwtAuthGuard + RolesGuard authorization
 * All data is hospital-scoped
 *
 * Endpoints (8):
 * 1. GET /dashboard/metrics - Security metrics
 * 2. GET /dashboard/threats/trend - Threat trends
 * 3. GET /dashboard/compliance/status - Compliance status
 * 4. GET /dashboard/encryption/status - Encryption status
 * 5. GET /dashboard/alerts/distribution - Alert distribution
 * 6. GET /dashboard/audit/activity - Audit activity summary
 * 7. POST /dashboard/export - Export data (CSV/JSON/PDF)
 * 8. GET /dashboard/compliance/report/:reportType - Compliance reports
 */
@ApiTags('Dashboard')
@Controller('api/v1/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly exportService: ExportService,
    private readonly complianceService: ComplianceService,
  ) {}

  /**
   * Get comprehensive security dashboard metrics
   * Time range: last 24 hours by default, configurable via query
   *
   * Returns: DashboardMetricsDto with threat counts, audit activity, severity levels
   * Requires: SYSTEM, SUPER_ADMIN, SECURITY_OFFICER, ADMIN, or AUDIT_MANAGER role
   */
  @Get('metrics')
  @Roles('SYSTEM', 'SUPER_ADMIN', 'SECURITY_OFFICER', 'ADMIN', 'AUDIT_MANAGER')
  @ApiOperation({
    summary: 'Get security dashboard metrics',
    description:
      'Retrieve comprehensive security metrics including threat counts, audit activity, and severity levels',
  })
  @ApiResponse({
    status: 200,
    description: 'Dashboard metrics retrieved successfully',
    type: DashboardMetricsDto,
  })
  @HttpCode(HttpStatus.OK)
  async getMetrics(
    @CurrentHospital() hospitalId: string,
    @Query('hours') hours?: string,
  ): Promise<DashboardMetricsDto> {
    const hoursBack = hours ? parseInt(hours, 10) : 24;
    if (isNaN(hoursBack) || hoursBack < 1 || hoursBack > 720) {
      throw new BadRequestException(
        'Invalid hours parameter. Must be between 1 and 720 (30 days)',
      );
    }
    return this.dashboardService.getSecurityMetrics(hospitalId, hoursBack);
  }

  /**
   * Get threat trend analysis over time
   * Time range: last 7 days by default, configurable via query
   *
   * Returns: ThreatTrendDto with daily threat counts, severity distribution, trend direction
   * Requires: SYSTEM, SUPER_ADMIN, SECURITY_OFFICER, ADMIN, or AUDIT_MANAGER role
   */
  @Get('threats/trend')
  @Roles('SYSTEM', 'SUPER_ADMIN', 'SECURITY_OFFICER', 'ADMIN', 'AUDIT_MANAGER')
  @ApiOperation({
    summary: 'Get threat trend analysis',
    description:
      'Analyze threat trends over time with daily counts and severity distribution',
  })
  @ApiResponse({
    status: 200,
    description: 'Threat trend data retrieved successfully',
    type: ThreatTrendDto,
  })
  @HttpCode(HttpStatus.OK)
  async getThreatTrend(
    @CurrentHospital() hospitalId: string,
    @Query('days') days?: string,
  ): Promise<ThreatTrendDto> {
    const daysBack = days ? parseInt(days, 10) : 7;
    if (isNaN(daysBack) || daysBack < 1 || daysBack > 90) {
      throw new BadRequestException(
        'Invalid days parameter. Must be between 1 and 90',
      );
    }
    return this.dashboardService.getThreatTrend(hospitalId, daysBack);
  }

  /**
   * Get compliance status for the hospital
   * Assesses compliance with security policies
   *
   * Returns: ComplianceStatusDto with compliance score, checks, recommendations
   * Requires: SYSTEM, SUPER_ADMIN, SECURITY_OFFICER, or ADMIN role
   */
  @Get('compliance/status')
  @Roles('SYSTEM', 'SUPER_ADMIN', 'SECURITY_OFFICER', 'ADMIN')
  @ApiOperation({
    summary: 'Get compliance status',
    description:
      'Retrieve current compliance status and recommendations for security improvements',
  })
  @ApiResponse({
    status: 200,
    description: 'Compliance status retrieved successfully',
    type: ComplianceStatusDto,
  })
  @HttpCode(HttpStatus.OK)
  async getComplianceStatus(
    @CurrentHospital() hospitalId: string,
  ): Promise<ComplianceStatusDto> {
    return this.dashboardService.getComplianceStatus(hospitalId);
  }

  /**
   * Get encryption status and key rotation information
   * Monitors encryption algorithm, coverage, and key rotation schedule
   *
   * Returns: EncryptionStatusDto with algorithm, coverage percentage, rotation status
   * Requires: SYSTEM, SUPER_ADMIN, SECURITY_OFFICER, or ADMIN role
   */
  @Get('encryption/status')
  @Roles('SYSTEM', 'SUPER_ADMIN', 'SECURITY_OFFICER', 'ADMIN')
  @ApiOperation({
    summary: 'Get encryption status',
    description:
      'Monitor encryption coverage, algorithm compliance, and key rotation schedule',
  })
  @ApiResponse({
    status: 200,
    description: 'Encryption status retrieved successfully',
    type: EncryptionStatusDto,
  })
  @HttpCode(HttpStatus.OK)
  async getEncryptionStatus(
    @CurrentHospital() hospitalId: string,
  ): Promise<EncryptionStatusDto> {
    return this.dashboardService.getEncryptionStatus(hospitalId);
  }

  /**
   * Get alert distribution by severity and type
   * Time range: last 7 days by default, configurable via query
   *
   * Returns: AlertDistributionDto with counts by severity and type
   * Requires: SYSTEM, SUPER_ADMIN, SECURITY_OFFICER, ADMIN, or AUDIT_MANAGER role
   */
  @Get('alerts/distribution')
  @Roles('SYSTEM', 'SUPER_ADMIN', 'SECURITY_OFFICER', 'ADMIN', 'AUDIT_MANAGER')
  @ApiOperation({
    summary: 'Get alert distribution',
    description: 'Analyze alerts by severity level and threat type',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert distribution retrieved successfully',
    type: AlertDistributionDto,
  })
  @HttpCode(HttpStatus.OK)
  async getAlertDistribution(
    @CurrentHospital() hospitalId: string,
    @Query('days') days?: string,
  ): Promise<AlertDistributionDto> {
    const daysBack = days ? parseInt(days, 10) : 7;
    if (isNaN(daysBack) || daysBack < 1 || daysBack > 90) {
      throw new BadRequestException(
        'Invalid days parameter. Must be between 1 and 90',
      );
    }
    return this.dashboardService.getAlertDistribution(hospitalId, daysBack);
  }

  /**
   * Get audit activity summary
   * Time range: last 7 days by default, configurable via query
   *
   * Returns: AuditActivityDto with action counts and recent activities
   * Requires: SYSTEM, SUPER_ADMIN, SECURITY_OFFICER, ADMIN, or AUDIT_MANAGER role
   */
  @Get('audit/activity')
  @Roles('SYSTEM', 'SUPER_ADMIN', 'SECURITY_OFFICER', 'ADMIN', 'AUDIT_MANAGER')
  @ApiOperation({
    summary: 'Get audit activity summary',
    description: 'Review recent audit activity and action statistics',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit activity retrieved successfully',
    type: AuditActivityDto,
  })
  @HttpCode(HttpStatus.OK)
  async getAuditActivity(
    @CurrentHospital() hospitalId: string,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ): Promise<AuditActivityDto> {
    const daysBack = days ? parseInt(days, 10) : 7;
    const limitValue = limit ? parseInt(limit, 10) : 10;

    if (isNaN(daysBack) || daysBack < 1 || daysBack > 90) {
      throw new BadRequestException(
        'Invalid days parameter. Must be between 1 and 90',
      );
    }
    if (isNaN(limitValue) || limitValue < 1 || limitValue > 100) {
      throw new BadRequestException(
        'Invalid limit parameter. Must be between 1 and 100',
      );
    }

    return this.dashboardService.getAuditActivity(
      hospitalId,
      daysBack,
      limitValue,
    );
  }

  /**
   * Export security data in specified format (CSV, JSON, PDF)
   * Supports both audit logs and threat alerts
   *
   * Request body: ExportRequestDto with format, dataType, and optional dateRange
   * Returns: ExportResponseDto with filename and file content
   * Requires: SYSTEM, SUPER_ADMIN, SECURITY_OFFICER, or ADMIN role
   */
  @Post('export')
  @Roles('SYSTEM', 'SUPER_ADMIN', 'SECURITY_OFFICER', 'ADMIN')
  @ApiOperation({
    summary: 'Export security data',
    description:
      'Export audit logs or threat alerts in CSV, JSON, or PDF format',
  })
  @ApiResponse({
    status: 200,
    description: 'Data exported successfully',
    type: ExportResponseDto,
  })
  @HttpCode(HttpStatus.OK)
  async exportData(
    @CurrentHospital() hospitalId: string,
    @Body() request: ExportRequestDto,
  ): Promise<ExportResponseDto> {
    // Validate date range
    if (request.startDate && request.endDate) {
      if (request.startDate > request.endDate) {
        throw new BadRequestException('startDate must be before endDate');
      }
      const daysDiff =
        (request.endDate.getTime() - request.startDate.getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysDiff > 90) {
        throw new BadRequestException(
          'Date range cannot exceed 90 days for export',
        );
      }
    }

    let data: string;
    let filename: string;
    let mimeType: string;

    if (request.dataType === 'audit') {
      if (request.format === 'CSV') {
        data = await this.exportService.exportAuditLogsToCSV(
          hospitalId,
          request.startDate,
          request.endDate,
        );
        filename = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else if (request.format === 'JSON') {
        data = await this.exportService.exportAuditLogsToJSON(
          hospitalId,
          request.startDate,
          request.endDate,
        );
        filename = `audit_logs_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else {
        // PDF
        data = await this.exportService.exportAuditLogsToPDF(
          hospitalId,
          request.startDate,
          request.endDate,
        );
        filename = `audit_logs_${new Date().toISOString().split('T')[0]}.pdf`;
        mimeType = 'text/plain'; // Simplified for demo
      }
    } else {
      // threats
      if (request.format === 'CSV') {
        data = await this.exportService.exportThreatsToCSV(
          hospitalId,
          request.startDate,
          request.endDate,
        );
        filename = `threat_alerts_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else if (request.format === 'JSON') {
        data = await this.exportService.exportThreatsToJSON(
          hospitalId,
          request.startDate,
          request.endDate,
        );
        filename = `threat_alerts_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      } else {
        // PDF
        data = await this.exportService.exportThreatsToPDF(
          hospitalId,
          request.startDate,
          request.endDate,
        );
        filename = `threat_alerts_${new Date().toISOString().split('T')[0]}.pdf`;
        mimeType = 'text/plain';
      }
    }

    return {
      hospitalId,
      dataType: request.dataType,
      format: request.format,
      generatedDate: new Date(),
      filename,
      mimeType,
      data,
    };
  }

  /**
   * Get compliance report (monthly, quarterly, or annual)
   *
   * Path parameters: reportType (monthly, quarterly, annual)
   * Query parameters: year, month (for monthly), quarter (for quarterly)
   * Returns: ComplianceReportDto with metrics, findings, recommendations
   * Requires: SYSTEM, SUPER_ADMIN, SECURITY_OFFICER, or ADMIN role
   */
  @Get('compliance/report/:reportType')
  @Roles('SYSTEM', 'SUPER_ADMIN', 'SECURITY_OFFICER', 'ADMIN')
  @ApiOperation({
    summary: 'Get compliance report',
    description:
      'Generate monthly, quarterly, or annual compliance reports with detailed findings',
  })
  @ApiResponse({
    status: 200,
    description: 'Compliance report generated successfully',
    type: ComplianceReportDto,
  })
  @HttpCode(HttpStatus.OK)
  async getComplianceReport(
    @CurrentHospital() hospitalId: string,
    @Param('reportType') reportType: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('quarter') quarter?: string,
  ): Promise<ComplianceReportDto> {
    const currentYear = new Date().getFullYear();
    const reportYear = year ? parseInt(year, 10) : currentYear;

    if (isNaN(reportYear) || reportYear < 2020 || reportYear > currentYear) {
      throw new BadRequestException('Invalid year parameter');
    }

    if (reportType === 'monthly') {
      const currentMonth = new Date().getMonth() + 1;
      const reportMonth = month ? parseInt(month, 10) : currentMonth;

      if (isNaN(reportMonth) || reportMonth < 1 || reportMonth > 12) {
        throw new BadRequestException(
          'Invalid month parameter. Must be between 1 and 12',
        );
      }

      return this.complianceService.generateMonthlyReport(
        hospitalId,
        reportYear,
        reportMonth,
      );
    } else if (reportType === 'quarterly') {
      const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
      const reportQuarter = quarter ? parseInt(quarter, 10) : currentQuarter;

      if (isNaN(reportQuarter) || reportQuarter < 1 || reportQuarter > 4) {
        throw new BadRequestException(
          'Invalid quarter parameter. Must be between 1 and 4',
        );
      }

      return this.complianceService.generateQuarterlyReport(
        hospitalId,
        reportYear,
        reportQuarter,
      );
    } else if (reportType === 'annual') {
      return this.complianceService.generateAnnualReport(
        hospitalId,
        reportYear,
      );
    } else {
      throw new BadRequestException(
        'Invalid reportType. Must be one of: monthly, quarterly, annual',
      );
    }
  }
}

import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Get dashboard overview with key metrics
   */
  @Get('overview')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'AUDITOR')
  async getOverview(@Query() query: AnalyticsQueryDto, @Request() req) {
    const user = req.user;
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.analyticsService.getDashboardOverview({
      ...query,
      hospitalId,
    });
  }

  /**
   * Get stock trends over time
   */
  @Get('stock-trends')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'AUDITOR')
  async getStockTrends(@Query() query: AnalyticsQueryDto, @Request() req) {
    const user = req.user;
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.analyticsService.getStockTrends({
      ...query,
      hospitalId,
    });
  }

  /**
   * Get medicine consumption trends
   */
  @Get('consumption-trends')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'AUDITOR')
  async getConsumptionTrends(@Query() query: AnalyticsQueryDto, @Request() req) {
    const user = req.user;
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.analyticsService.getConsumptionTrends({
      ...query,
      hospitalId,
    });
  }

  /**
   * Get top medicines by consumption
   */
  @Get('top-medicines')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'AUDITOR')
  async getTopMedicines(@Query() query: AnalyticsQueryDto, @Request() req) {
    const user = req.user;
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.analyticsService.getTopMedicines({
      ...query,
      hospitalId,
    });
  }

  /**
   * Get pharmacy performance comparison
   */
  @Get('pharmacy-performance')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'AUDITOR')
  async getPharmacyPerformance(@Query() query: AnalyticsQueryDto, @Request() req) {
    const user = req.user;
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.analyticsService.getPharmacyPerformance({
      ...query,
      hospitalId,
    });
  }

  /**
   * Get financial overview
   */
  @Get('financial')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'AUDITOR')
  async getFinancialOverview(@Query() query: AnalyticsQueryDto, @Request() req) {
    const user = req.user;
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.analyticsService.getFinancialOverview({
      ...query,
      hospitalId,
    });
  }

  /**
   * Get expiry analysis
   */
  @Get('expiry-analysis')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'AUDITOR')
  async getExpiryAnalysis(@Query() query: AnalyticsQueryDto, @Request() req) {
    const user = req.user;
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.analyticsService.getExpiryAnalysis({
      ...query,
      hospitalId,
    });
  }

  /**
   * Get transfer efficiency metrics
   */
  @Get('transfer-metrics')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'AUDITOR')
  async getTransferMetrics(@Query() query: AnalyticsQueryDto, @Request() req) {
    const user = req.user;
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.analyticsService.getTransferMetrics({
      ...query,
      hospitalId,
    });
  }
}

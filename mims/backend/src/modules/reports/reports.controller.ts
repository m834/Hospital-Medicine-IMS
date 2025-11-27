import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { DailyTransactionReportDto } from './dto/daily-transaction-report.dto';
import { DateRangeReportDto } from './dto/date-range-report.dto';
import { DetailedDailyReportDto, MedicineConsumptionDto } from './dto/detailed-daily-report.dto';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * Get daily transaction report for a specific date
   * Authorized roles: SUPER_ADMIN, HOSPITAL_ADMIN, MAIN_PHARMACY_MANAGER, SUB_PHARMACY_MANAGER, AUDITOR
   */
  @Get('daily')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'AUDITOR')
  async getDailyReport(@Query() query: DailyTransactionReportDto, @Request() req) {
    const user = req.user;

    // Validate hospital access for SUPER_ADMIN
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    // SUPER_ADMIN can query any hospital
    // Others can only query their assigned hospital
    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.reportsService.getDailyTransactionReport({
      ...query,
      hospitalId,
    });
  }

  /**
   * Get date range transaction report
   * Authorized roles: SUPER_ADMIN, HOSPITAL_ADMIN, MAIN_PHARMACY_MANAGER, SUB_PHARMACY_MANAGER, AUDITOR
   */
  @Get('range')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'AUDITOR')
  async getDateRangeReport(@Query() query: DateRangeReportDto, @Request() req) {
    const user = req.user;

    // Validate hospital access for SUPER_ADMIN
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    // SUPER_ADMIN can query any hospital
    // Others can only query their assigned hospital
    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.reportsService.getDateRangeReport({
      ...query,
      hospitalId,
    });
  }

  /**
   * Get detailed daily transaction report with medicine-wise breakdown
   * Includes: opening/closing balances per medicine, detailed GRNs, transfers, issues
   * Authorized roles: SUPER_ADMIN, HOSPITAL_ADMIN, MAIN_PHARMACY_MANAGER, SUB_PHARMACY_MANAGER, AUDITOR
   */
  @Get('detailed-daily')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'AUDITOR')
  async getDetailedDailyReport(@Query() query: DetailedDailyReportDto, @Request() req) {
    const user = req.user;

    // Validate hospital access
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.reportsService.getDetailedDailyReport(
      query.pharmacyId,
      query.date,
      hospitalId,
    );
  }

  /**
   * Get medicine consumption summary for a period
   * Shows total consumption per medicine with patient breakdown
   * Authorized roles: SUPER_ADMIN, HOSPITAL_ADMIN, MAIN_PHARMACY_MANAGER, SUB_PHARMACY_MANAGER, AUDITOR
   */
  @Get('medicine-consumption')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'MAIN_PHARMACY_MANAGER', 'SUB_PHARMACY_MANAGER', 'AUDITOR')
  async getMedicineConsumption(@Query() query: MedicineConsumptionDto, @Request() req) {
    const user = req.user;

    // Validate hospital access
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    const startDate = new Date(query.startDate);
    const endDate = new Date(query.endDate);
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return this.reportsService.getMedicineConsumptionSummary(
      query.pharmacyId,
      startDate,
      endDate,
    );
  }
}

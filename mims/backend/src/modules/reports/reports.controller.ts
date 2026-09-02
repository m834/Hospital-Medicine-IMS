import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { DailyTransactionReportDto } from './dto/daily-transaction-report.dto';
import { DateRangeReportDto } from './dto/date-range-report.dto';
import { DetailedDailyReportDto, MedicineConsumptionDto } from './dto/detailed-daily-report.dto';
import { FinancialSummaryDto } from './dto/financial-summary.dto';
import { RegistrationReportDto } from './dto/registration-report.dto';

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

  /**
   * Financial summary report (Income, Expenses, Payroll, Profit/Loss)
   * Period: DAILY | WEEKLY | MONTHLY | YEARLY
   * Authorized roles: SUPER_ADMIN, HOSPITAL_ADMIN, AUDITOR
   */
  @Get('financial-summary')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'AUDITOR')
  async getFinancialSummary(@Query() query: FinancialSummaryDto, @Request() req) {
    const user = req.user;
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.reportsService.getFinancialSummary({
      ...query,
      hospitalId,
    });
  }

  /**
   * Comprehensive financial report with categorized income and payroll breakdown
   * Period: DAILY | WEEKLY | MONTHLY | YEARLY
   * Authorized roles: SUPER_ADMIN, HOSPITAL_ADMIN, AUDITOR
   */
  @Get('financial-detailed')
  @Roles('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'AUDITOR')
  async getFinancialDetailed(@Query() query: FinancialSummaryDto, @Request() req) {
    const user = req.user;
    const hospitalId = query.hospitalId || user.hospitalId;

    if (!hospitalId) {
      throw new Error('Hospital ID is required');
    }

    if (user.role !== 'SUPER_ADMIN' && hospitalId !== user.hospitalId) {
      throw new Error('Unauthorized to access this hospital data');
    }

    return this.reportsService.getComprehensiveFinancialReport({
      ...query,
      hospitalId,
    });
  }

  /**
   * Registration desk report: patient registrations and lab test revenue for a
   * date range, broken down per registering staff member and grouped by their
   * department. A single-day ("daily") report is the same range with
   * startDate === endDate.
   *
   * Authorized roles: MASTER_ADMIN, SUPER_ADMIN, HOSPITAL_ADMIN,
   * REGISTRATION_STAFF_MANAGER. The guard rejects everyone else at the
   * endpoint, so hiding the menu entry is presentation only.
   */
  @Get('registration')
  @Roles('MASTER_ADMIN', 'SUPER_ADMIN', 'HOSPITAL_ADMIN', 'REGISTRATION_STAFF_MANAGER')
  async getRegistrationReport(@Query() query: RegistrationReportDto, @Request() req) {
    return this.reportsService.getRegistrationReport({
      ...query,
      hospitalId: this.resolveHospitalId(req.user, query.hospitalId),
    });
  }

  /**
   * Resolve which hospital a report covers from the token, never from the query
   * string alone. A user carrying a hospitalId is pinned to it; only a
   * platform admin (who has none of their own) may name one.
   */
  private resolveHospitalId(user: { hospitalId?: string | null }, requested?: string) {
    if (user?.hospitalId) {
      if (requested && requested !== user.hospitalId) {
        throw new ForbiddenException('Unauthorized to access this hospital data');
      }
      return user.hospitalId;
    }

    if (!requested) {
      throw new BadRequestException('Hospital ID is required');
    }

    return requested;
  }
}

import { Controller, Get, Put, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentHospital } from '@/common/decorators/current-hospital.decorator';
import { PayrollService } from './payroll.service';
import { PayrollGenerateDto, PayrollRunQueryDto, UpsertPayrollSettingDto } from './dto/payroll.dto';

@ApiTags('Payroll')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('payroll')
export class PayrollController {
  constructor(private payrollService: PayrollService) {}

  @ApiOperation({ summary: 'List payroll settings' })
  @Get('settings')
  @HttpCode(HttpStatus.OK)
  async listSettings(@CurrentHospital() hospitalId: string) {
    return this.payrollService.listSettings(hospitalId);
  }

  @ApiOperation({ summary: 'Get payroll setting for employee' })
  @Get('settings/:employeeId')
  @HttpCode(HttpStatus.OK)
  async getSetting(
    @CurrentHospital() hospitalId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.payrollService.getSetting(hospitalId, employeeId);
  }

  @ApiOperation({ summary: 'Create/update payroll setting for employee' })
  @Put('settings/:employeeId')
  @HttpCode(HttpStatus.OK)
  async upsertSetting(
    @CurrentHospital() hospitalId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: UpsertPayrollSettingDto,
  ) {
    return this.payrollService.upsertSetting(hospitalId, employeeId, dto);
  }

  @ApiOperation({ summary: 'Run payroll for employee' })
  @Get('run')
  @HttpCode(HttpStatus.OK)
  async runPayroll(
    @CurrentHospital() hospitalId: string,
    @Query() query: PayrollRunQueryDto,
  ) {
    return this.payrollService.runPayroll(hospitalId, query.year, query.month, query.employeeId as string);
  }

  @ApiOperation({ summary: 'Run payroll for all employees' })
  @Get('run/batch')
  @HttpCode(HttpStatus.OK)
  async runPayrollBatch(
    @CurrentHospital() hospitalId: string,
    @Query() query: PayrollRunQueryDto,
  ) {
    return this.payrollService.runPayrollBatch(hospitalId, query.year, query.month);
  }

  @ApiOperation({ summary: 'Check if payroll already generated for month' })
  @Get('generated')
  @HttpCode(HttpStatus.OK)
  async isPayrollGenerated(
    @CurrentHospital() hospitalId: string,
    @Query() query: PayrollRunQueryDto,
  ) {
    return this.payrollService.isPayrollGenerated(hospitalId, query.year, query.month);
  }

  @ApiOperation({ summary: 'Generate payroll for all employees' })
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generatePayrollBatch(
    @CurrentHospital() hospitalId: string,
    @Body() dto: PayrollGenerateDto,
  ) {
    return this.payrollService.generatePayrollBatch(hospitalId, dto.year, dto.month);
  }
}

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AttendanceRecordsService } from './attendance-records.service';
import {
  MarkAttendanceDto,
  CorrectAttendanceDto,
  QueryAttendanceDto,
  AttendanceSummaryDto,
  MonthlyAttendanceDto,
  AttendanceLeaveCheckDto,
  BulkMarkAttendanceDto,
  AttendanceReportDto,
} from './dto/attendance-records.dto';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CurrentHospital } from '@/common/decorators/current-hospital.decorator';

@ApiTags('Attendance Records')
@Controller('attendance-records')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AttendanceRecordsController {
  constructor(private readonly recordService: AttendanceRecordsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Mark attendance for an employee' })
  @ApiResponse({ status: 201, description: 'Attendance marked successfully' })
  async markAttendance(
    @CurrentHospital() hospitalId: string,
    @Body() dto: MarkAttendanceDto,
  ) {
    return this.recordService.markAttendance(hospitalId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Query attendance records' })
  @ApiResponse({
    status: 200,
    description: 'Attendance records retrieved successfully',
    isArray: true,
  })
  async queryAttendance(
    @CurrentHospital() hospitalId: string,
    @Query() query?: QueryAttendanceDto,
  ) {
    return this.recordService.queryAttendanceRecords(hospitalId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get attendance record by ID' })
  @ApiResponse({ status: 200, description: 'Attendance record retrieved successfully' })
  async getAttendanceRecord(
    @CurrentHospital() hospitalId: string,
    @Param('id') recordId: string,
  ) {
    return this.recordService.getAttendanceRecord(hospitalId, recordId);
  }

  @Get('employee/:employeeId')
  @ApiOperation({ summary: 'Get attendance history for employee' })
  @ApiResponse({
    status: 200,
    description: 'Attendance history retrieved successfully',
    isArray: true,
  })
  async getEmployeeHistory(
    @CurrentHospital() hospitalId: string,
    @Param('employeeId') employeeId: string,
    @Query('limit') limit?: string,
  ) {
    return this.recordService.getEmployeeAttendanceHistory(
      hospitalId,
      employeeId,
      limit ? parseInt(limit) : 30,
    );
  }

  @Put(':id')
  @ApiOperation({ summary: 'Correct attendance record' })
  @ApiResponse({ status: 200, description: 'Attendance corrected successfully' })
  async correctAttendance(
    @CurrentHospital() hospitalId: string,
    @Param('id') recordId: string,
    @Body() dto: CorrectAttendanceDto,
  ) {
    return this.recordService.correctAttendance(hospitalId, recordId, dto);
  }

  @Get('summary/daily')
  @ApiOperation({ summary: 'Get daily attendance summary' })
  @ApiResponse({ status: 200, description: 'Daily summary retrieved successfully' })
  async getDailySummary(
    @CurrentHospital() hospitalId: string,
    @Query() query: AttendanceSummaryDto,
  ) {
    return this.recordService.getDailySummary(hospitalId, query);
  }

  @Post('summary/monthly')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get monthly attendance summary' })
  @ApiResponse({ status: 200, description: 'Monthly summary retrieved successfully' })
  async getMonthlyAttendance(
    @CurrentHospital() hospitalId: string,
    @Body() dto: MonthlyAttendanceDto,
  ) {
    return this.recordService.getMonthlyAttendance(hospitalId, dto);
  }

  @Post('check-leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if employee has approved leave on date' })
  @ApiResponse({ status: 200, description: 'Leave status checked' })
  async checkLeave(
    @CurrentHospital() hospitalId: string,
    @Body() dto: AttendanceLeaveCheckDto,
  ) {
    return this.recordService.checkLeaveOnDate(hospitalId, dto);
  }

  @Post('bulk-mark')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bulk mark attendance for multiple employees' })
  @ApiResponse({ status: 201, description: 'Bulk attendance marked successfully' })
  async bulkMarkAttendance(
    @CurrentHospital() hospitalId: string,
    @Body() dto: BulkMarkAttendanceDto,
  ) {
    return this.recordService.bulkMarkAttendance(hospitalId, dto);
  }

  @Get('report/generate')
  @ApiOperation({ summary: 'Generate attendance report' })
  @ApiResponse({ status: 200, description: 'Report generated successfully' })
  async generateReport(
    @CurrentHospital() hospitalId: string,
    @Query() query: AttendanceReportDto,
  ) {
    return this.recordService.getAttendanceReport(hospitalId, query);
  }

  @Get('report/export')
  @ApiOperation({ summary: 'Export attendance report' })
  @ApiResponse({ status: 200, description: 'Report exported successfully' })
  async exportReport(
    @CurrentHospital() hospitalId: string,
    @Query() query: AttendanceReportDto,
  ) {
    const report = await this.recordService.getAttendanceReport(hospitalId, query);
    return {
      format: 'csv',
      data: report,
      exportedAt: new Date(),
    };
  }

  @Get('statistics/count')
  @ApiOperation({ summary: 'Get attendance count statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getAttendanceStats(
    @CurrentHospital() hospitalId: string,
    @Query('date') date?: string,
  ) {
    const summary = await this.recordService.getDailySummary(hospitalId, {
      date: date || new Date().toISOString(),
    });

    return {
      date: summary.date,
      total: summary.total,
      present: summary.present,
      absent: summary.absent,
      late: summary.late,
      halfDay: summary.halfDay,
      leave: summary.leave,
      presentPercentage: summary.total > 0 ? (summary.present / summary.total) * 100 : 0,
      absentPercentage: summary.total > 0 ? (summary.absent / summary.total) * 100 : 0,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete attendance record (soft delete)' })
  @ApiResponse({ status: 204, description: 'Attendance record deleted' })
  async deleteAttendance(
    @CurrentHospital() hospitalId: string,
    @Param('id') recordId: string,
  ) {
    // In a real system, implement soft delete
    // For now, just correct to ABSENT status
    await this.recordService.correctAttendance(hospitalId, recordId, {
      status: 'ABSENT' as any,
      reason: 'Record deleted',
    });
  }
}

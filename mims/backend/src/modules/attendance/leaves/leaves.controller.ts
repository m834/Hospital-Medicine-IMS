import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CurrentHospital } from '@/common/decorators/current-hospital.decorator';
import { LeavesService } from './leaves.service';
import {
  ApplyLeaveDto,
  ProcessLeaveRequestDto,
  UpdateLeaveRequestDto,
  CancelLeaveRequestDto,
  QueryLeaveRequestsDto,
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
  CreateHolidayDto,
  UpdateHolidayDto,
  BulkProcessLeaveDto,
  LeaveStatisticsQueryDto,
} from './dto/leaves.dto';

@ApiTags('Leave Management')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('leaves')
export class LeavesController {
  constructor(private leavesService: LeavesService) {}

  /**
   * LEAVE REQUEST ENDPOINTS
   */

  @ApiOperation({ summary: 'Apply for leave' })
  @Post('requests/apply')
  @HttpCode(HttpStatus.CREATED)
  async applyForLeave(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() user: any,
    @Body() dto: ApplyLeaveDto,
  ) {
    return this.leavesService.applyForLeave(hospitalId, user.id, dto);
  }

  @ApiOperation({ summary: 'Get leave request by ID' })
  @Get('requests/:leaveRequestId')
  @HttpCode(HttpStatus.OK)
  async getLeaveRequest(
    @CurrentHospital() hospitalId: string,
    @Param('leaveRequestId') leaveRequestId: string,
  ) {
    return this.leavesService.getLeaveRequestById(hospitalId, leaveRequestId);
  }

  @ApiOperation({ summary: 'Query leave requests with filters' })
  @Get('requests')
  @HttpCode(HttpStatus.OK)
  async queryLeaveRequests(
    @CurrentHospital() hospitalId: string,
    @Query() query: QueryLeaveRequestsDto,
  ) {
    return this.leavesService.queryLeaveRequests(hospitalId, query);
  }

  @ApiOperation({ summary: 'Update pending leave request' })
  @Put('requests/:leaveRequestId')
  @HttpCode(HttpStatus.OK)
  async updateLeaveRequest(
    @CurrentHospital() hospitalId: string,
    @Param('leaveRequestId') leaveRequestId: string,
    @Body() dto: UpdateLeaveRequestDto,
  ) {
    return this.leavesService.updateLeaveRequest(hospitalId, leaveRequestId, dto);
  }

  @ApiOperation({ summary: 'Approve or reject leave request' })
  @Post('requests/:leaveRequestId/process')
  @HttpCode(HttpStatus.OK)
  async processLeaveRequest(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() user: any,
    @Param('leaveRequestId') leaveRequestId: string,
    @Body() dto: ProcessLeaveRequestDto,
  ) {
    return this.leavesService.processLeaveRequest(hospitalId, leaveRequestId, user.id, dto);
  }

  @ApiOperation({ summary: 'Cancel leave request' })
  @Post('requests/:leaveRequestId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelLeaveRequest(
    @CurrentHospital() hospitalId: string,
    @Param('leaveRequestId') leaveRequestId: string,
    @Body() dto: CancelLeaveRequestDto,
  ) {
    return this.leavesService.cancelLeaveRequest(hospitalId, leaveRequestId, dto);
  }

  @ApiOperation({ summary: 'Get leave history for employee' })
  @Get('history/:employeeId')
  @HttpCode(HttpStatus.OK)
  async getLeaveHistory(
    @CurrentHospital() hospitalId: string,
    @Param('employeeId') employeeId: string,
    @Query() query: QueryLeaveRequestsDto,
  ) {
    return this.leavesService.getLeaveHistory(hospitalId, employeeId, query);
  }

  /**
   * LEAVE BALANCE ENDPOINTS
   */

  @ApiOperation({ summary: 'Get leave balance for employee and type' })
  @Get('balance/:employeeId/:leaveTypeId')
  @HttpCode(HttpStatus.OK)
  async getLeaveBalance(
    @CurrentHospital() hospitalId: string,
    @Param('employeeId') employeeId: string,
    @Param('leaveTypeId') leaveTypeId: string,
  ) {
    // Get leave count for this employee and type
    const leaves = await this.leavesService.queryLeaveRequests(hospitalId, {
      employeeId,
      leaveTypeId,
      status: 'APPROVED' as any,
    });

    const totalDays = leaves.reduce((sum, l) => sum + parseFloat(l.totalDays.toString()), 0);
    const leaveType = await this.leavesService.getLeaveType(hospitalId, leaveTypeId);

    return {
      employeeId,
      leaveTypeId,
      leaveType: leaveType.name,
      maxDaysPerYear: leaveType.maxDaysPerYear,
      usedDays: totalDays,
      availableDays: leaveType.maxDaysPerYear - totalDays,
    };
  }

  /**
   * LEAVE TYPE ENDPOINTS
   */

  @ApiOperation({ summary: 'Create leave type' })
  @Post('types')
  @HttpCode(HttpStatus.CREATED)
  async createLeaveType(
    @CurrentHospital() hospitalId: string,
    @Body() dto: CreateLeaveTypeDto,
  ) {
    return this.leavesService.createLeaveType(hospitalId, dto);
  }

  @ApiOperation({ summary: 'Get leave type' })
  @Get('types/:leaveTypeId')
  @HttpCode(HttpStatus.OK)
  async getLeaveType(
    @CurrentHospital() hospitalId: string,
    @Param('leaveTypeId') leaveTypeId: string,
  ) {
    return this.leavesService.getLeaveType(hospitalId, leaveTypeId);
  }

  @ApiOperation({ summary: 'Get all leave types' })
  @Get('types')
  @HttpCode(HttpStatus.OK)
  async getLeaveTypes(
    @CurrentHospital() hospitalId: string,
  ) {
    return this.leavesService.getLeaveTypes(hospitalId);
  }

  @ApiOperation({ summary: 'Update leave type' })
  @Put('types/:leaveTypeId')
  @HttpCode(HttpStatus.OK)
  async updateLeaveType(
    @CurrentHospital() hospitalId: string,
    @Param('leaveTypeId') leaveTypeId: string,
    @Body() dto: UpdateLeaveTypeDto,
  ) {
    return this.leavesService.updateLeaveType(hospitalId, leaveTypeId, dto);
  }

  /**
   * HOLIDAY ENDPOINTS
   */

  @ApiOperation({ summary: 'Create holiday' })
  @Post('holidays')
  @HttpCode(HttpStatus.CREATED)
  async createHoliday(
    @CurrentHospital() hospitalId: string,
    @Body() dto: CreateHolidayDto,
  ) {
    return this.leavesService.createHoliday(hospitalId, dto);
  }

  @ApiOperation({ summary: 'Get holiday' })
  @Get('holidays/:holidayId')
  @HttpCode(HttpStatus.OK)
  async getHoliday(
    @CurrentHospital() hospitalId: string,
    @Param('holidayId') holidayId: string,
  ) {
    return this.leavesService.getHoliday(hospitalId, holidayId);
  }

  @ApiOperation({ summary: 'Get holidays for year' })
  @Get('holidays')
  @HttpCode(HttpStatus.OK)
  async getHolidays(
    @CurrentHospital() hospitalId: string,
    @Query('year') year?: string,
  ) {
    return this.leavesService.getHolidays(hospitalId, year ? parseInt(year) : undefined);
  }

  @ApiOperation({ summary: 'Update holiday' })
  @Put('holidays/:holidayId')
  @HttpCode(HttpStatus.OK)
  async updateHoliday(
    @CurrentHospital() hospitalId: string,
    @Param('holidayId') holidayId: string,
    @Body() dto: UpdateHolidayDto,
  ) {
    return this.leavesService.updateHoliday(hospitalId, holidayId, dto);
  }

  @ApiOperation({ summary: 'Delete holiday' })
  @Delete('holidays/:holidayId')
  @HttpCode(HttpStatus.OK)
  async deleteHoliday(
    @CurrentHospital() hospitalId: string,
    @Param('holidayId') holidayId: string,
  ) {
    return this.leavesService.deleteHoliday(hospitalId, holidayId);
  }

  /**
   * BULK OPERATIONS
   */

  @ApiOperation({ summary: 'Bulk process leave requests' })
  @Post('requests/bulk-process')
  @HttpCode(HttpStatus.OK)
  async bulkProcessLeaves(
    @CurrentHospital() hospitalId: string,
    @CurrentUser() user: any,
    @Body() dto: BulkProcessLeaveDto,
  ) {
    return this.leavesService.bulkProcessLeaveRequests(hospitalId, user.sub, dto);
  }

  /**
   * STATISTICS & REPORTING
   */

  @ApiOperation({ summary: 'Get leave statistics and reports' })
  @Get('statistics/summary')
  @HttpCode(HttpStatus.OK)
  async getLeaveStatistics(
    @CurrentHospital() hospitalId: string,
    @Query() query: LeaveStatisticsQueryDto,
  ) {
    return this.leavesService.getLeaveStatistics(hospitalId, query);
  }
}

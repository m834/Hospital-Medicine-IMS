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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { CurrentHospital } from '@/common/decorators/current-hospital.decorator';
import { ShiftsService } from './shifts.service';
import {
  CreateShiftDto,
  UpdateShiftDto,
  AssignShiftToEmployeeDto,
  BulkAssignShiftDto,
  QueryShiftsDto,
  QueryEmployeeShiftsDto,
  ShiftRotationDto,
  CheckShiftConflictDto,
  RemoveEmployeeShiftDto,
} from './dto/shifts.dto';

@ApiTags('Shifts Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/shifts')
export class ShiftsController {
  constructor(private shiftsService: ShiftsService) {}

  @ApiOperation({ summary: 'Create a new shift' })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createShift(
    @CurrentHospital() hospitalId: string,
    @Body() dto: CreateShiftDto,
  ) {
    return this.shiftsService.createShift(hospitalId, dto);
  }

  @ApiOperation({ summary: 'Get all shifts' })
  @Get()
  @HttpCode(HttpStatus.OK)
  async getShifts(
    @CurrentHospital() hospitalId: string,
    @Query() query: QueryShiftsDto,
  ) {
    return this.shiftsService.getShifts(hospitalId, query);
  }

  @ApiOperation({ summary: 'Get shift by ID' })
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getShift(
    @CurrentHospital() hospitalId: string,
    @Param('id') shiftId: string,
  ) {
    return this.shiftsService.getShiftById(hospitalId, shiftId);
  }

  @ApiOperation({ summary: 'Update shift' })
  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateShift(
    @CurrentHospital() hospitalId: string,
    @Param('id') shiftId: string,
    @Body() dto: UpdateShiftDto,
  ) {
    return this.shiftsService.updateShift(hospitalId, shiftId, dto);
  }

  @ApiOperation({ summary: 'Delete/deactivate shift' })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteShift(
    @CurrentHospital() hospitalId: string,
    @Param('id') shiftId: string,
  ) {
    return this.shiftsService.deleteShift(hospitalId, shiftId);
  }

  @ApiOperation({ summary: 'Assign shift to employee' })
  @Post('assign/single')
  @HttpCode(HttpStatus.CREATED)
  async assignShift(
    @CurrentHospital() hospitalId: string,
    @Body() dto: AssignShiftToEmployeeDto,
  ) {
    return this.shiftsService.assignShiftToEmployee(hospitalId, dto);
  }

  @ApiOperation({ summary: 'Bulk assign shift to multiple employees' })
  @Post('assign/bulk')
  @HttpCode(HttpStatus.CREATED)
  async bulkAssignShift(
    @CurrentHospital() hospitalId: string,
    @Body() dto: BulkAssignShiftDto,
  ) {
    return this.shiftsService.bulkAssignShift(hospitalId, dto);
  }

  @ApiOperation({ summary: 'Remove shift assignment from employee' })
  @Delete('assignments/:assignmentId')
  @HttpCode(HttpStatus.OK)
  async removeEmployeeShift(
    @CurrentHospital() hospitalId: string,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: RemoveEmployeeShiftDto,
  ) {
    return this.shiftsService.removeEmployeeShift(hospitalId, assignmentId, dto);
  }

  @ApiOperation({ summary: 'Get employee current shift' })
  @Get('employees/:employeeId/current')
  @HttpCode(HttpStatus.OK)
  async getEmployeeCurrentShift(
    @CurrentHospital() hospitalId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.shiftsService.getEmployeeCurrentShift(hospitalId, employeeId);
  }

  @ApiOperation({ summary: 'Get employee shift history' })
  @Get('employees/:employeeId/history')
  @HttpCode(HttpStatus.OK)
  async getEmployeeShiftHistory(
    @CurrentHospital() hospitalId: string,
    @Param('employeeId') employeeId: string,
    @Query() query: QueryEmployeeShiftsDto,
  ) {
    return this.shiftsService.getEmployeeShiftHistory(hospitalId, employeeId, query);
  }

  @ApiOperation({ summary: 'Check shift conflict for employee' })
  @Post('check-conflict')
  @HttpCode(HttpStatus.OK)
  async checkShiftConflict(
    @CurrentHospital() hospitalId: string,
    @Body() dto: CheckShiftConflictDto,
  ) {
    return this.shiftsService.checkShiftConflict(hospitalId, dto);
  }

  @ApiOperation({ summary: 'Get shift roster for department on specific date' })
  @Get('roster/:departmentId/:date')
  @HttpCode(HttpStatus.OK)
  async getShiftRoster(
    @CurrentHospital() hospitalId: string,
    @Param('departmentId') departmentId: string,
    @Param('date') date: string,
  ) {
    return this.shiftsService.getShiftRoster(hospitalId, departmentId, date);
  }

  @ApiOperation({ summary: 'Create shift rotation for employees' })
  @Post('rotation/create')
  @HttpCode(HttpStatus.CREATED)
  async createShiftRotation(
    @CurrentHospital() hospitalId: string,
    @Body() dto: ShiftRotationDto,
  ) {
    return this.shiftsService.createShiftRotation(hospitalId, dto);
  }

  @ApiOperation({ summary: 'Get shift statistics' })
  @Get('statistics/summary')
  @HttpCode(HttpStatus.OK)
  async getShiftStatistics(
    @CurrentHospital() hospitalId: string,
  ) {
    return this.shiftsService.getShiftStatistics(hospitalId);
  }
}

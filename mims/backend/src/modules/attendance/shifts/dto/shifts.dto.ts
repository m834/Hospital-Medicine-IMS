import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  IsEnum,
} from 'class-validator';

export class CreateShiftDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  @Max(23)
  @IsNotEmpty()
  startTime: number; // Hour (0-23)

  @IsNumber()
  @Min(0)
  @Max(59)
  @IsOptional()
  startMinute?: number; // Minute (0-59)

  @IsNumber()
  @Min(0)
  @Max(23)
  @IsNotEmpty()
  endTime: number; // Hour (0-23)

  @IsNumber()
  @Min(0)
  @Max(59)
  @IsOptional()
  endMinute?: number; // Minute (0-59)

  @IsNumber()
  @Min(0)
  @Max(60)
  @IsOptional()
  breakDurationMinutes?: number; // Break duration in minutes

  @IsNumber()
  @Min(0)
  @Max(30)
  @IsOptional()
  gracePeriodMinutes?: number; // Grace period for late arrivals

  @IsString({ each: true })
  @IsOptional()
  applicableDays?: string[]; // ['MON', 'TUE', 'WED', 'THU', 'FRI']

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  startTime?: number;

  @IsOptional()
  @IsNumber()
  startMinute?: number;

  @IsOptional()
  @IsNumber()
  endTime?: number;

  @IsOptional()
  @IsNumber()
  endMinute?: number;

  @IsOptional()
  @IsNumber()
  breakDurationMinutes?: number;

  @IsOptional()
  @IsNumber()
  gracePeriodMinutes?: number;

  @IsOptional()
  @IsString({ each: true })
  applicableDays?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AssignShiftToEmployeeDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  shiftId: string;

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkAssignShiftDto {
  @IsString()
  @IsNotEmpty()
  shiftId: string;

  @IsString({ each: true })
  @IsNotEmpty()
  employeeIds: string[];

  @IsDateString()
  @IsNotEmpty()
  effectiveFrom: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}

export class QueryShiftsDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  skip?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  take?: number;
}

export class QueryEmployeeShiftsDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  skip?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  take?: number;
}

export class ShiftRotationDto {
  @IsString({ each: true })
  @IsNotEmpty()
  shiftIds: string[]; // Order of shifts to rotate

  @IsString({ each: true })
  @IsNotEmpty()
  employeeIds: string[]; // Employees in rotation

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsNumber()
  @Min(1)
  rotationIntervalDays: number; // Days between shift changes

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CheckShiftConflictDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsString()
  @IsNotEmpty()
  shiftId: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class RemoveEmployeeShiftDto {
  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @IsString()
  @IsOptional()
  reason?: string;
}

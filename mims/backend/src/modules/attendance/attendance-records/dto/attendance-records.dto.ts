import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsNotEmpty,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@prisma/client';

export class MarkAttendanceDto {
  @ApiProperty({
    description: 'Employee ID',
    example: 'emp-123456',
  })
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @ApiProperty({
    description: 'Attendance date (ISO 8601 format)',
    example: '2026-02-17',
  })
  @IsDateString()
  @IsNotEmpty()
  attendanceDate: string;

  @ApiProperty({
    description: 'Check-in time (ISO 8601 format)',
    example: '2026-02-17T09:00:00Z',
  })
  @IsDateString()
  @IsNotEmpty()
  checkInTime: string;

  @ApiPropertyOptional({
    description: 'Check-out time (ISO 8601 format)',
    example: '2026-02-17T17:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  checkOutTime?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about attendance',
    example: 'Left early for medical appointment',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a manual mark (not from device)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isManualMark?: boolean;
}

export class CorrectAttendanceDto {
  @ApiProperty({
    enum: AttendanceStatus,
    description: 'Corrected attendance status',
    example: 'PRESENT',
  })
  @IsEnum(AttendanceStatus)
  @IsNotEmpty()
  status: AttendanceStatus;

  @ApiPropertyOptional({
    description: 'Corrected check-in time',
    example: '2026-02-17T09:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  correctedCheckInTime?: string;

  @ApiPropertyOptional({
    description: 'Corrected check-out time',
    example: '2026-02-17T17:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  correctedCheckOutTime?: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  approvedBy?: string;
}

export class QueryAttendanceDto {
  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

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

export class AttendanceSummaryDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;
}

export class MonthlyAttendanceDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  @Min(2000)
  year: number;
}

export class AttendanceLeaveCheckDto {
  @IsString()
  @IsNotEmpty()
  employeeId: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;
}

export class BulkMarkAttendanceDto {
  @IsString()
  @IsNotEmpty()
  departmentId: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString({ each: true })
  @IsNotEmpty()
  employeeIds: string[];

  @IsString()
  @IsNotEmpty()
  status: AttendanceStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AttendanceReportDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  reportType?: 'SUMMARY' | 'DETAILED' | 'EXCEPTION';
}

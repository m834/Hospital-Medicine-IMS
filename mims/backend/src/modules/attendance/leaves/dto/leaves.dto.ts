import {
  IsString,
  IsUUID,
  IsDateString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  Min,
  Max,
  IsEnum,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * Apply for leave
 */
export class ApplyLeaveDto {
  @IsUUID()
  @IsNotEmpty()
  leaveTypeId: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;

  @IsBoolean()
  @IsOptional()
  isMedicalLeave?: boolean;

  @IsString()
  @IsOptional()
  medicalCertificateUrl?: string;
}

/**
 * Approve or reject leave request
 */
export class ProcessLeaveRequestDto {
  @IsEnum(ApprovalDecision)
  @IsNotEmpty()
  decision: ApprovalDecision;

  @IsString()
  @IsOptional()
  comments?: string;

  @IsDateString()
  @IsOptional()
  approvedUpto?: string;
}

/**
 * Update leave request
 */
export class UpdateLeaveRequestDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  isMedicalLeave?: boolean;

  @IsString()
  @IsOptional()
  medicalCertificateUrl?: string;
}

/**
 * Cancel leave request
 */
export class CancelLeaveRequestDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * Query leave requests with filters
 */
export class QueryLeaveRequestsDto {
  @IsEnum(LeaveRequestStatus)
  @IsOptional()
  status?: LeaveRequestStatus;

  @IsUUID()
  @IsOptional()
  leaveTypeId?: string;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;

  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  skip?: number = 0;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  take?: number = 10;
}

/**
 * Get leave balance for employee
 */
export class GetLeaveBalanceDto {
  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsNumber()
  @IsOptional()
  year?: number;
}

/**
 * Update leave balance
 */
export class UpdateLeaveBalanceDto {
  @IsUUID()
  @IsNotEmpty()
  employeeId: string;

  @IsUUID()
  @IsNotEmpty()
  leaveTypeId: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(-365)
  @Max(365)
  balanceAdjustment: number;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsBoolean()
  @IsOptional()
  isAdmin?: boolean;
}

/**
 * Create/Update leave type
 */
export class CreateLeaveTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  @Max(365)
  annualAllowance: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean;

  @IsBoolean()
  @IsOptional()
  isMedicalLeaveType?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Update leave type
 */
export class UpdateLeaveTypeDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(365)
  annualAllowance?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  requiresApproval?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

/**
 * Holiday entry
 */
export class CreateHolidayDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;

  @IsString()
  @IsOptional()
  departmentId?: string;
}

/**
 * Update holiday
 */
export class UpdateHolidayDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isOptional?: boolean;
}

/**
 * Bulk leave request processing
 */
export class BulkProcessLeaveDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkLeaveItem)
  items: BulkLeaveItem[];

  @IsEnum(ApprovalDecision)
  @IsNotEmpty()
  decision: ApprovalDecision;

  @IsString()
  @IsOptional()
  comments?: string;
}

export class BulkLeaveItem {
  @IsString()
  @IsNotEmpty()
  leaveRequestId: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

/**
 * Leave statistics and reporting
 */
export class LeaveStatisticsQueryDto {
  @IsNumber()
  @IsOptional()
  year?: number;

  @IsString()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  employeeId?: string;

  @IsDateString()
  @IsOptional()
  fromDate?: string;

  @IsDateString()
  @IsOptional()
  toDate?: string;
}

/**
 * Set leave policy
 */
export class SetLeavePolicyDto {
  @IsUUID()
  @IsOptional()
  leaveTypeId?: string;

  @IsNumber()
  @IsOptional()
  maxConsecutiveDays?: number;

  @IsNumber()
  @IsOptional()
  minNoticeRequiredDays?: number;

  @IsBoolean()
  @IsOptional()
  allowPartialDay?: boolean;

  @IsBoolean()
  @IsOptional()
  carryForwardAllowed?: boolean;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  carryForwardPercentage?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

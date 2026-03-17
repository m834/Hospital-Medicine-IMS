import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum LatePenaltyType {
  NONE = 'NONE',
  HALF_DAY = 'HALF_DAY',
  ABSENT = 'ABSENT',
}

export enum LeavePayType {
  PAID = 'PAID',
  UNPAID = 'UNPAID',
}

export class UpsertPayrollSettingDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  monthlySalary: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  allowanceAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  otherDeductionAmount?: number;

  @IsEnum(LatePenaltyType)
  latePenaltyType: LatePenaltyType;

  @IsEnum(LeavePayType)
  leavePayType: LeavePayType;
}

export class PayrollRunQueryDto {
  @IsNumber()
  @Min(2000)
  @Type(() => Number)
  year: number;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  month: number;

  @IsOptional()
  @IsString()
  employeeId?: string;
}

export class PayrollGenerateDto {
  @IsNumber()
  @Min(2000)
  @Type(() => Number)
  year: number;

  @IsNumber()
  @Min(1)
  @Type(() => Number)
  month: number;
}

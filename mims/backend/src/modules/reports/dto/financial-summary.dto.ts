import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';

export enum FinancialReportPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export class FinancialSummaryDto {
  @IsEnum(FinancialReportPeriod)
  period: FinancialReportPeriod;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  hospitalId?: string;
}

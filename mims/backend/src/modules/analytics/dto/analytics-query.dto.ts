import { IsString, IsOptional, IsDateString, IsEnum } from 'class-validator';

export enum TimePeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  YEAR = 'year',
  CUSTOM = 'custom',
}

export class AnalyticsQueryDto {
  @IsString()
  @IsOptional()
  hospitalId?: string;

  @IsString()
  @IsOptional()
  pharmacyId?: string;

  @IsEnum(TimePeriod)
  @IsOptional()
  period?: TimePeriod = TimePeriod.MONTH;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}

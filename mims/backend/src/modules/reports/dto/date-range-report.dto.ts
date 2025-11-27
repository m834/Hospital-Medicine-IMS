import { IsString, IsOptional, IsDateString } from 'class-validator';

export class DateRangeReportDto {
  @IsString()
  pharmacyId: string;

  @IsDateString()
  startDate: string; // Format: YYYY-MM-DD

  @IsDateString()
  endDate: string; // Format: YYYY-MM-DD

  @IsString()
  @IsOptional()
  hospitalId?: string; // For SUPER_ADMIN
}

import { IsString, IsOptional, IsDateString } from 'class-validator';

export class DailyTransactionReportDto {
  @IsString()
  pharmacyId: string;

  @IsDateString()
  date: string; // Format: YYYY-MM-DD

  @IsString()
  @IsOptional()
  hospitalId?: string; // For SUPER_ADMIN
}

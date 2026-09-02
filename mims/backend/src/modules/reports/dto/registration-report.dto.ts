import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class RegistrationReportDto {
  @IsDateString()
  startDate: string; // Format: YYYY-MM-DD

  @IsDateString()
  endDate: string; // Format: YYYY-MM-DD — same as startDate for a daily report

  /** Narrows to the staff members assigned to this department. */
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /** Only a SUPER_ADMIN/MASTER_ADMIN (who has no hospital of their own) may name one. */
  @IsOptional()
  @IsString()
  hospitalId?: string;
}

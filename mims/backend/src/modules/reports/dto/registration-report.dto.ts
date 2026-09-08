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

  /**
   * Narrows to one registration staff member. Ignored for a caller who is
   * pinned to their own row — the controller takes their id from the token.
   */
  @IsOptional()
  @IsUUID()
  staffId?: string;

  /** Only a SUPER_ADMIN/MASTER_ADMIN (who has no hospital of their own) may name one. */
  @IsOptional()
  @IsString()
  hospitalId?: string;
}

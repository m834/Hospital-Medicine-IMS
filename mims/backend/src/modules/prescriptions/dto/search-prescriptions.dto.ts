import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';

export enum PrescriptionStatus {
  PENDING = 'PENDING',
  ISSUED = 'ISSUED',
  PARTIALLY_ISSUED = 'PARTIALLY_ISSUED',
  CANCELLED = 'CANCELLED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
}
import { Type } from 'class-transformer';

export class SearchPrescriptionsDto {
  @IsOptional()
  @IsString()
  hospitalId?: string; // Passed from frontend but handled by controller

  @IsOptional()
  @IsString()
  nrNumber?: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsEnum(PrescriptionStatus)
  status?: PrescriptionStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}

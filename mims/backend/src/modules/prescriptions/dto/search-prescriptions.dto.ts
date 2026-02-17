import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
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
  @IsEnum(['PENDING', 'ISSUED', 'PARTIALLY_ISSUED', 'CANCELLED'])
  status?: 'PENDING' | 'ISSUED' | 'PARTIALLY_ISSUED' | 'CANCELLED';

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

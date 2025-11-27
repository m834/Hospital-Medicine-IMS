import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';

export class SearchPrescriptionsDto {
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
  @IsInt()
  @Min(1)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;
}

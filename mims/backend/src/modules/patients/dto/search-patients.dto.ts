import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchPatientsDto {
  @IsString()
  @IsOptional()
  search?: string; // Search by NR-Number, name, CNIC, or mobile

  @IsString()
  @IsOptional()
  nrNumber?: string;

  @IsString()
  @IsOptional()
  cnic?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsEnum(['MALE', 'FEMALE', 'OTHER'], { message: 'Invalid gender' })
  @IsOptional()
  gender?: 'MALE' | 'FEMALE' | 'OTHER';

  @IsEnum(['OPD', 'EMERGENCY', 'WARD_INDOOR'], { message: 'Invalid visit type' })
  @IsOptional()
  visitType?: 'OPD' | 'EMERGENCY' | 'WARD_INDOOR';

  @IsString()
  @IsOptional()
  attendingDoctorId?: string;

  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 50;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsString()
  @IsOptional()
  sortBy?: string = 'registeredAt';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

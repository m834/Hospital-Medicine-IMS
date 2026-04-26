import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

export enum VisitType {
  OPD = 'OPD',
  EMERGENCY = 'EMERGENCY',
  WARD_INDOOR = 'WARD_INDOOR',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class SearchPatientsDto {
  @IsString()
  @IsOptional()
  hospitalId?: string; // For SUPER_ADMIN to query specific hospital

  @IsString()
  @IsOptional()
  search?: string; // Search by MRN, name, CNIC, or mobile

  @IsString()
  @IsOptional()
  nrNumber?: string;

  @IsString()
  @IsOptional()
  cnic?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsEnum(Gender, { message: 'Invalid gender' })
  @IsOptional()
  gender?: string;

  @IsEnum(VisitType, { message: 'Invalid visit type' })
  @IsOptional()
  visitType?: string;

  @IsString()
  @IsOptional()
  attendingDoctorId?: string;

  @IsInt()
  @Min(1)
  @Max(2000)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: string;
}

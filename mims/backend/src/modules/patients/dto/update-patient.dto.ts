import { IsOptional, IsString, IsEnum, IsDateString, Matches } from 'class-validator';

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

export class UpdatePatientDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsDateString({}, { message: 'Invalid date of birth format' })
  @IsOptional()
  dob?: string;

  @IsEnum(Gender, { message: 'Invalid gender' })
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsOptional()
  @Matches(/^[0-9]{5}-[0-9]{7}-[0-9]$/, { message: 'Invalid CNIC format (XXXXX-XXXXXXX-X)' })
  cnic?: string;

  @IsString()
  @IsOptional()
  @Matches(/^(\+92|0)[0-9]{10}$/, { message: 'Invalid mobile number format' })
  mobile?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsEnum(VisitType, { message: 'Invalid visit type' })
  @IsOptional()
  visitType?: VisitType;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  ward?: string;

  @IsString()
  @IsOptional()
  bed?: string;

  @IsString()
  @IsOptional()
  attendingDoctorId?: string;
}

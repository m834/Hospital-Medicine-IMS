import { IsNotEmpty, IsString, IsEnum, IsOptional, IsDateString, Matches, IsUUID, IsObject, ValidateNested } from 'class-validator';

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
import { Type } from 'class-transformer';
import { VitalSignsDto } from '../../visits/dto';

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsDateString({}, { message: 'Invalid date of birth format' })
  @IsOptional()
  dob?: string;

  @IsEnum(Gender, { message: 'Invalid gender' })
  @IsNotEmpty({ message: 'Gender is required' })
  gender: Gender;

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

  @IsString()
  @IsOptional()
  nrNumber?: string;

  @IsEnum(VisitType, { message: 'Invalid visit type' })
  @IsNotEmpty({ message: 'Visit type is required' })
  visitType: VisitType;

  @IsUUID()
  @IsOptional()
  clinicId?: string;

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

  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => VitalSignsDto)
  vitalSigns?: VitalSignsDto;

  @IsString()
  @IsOptional()
  notes?: string;
}


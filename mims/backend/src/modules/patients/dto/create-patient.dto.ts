import { IsNotEmpty, IsString, IsEnum, IsOptional, IsDateString, IsUUID, IsObject, ValidateNested, Matches } from 'class-validator';

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
  @IsOptional()
  gender?: Gender;

  @IsString()
  @IsNotEmpty({ message: 'CNIC is required' })
  @Matches(/^\d{5}-\d{7}-\d$/, { message: 'Enter a valid CNIC (XXXXX-XXXXXXX-X)' })
  cnic: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  nrNumber?: string;

  @IsEnum(VisitType, { message: 'Invalid visit type' })
  @IsOptional()
  visitType?: VisitType;

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


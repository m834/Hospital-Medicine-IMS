import { IsNotEmpty, IsString, IsEnum, IsOptional, IsDateString, IsUUID, IsObject, ValidateNested, Matches, IsInt, Min, Max, Validate } from 'class-validator';

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

export enum GuardianType {
  WIFE = 'WIFE',
  CHILD = 'CHILD',
}

export enum PatientIdType {
  CNIC = 'CNIC',
  OTHER = 'OTHER',
}
import { Type } from 'class-transformer';
import { VitalSignsDto } from '../../visits/dto';
import { PatientIdNumberConstraint } from './patient-id-number.validator';

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName: string;

  @IsDateString({}, { message: 'Invalid date of birth format' })
  @IsOptional()
  dob?: string;

  @Type(() => Number)
  @IsInt({ message: 'Age must be a whole number' })
  @Min(0, { message: 'Age must be 0 or greater' })
  @Max(150, { message: 'Enter a valid age' })
  @IsOptional()
  age?: number;

  @IsEnum(GuardianType, { message: 'Invalid guardian type' })
  @IsOptional()
  guardianType?: GuardianType;

  @IsEnum(Gender, { message: 'Invalid gender' })
  @IsOptional()
  gender?: Gender;

  /**
   * How to read the identifier below. CNIC is the Pakistani national ID and is
   * format-checked; OTHER covers passports and foreign IDs, which have no
   * single format. Defaults to CNIC so existing callers are unaffected.
   */
  @IsEnum(PatientIdType, { message: 'Invalid ID type' })
  @IsOptional()
  idType?: PatientIdType;

  /**
   * The identifier itself — optional, and format-checked as a CNIC only when it
   * is supplied and idType says so. See PatientIdNumberConstraint. A patient
   * saved without one simply has no family key, so every registration under the
   * same (blank) ID creates its own MRN.
   */
  @Validate(PatientIdNumberConstraint)
  @IsOptional()
  cnic?: string;

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


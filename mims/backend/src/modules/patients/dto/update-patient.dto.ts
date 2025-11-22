import { IsOptional, IsString, IsEnum, IsDateString, Matches } from 'class-validator';

export class UpdatePatientDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsDateString({}, { message: 'Invalid date of birth format' })
  @IsOptional()
  dob?: string;

  @IsEnum(['MALE', 'FEMALE', 'OTHER'], { message: 'Invalid gender' })
  @IsOptional()
  gender?: 'MALE' | 'FEMALE' | 'OTHER';

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

  @IsEnum(['OPD', 'EMERGENCY', 'WARD_INDOOR'], { message: 'Invalid visit type' })
  @IsOptional()
  visitType?: 'OPD' | 'EMERGENCY' | 'WARD_INDOOR';

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

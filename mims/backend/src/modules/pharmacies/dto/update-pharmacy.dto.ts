import { IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { PharmacyType, PharmacyStatus } from '@prisma/client';

export class UpdatePharmacyDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsEnum(PharmacyType)
  @IsOptional()
  type?: PharmacyType;

  @IsString()
  @IsOptional()
  locationWard?: string;

  @IsEnum(PharmacyStatus)
  @IsOptional()
  status?: PharmacyStatus;

  // Move under a main pharmacy (forces type SUB), or pass null to detach it
  // back to top level. Omit to leave the current parent untouched.
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  @IsOptional()
  parentPharmacyId?: string | null;
}

import { IsEnum, IsOptional, IsString } from 'class-validator';
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
}

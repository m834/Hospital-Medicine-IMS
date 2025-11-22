import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { PharmacyType } from '@prisma/client';

export class CreatePharmacyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(PharmacyType)
  @IsNotEmpty()
  type: PharmacyType;

  @IsString()
  @IsOptional()
  locationWard?: string;

  @IsUUID()
  @IsNotEmpty()
  hospitalId: string;
}

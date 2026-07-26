import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { PharmacyType } from '@prisma/client';

export class CreatePharmacyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  // Optional: when parentPharmacyId is supplied the type is forced to SUB.
  @IsEnum(PharmacyType)
  @IsOptional()
  type?: PharmacyType;

  @IsString()
  @IsOptional()
  locationWard?: string;

  @IsUUID()
  @IsNotEmpty()
  hospitalId: string;

  // Present = create a sub pharmacy under this main pharmacy.
  @IsUUID()
  @IsOptional()
  parentPharmacyId?: string;
}

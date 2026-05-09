import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsEnum, IsInt, Min, IsBoolean } from 'class-validator';
import { BatchCategory } from '@prisma/client';

export enum PrescriptionType {
  E_PRESCRIPTION = 'E_PRESCRIPTION',
  SCANNED = 'SCANNED',
  WRITTEN = 'WRITTEN',
}
import { Type } from 'class-transformer';

export class PrescriptionItemDto {
  @IsString()
  @IsNotEmpty()
  medicineId: string;

  @IsInt()
  @Min(1)
  qtyPrescribed: number;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsString()
  duration?: string;

  @IsEnum(BatchCategory)
  @IsOptional()
  transferCategory?: BatchCategory;
}

export class CreatePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  nrNumber: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsEnum(PrescriptionType)
  prescriptionType: PrescriptionType;

  @IsOptional()
  @IsString()
  scannedImageUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];

  @IsOptional()
  @IsBoolean()
  autoIssue?: boolean;
}

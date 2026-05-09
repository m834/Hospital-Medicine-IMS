import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsEnum, IsInt, Min, IsBoolean } from 'class-validator';
import { BatchCategory } from '@prisma/client';
import { Type } from 'class-transformer';

export enum PrescriptionType {
  E_PRESCRIPTION = 'E_PRESCRIPTION',
  SCANNED = 'SCANNED',
  WRITTEN = 'WRITTEN',
}

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

export class PrescriptionMedicineDto {
  @IsString()
  @IsNotEmpty()
  medicineId: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsEnum(BatchCategory)
  @IsOptional()
  category?: BatchCategory;
}

export class CreatePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  nrNumber: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsOptional()
  @IsString()
  visitId?: string;

  @IsEnum(PrescriptionType)
  prescriptionType: PrescriptionType;

  @IsOptional()
  @IsString()
  scannedImageUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items?: PrescriptionItemDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  prescriptionMedicines?: PrescriptionMedicineDto[];

  @IsOptional()
  @IsBoolean()
  autoIssue?: boolean;
}

import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsEnum } from 'class-validator';
import { BatchCategory, DosageFrequency } from '@prisma/client';
import { Type } from 'class-transformer';

export enum PrescriptionType {
  E_PRESCRIPTION = 'E_PRESCRIPTION',
  SCANNED = 'SCANNED',
  WRITTEN = 'WRITTEN',
}

export class PrescriptionMedicineDto {
  @IsString()
  @IsNotEmpty()
  medicineId: string;

  @IsOptional()
  @IsString()
  dosage?: string;

  @IsOptional()
  @IsEnum(DosageFrequency)
  dosageFrequency?: DosageFrequency;

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
  @IsOptional()
  prescriptionType?: PrescriptionType;

  @IsOptional()
  @IsString()
  scannedImageUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  prescriptionMedicines: PrescriptionMedicineDto[];
}

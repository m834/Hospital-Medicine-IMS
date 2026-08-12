import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsEnum, IsInt, Min, IsDateString } from 'class-validator';
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
  @IsInt()
  @Min(1)
  quantity?: number;

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

  /**
   * Date the prescription was actually written, for entering one after the
   * fact. Omit for a prescription being written now. Date only (yyyy-mm-dd);
   * the server keeps the current time of day so ordering within a day holds.
   */
  @IsOptional()
  @IsDateString()
  prescribedAt?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionMedicineDto)
  prescriptionMedicines: PrescriptionMedicineDto[];
}

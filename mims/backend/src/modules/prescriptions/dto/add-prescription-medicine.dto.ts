import { IsString, IsOptional, IsEnum } from 'class-validator';
import { BatchCategory, DosageFrequency } from '@prisma/client';

export class AddPrescriptionMedicineDto {
  @IsString()
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

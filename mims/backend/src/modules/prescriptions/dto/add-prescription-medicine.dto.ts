import { IsString, IsOptional, IsEnum } from 'class-validator';
import { BatchCategory } from '@prisma/client';

export class AddPrescriptionMedicineDto {
  @IsString()
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

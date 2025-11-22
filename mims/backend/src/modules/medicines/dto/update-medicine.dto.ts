import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { MedicineForm, MedicineStatus } from '@prisma/client';

export class UpdateMedicineDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  genericName?: string;

  @IsEnum(MedicineForm, { message: 'Invalid medicine form' })
  @IsOptional()
  form?: MedicineForm;

  @IsString()
  @IsOptional()
  strength?: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  reorderLevel?: number;

  @IsString()
  @IsOptional()
  storageInstructions?: string;

  @IsEnum(MedicineStatus, { message: 'Invalid medicine status' })
  @IsOptional()
  status?: MedicineStatus;
}

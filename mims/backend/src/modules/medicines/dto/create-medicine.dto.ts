import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { MedicineForm } from '@prisma/client';

export class CreateMedicineDto {
  @IsString()
  @IsOptional()
  hospitalId?: string; // Optional - Super Admin can provide, others use their own

  @IsString()
  @IsNotEmpty({ message: 'Medicine name is required' })
  name: string;

  @IsString()
  @IsOptional()
  genericName?: string;

  @IsEnum(MedicineForm, { message: 'Invalid medicine form' })
  @IsNotEmpty({ message: 'Medicine form is required' })
  form: MedicineForm;

  @IsString()
  @IsOptional()
  strength?: string;

  @IsString()
  @IsOptional()
  manufacturer?: string;
}

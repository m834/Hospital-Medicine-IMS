import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BatchCategory, DosageFrequency } from '@prisma/client';

export class MedicineTemplateItemDto {
  @IsString()
  @IsNotEmpty()
  medicineId: string;

  @IsOptional()
  @IsEnum(DosageFrequency)
  dosageFrequency?: DosageFrequency;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsEnum(BatchCategory)
  category?: BatchCategory;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class CreateMedicineTemplateDto {
  @IsString()
  @IsNotEmpty({ message: 'Template title is required' })
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  // Optional: admins/main-pharmacy users may target a specific pharmacy.
  // Pharmacy staff default to their own assigned pharmacy.
  @IsOptional()
  @IsString()
  pharmacyId?: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one medicine' })
  @ValidateNested({ each: true })
  @Type(() => MedicineTemplateItemDto)
  items: MedicineTemplateItemDto[];
}

import { IsString, IsOptional, IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { MedicineTemplateItemDto } from './create-medicine-template.dto';

export class UpdateMedicineTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  // When provided, the template's medicine list is fully replaced with these items.
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one medicine' })
  @ValidateNested({ each: true })
  @Type(() => MedicineTemplateItemDto)
  items?: MedicineTemplateItemDto[];
}

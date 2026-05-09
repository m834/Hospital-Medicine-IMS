import { IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class DispatchItemDto {
  @IsString()
  prescriptionMedicineId: string;

  @IsInt()
  @Min(1)
  quantityDispatched: number;
}

export class CreatePrescriptionDispatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispatchItemDto)
  items: DispatchItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

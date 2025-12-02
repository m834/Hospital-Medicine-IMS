import { IsString, IsNotEmpty, IsArray, ValidateNested, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

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
}

export class CreatePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  nrNumber: string;

  @IsOptional()
  @IsString()
  doctorId?: string;

  @IsEnum(['E_PRESCRIPTION', 'SCANNED', 'WRITTEN'])
  prescriptionType: 'E_PRESCRIPTION' | 'SCANNED' | 'WRITTEN';

  @IsOptional()
  @IsString()
  scannedImageUrl?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];
}

import { IsString, IsArray, IsOptional, ValidateNested, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class TransferItemDto {
  @IsString()
  medicineId: string;

  @IsInt()
  @Min(1)
  qtyRequested: number;
}

export class CreateTransferRequestDto {
  @IsString()
  fromPharmacyId: string;

  @IsString()
  toPharmacyId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];

  @IsString()
  requestedBy: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

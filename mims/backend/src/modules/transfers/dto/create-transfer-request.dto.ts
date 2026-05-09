import { IsString, IsArray, IsOptional, ValidateNested, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { BatchCategory } from '@prisma/client';

export class TransferItemDto {
  @IsString()
  medicineId: string;

  @IsInt()
  @Min(1)
  qtyRequested: number;

  @IsEnum(BatchCategory)
  @IsOptional()
  transferCategory?: BatchCategory;
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

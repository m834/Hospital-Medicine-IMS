import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TransferStatus } from '@prisma/client';

export class SearchTransferRequestDto {
  @IsString()
  @IsOptional()
  hospitalId?: string;

  @IsString()
  @IsOptional()
  pharmacyId?: string;

  @IsString()
  @IsOptional()
  fromPharmacyId?: string;

  @IsString()
  @IsOptional()
  toPharmacyId?: string;

  @IsEnum(TransferStatus)
  @IsOptional()
  status?: TransferStatus;

  @IsInt()
  @Min(1)
  @Max(2000)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 100;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;
}

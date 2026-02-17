import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { BatchStatus, StorageType } from '@prisma/client';

export class SearchStockBatchDto {
  @IsString()
  @IsOptional()
  hospitalId?: string; // Passed from frontend but handled by controller

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  medicineId?: string;

  @IsString()
  @IsOptional()
  pharmacyId?: string;

  @IsString()
  @IsOptional()
  batchNo?: string;

  @IsEnum(BatchStatus)
  @IsOptional()
  status?: BatchStatus;

  @IsEnum(StorageType)
  @IsOptional()
  storageType?: StorageType;

  @IsOptional()
  expiringBefore?: string; // ISO date string

  @IsOptional()
  expiringAfter?: string; // ISO date string

  @IsInt()
  @Min(1)
  @Max(200)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 50;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number = 1;

  @IsString()
  @IsOptional()
  sortBy?: string = 'receivedDate';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

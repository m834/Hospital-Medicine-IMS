import { IsString, IsOptional, IsEnum, IsInt, IsBoolean, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BatchStatus, StorageType, BatchCategory } from '@prisma/client';

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

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

  @IsEnum(BatchCategory)
  @IsOptional()
  category?: BatchCategory;

  @IsString()
  @IsOptional()
  dispensingUnit?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  lowStockOnly?: boolean; // Filter batches below their reorder level

  @IsOptional()
  expiringBefore?: string; // ISO date string

  @IsOptional()
  expiringAfter?: string; // ISO date string

  @IsInt()
  @Min(1)
  @Max(2000)
  @Type(() => Number)
  @IsOptional()
  limit?: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: string;
}

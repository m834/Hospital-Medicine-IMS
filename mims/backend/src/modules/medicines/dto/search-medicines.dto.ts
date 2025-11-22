import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MedicineForm, MedicineStatus } from '@prisma/client';

export class SearchMedicinesDto {
  @IsString()
  @IsOptional()
  hospitalId?: string; // For Super Admin to filter by hospital

  @IsString()
  @IsOptional()
  search?: string; // Search by name, generic, or manufacturer

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  genericName?: string;

  @IsEnum(MedicineForm, { message: 'Invalid medicine form' })
  @IsOptional()
  form?: MedicineForm;

  @IsString()
  @IsOptional()
  manufacturer?: string;

  @IsEnum(MedicineStatus, { message: 'Invalid medicine status' })
  @IsOptional()
  status?: MedicineStatus;

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
  sortBy?: string = 'name';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'asc';
}

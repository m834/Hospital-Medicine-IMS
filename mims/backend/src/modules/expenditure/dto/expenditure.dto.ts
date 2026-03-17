import { IsString, IsNotEmpty, IsEnum, IsNumber, IsOptional, IsDateString } from 'class-validator';
import { ExpenditureType } from '@prisma/client';

export class CreateExpenditureDto {
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsEnum(ExpenditureType)
  @IsNotEmpty()
  type: ExpenditureType;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateExpenditureDto {
  @IsDateString()
  @IsOptional()
  date?: string;

  @IsEnum(ExpenditureType)
  @IsOptional()
  type?: ExpenditureType;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class ExpenditureFilterDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsEnum(ExpenditureType)
  @IsOptional()
  type?: ExpenditureType;
}

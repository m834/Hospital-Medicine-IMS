import { IsString, IsOptional, IsEnum, IsInt, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { IssueTransactionStatus } from '@prisma/client';

export class SearchIssuanceDto {
  @IsString()
  @IsOptional()
  nrNumber?: string;

  @IsString()
  @IsOptional()
  pharmacyId?: string;

  @IsString()
  @IsOptional()
  prescriptionId?: string;

  @IsEnum(IssueTransactionStatus)
  @IsOptional()
  status?: IssueTransactionStatus;

  @IsDateString()
  @IsOptional()
  issuedAfter?: string;

  @IsDateString()
  @IsOptional()
  issuedBefore?: string;

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
  sortBy?: string = 'issuedAt';

  @IsEnum(['asc', 'desc'])
  @IsOptional()
  sortOrder?: 'asc' | 'desc' = 'desc';
}

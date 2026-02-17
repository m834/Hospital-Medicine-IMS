import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { OperationTheatreStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class OperationTheatreQueryDto {
  @IsUUID()
  @IsOptional()
  hospitalId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsEnum(OperationTheatreStatus)
  @IsOptional()
  status?: OperationTheatreStatus;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;
}

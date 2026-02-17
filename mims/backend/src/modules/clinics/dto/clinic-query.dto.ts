import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { ClinicStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class ClinicQueryDto {
  @IsUUID()
  @IsOptional()
  hospitalId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  doctorId?: string;

  @IsEnum(ClinicStatus)
  @IsOptional()
  status?: ClinicStatus;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}

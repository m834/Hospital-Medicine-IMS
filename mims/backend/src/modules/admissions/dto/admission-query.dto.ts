import { IsOptional, IsUUID, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AdmissionType, AdmissionStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class AdmissionQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bedId?: string;

  @ApiPropertyOptional({ enum: AdmissionType })
  @IsOptional()
  @IsEnum(AdmissionType)
  admissionType?: AdmissionType;

  @ApiPropertyOptional({ enum: AdmissionStatus })
  @IsOptional()
  @IsEnum(AdmissionStatus)
  status?: AdmissionStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  admittedFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  admittedTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 20;
}

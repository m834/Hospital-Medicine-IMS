import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperationPatientType } from '@prisma/client';

export class CreateOperationDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  hospitalId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  @IsUUID()
  patientId: string;

  @ApiProperty({ enum: OperationPatientType, example: OperationPatientType.OPD })
  @IsEnum(OperationPatientType)
  patientType: OperationPatientType;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174002' })
  @IsOptional()
  @IsUUID()
  visitId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174003' })
  @IsOptional()
  @IsUUID()
  admissionId?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174004' })
  @IsUUID()
  departmentId: string;

  @ApiProperty({ example: 'Appendectomy' })
  @IsString()
  operationType: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174005' })
  @IsUUID()
  surgeonId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174006' })
  @IsUUID()
  theatreId: string;

  @ApiProperty({ example: '2026-02-05T10:30:00Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(15)
  estimatedDurationMinutes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  emergencyFlag?: boolean;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  operationPrice?: number;

  @ApiPropertyOptional({ example: 'Patient has mild hypertension.' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'NPO after midnight.' })
  @IsOptional()
  @IsString()
  preOpNotes?: string;
}

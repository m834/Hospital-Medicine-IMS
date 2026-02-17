import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdmissionType } from '@prisma/client';

export class CreateAdmissionDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  hospitalId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  @IsUUID()
  patientId: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174002' })
  @IsOptional()
  @IsUUID()
  visitId?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174003' })
  @IsUUID()
  departmentId: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174004' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174005' })
  @IsOptional()
  @IsUUID()
  bedId?: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174006' })
  @IsUUID()
  attendingDoctorId: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174007' })
  @IsUUID()
  admittingUserId: string;

  @ApiProperty({ enum: AdmissionType, example: AdmissionType.EMERGENCY })
  @IsEnum(AdmissionType)
  admissionType: AdmissionType;

  @ApiPropertyOptional({ example: '2026-01-25T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  expectedDischarge?: string;

  @ApiPropertyOptional({ example: 'Severe chest pain, suspected myocardial infarction' })
  @IsOptional()
  @IsString()
  diagnosisOnAdmission?: string;

  @ApiPropertyOptional({ example: 'Patient requires 24-hour monitoring' })
  @IsOptional()
  @IsString()
  notes?: string;
}

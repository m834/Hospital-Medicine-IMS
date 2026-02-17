import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsObject,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VisitType } from '@prisma/client';

export class VitalSignsDto {
  @IsString()
  @IsOptional()
  bloodPressureSystolic?: string;

  @IsString()
  @IsOptional()
  bloodPressureDiastolic?: string;

  @IsString()
  @IsOptional()
  pulse?: string;

  @IsString()
  @IsOptional()
  temperature?: string;

  @IsString()
  @IsOptional()
  spo2?: string;

  @IsString()
  @IsOptional()
  weight?: string;

  @IsString()
  @IsOptional()
  height?: string;

  @IsString()
  @IsOptional()
  respiratoryRate?: string;
}

export class CreateVisitDto {
  @IsUUID()
  @IsNotEmpty()
  hospitalId: string;

  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @IsUUID()
  @IsNotEmpty()
  registrarId: string;

  @IsEnum(VisitType)
  @IsNotEmpty()
  visitType: VisitType;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsString()
  @IsOptional()
  wardId?: string;

  @IsUUID()
  @IsOptional()
  bedId?: string;

  @IsUUID()
  @IsOptional()
  attendingDoctorId?: string;

  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => VitalSignsDto)
  vitalSigns?: VitalSignsDto;

  @IsString()
  @IsOptional()
  notes?: string;
}

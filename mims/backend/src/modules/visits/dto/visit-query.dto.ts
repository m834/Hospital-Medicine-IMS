import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { VisitStatus, PaymentStatus, VisitType } from '@prisma/client';
import { Type } from 'class-transformer';

export class VisitQueryDto {
  @IsUUID()
  @IsOptional()
  hospitalId?: string;

  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsUUID()
  @IsOptional()
  consultantId?: string;

  @IsEnum(VisitType)
  @IsOptional()
  visitType?: VisitType;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsUUID()
  @IsOptional()
  attendingDoctorId?: string;

  @IsEnum(VisitStatus)
  @IsOptional()
  status?: VisitStatus;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

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

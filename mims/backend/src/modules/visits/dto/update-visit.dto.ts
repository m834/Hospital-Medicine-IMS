import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VisitStatus, PaymentStatus } from '@prisma/client';
import { VitalSignsDto } from './create-visit.dto';

export class UpdateVisitDto {
  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @IsString()
  @IsOptional()
  historyOfIllness?: string;

  @IsString()
  @IsOptional()
  examination?: string;

  @IsString()
  @IsOptional()
  diagnosis?: string;

  @IsString()
  @IsOptional()
  treatmentPlan?: string;

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => VitalSignsDto)
  vitalSigns?: VitalSignsDto;

  @IsEnum(VisitStatus)
  @IsOptional()
  status?: VisitStatus;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

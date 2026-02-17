import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { ReceiptType, PaymentStatus, PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';

export class ReceiptQueryDto {
  @IsUUID()
  @IsOptional()
  hospitalId?: string;

  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @IsEnum(ReceiptType)
  @IsOptional()
  receiptType?: ReceiptType;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

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

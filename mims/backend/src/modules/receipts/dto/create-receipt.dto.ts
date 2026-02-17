import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { ReceiptType, PaymentMethod, PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateReceiptDto {
  @IsUUID()
  @IsNotEmpty()
  hospitalId: string;

  @IsUUID()
  @IsNotEmpty()
  patientId: string;

  @IsUUID()
  @IsOptional()
  visitId?: string;

  @IsUUID()
  @IsNotEmpty()
  departmentId: string;

  @IsUUID()
  @IsNotEmpty()
  generatedById: string;

  @IsEnum(ReceiptType)
  @IsNotEmpty()
  receiptType: ReceiptType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  amount: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  discount?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  tax?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  paidAmount?: number;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

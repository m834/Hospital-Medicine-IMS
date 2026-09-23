import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  Min,
} from 'class-validator';
import { TestPriority } from '@prisma/client';

export class CreateLabOrderDto {
  @IsUUID()
  @IsNotEmpty()
  hospitalId: string;

  @IsString()
  @IsNotEmpty()
  patientId: string; // Can be UUID or MRN (e.g., "MRN-20260120-0001")

  @IsUUID()
  @IsOptional()
  visitId?: string;

  @IsUUID()
  @IsNotEmpty()
  labTestId: string;

  @IsUUID()
  @IsNotEmpty()
  orderedById: string;

  @IsEnum(TestPriority)
  @IsOptional()
  priority?: TestPriority;

  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  /**
   * Book the order on a past date — a slip written on paper yesterday and
   * entered today. Only a registration manager or an admin may set it; the
   * service refuses it for anyone else and refuses a future date for everyone.
   * The order number, the receipt and the receipt number all follow this date,
   * so the day's revenue report adds up the way the desk's paper does.
   */
  @IsDateString()
  @IsOptional()
  orderedAt?: string;
}

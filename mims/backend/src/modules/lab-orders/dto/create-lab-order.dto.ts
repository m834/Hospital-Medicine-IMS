import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { TestPriority } from '@prisma/client';

export class CreateLabOrderDto {
  @IsUUID()
  @IsNotEmpty()
  hospitalId: string;

  @IsString()
  @IsNotEmpty()
  patientId: string; // Can be UUID or NR number (e.g., "NR-20260120-0001")

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
}

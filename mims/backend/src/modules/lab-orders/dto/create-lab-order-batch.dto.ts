import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TestPriority } from '@prisma/client';

export class LabOrderBatchTestDto {
  @IsUUID()
  @IsNotEmpty()
  labTestId: string;

  @IsEnum(TestPriority)
  @IsOptional()
  priority?: TestPriority;
}

/**
 * Every test for one patient, saved in a single request. One order and one
 * receipt per test, as before — but committed together, so an order is never
 * left half-saved, and the desk waits on one request instead of one per test.
 */
export class CreateLabOrderBatchDto {
  @IsUUID()
  @IsNotEmpty()
  hospitalId: string;

  @IsString()
  @IsNotEmpty()
  patientId: string; // UUID or MRN, as for a single order

  @IsUUID()
  @IsOptional()
  visitId?: string;

  @IsUUID()
  @IsNotEmpty()
  orderedById: string;

  @IsString()
  @IsOptional()
  clinicalNotes?: string;

  /** Same rules as a single order: managers only, never in the future. */
  @IsDateString()
  @IsOptional()
  orderedAt?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => LabOrderBatchTestDto)
  tests: LabOrderBatchTestDto[];
}

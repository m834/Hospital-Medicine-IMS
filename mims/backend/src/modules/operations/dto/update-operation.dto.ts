import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateOperationDto {
  @ApiPropertyOptional({ example: 'Appendectomy' })
  @IsOptional()
  @IsString()
  operationType?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174005' })
  @IsOptional()
  @IsUUID()
  surgeonId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174006' })
  @IsOptional()
  @IsUUID()
  theatreId?: string;

  @ApiPropertyOptional({ example: '2026-02-05T10:30:00Z' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ example: 90 })
  @IsOptional()
  @IsInt()
  @Min(15)
  estimatedDurationMinutes?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  emergencyFlag?: boolean;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  operationPrice?: number;

  @ApiPropertyOptional({ example: 'Updated notes' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ example: 'Pre-op checklist completed.' })
  @IsOptional()
  @IsString()
  preOpNotes?: string;

  @ApiPropertyOptional({ example: 'Post-op summary' })
  @IsOptional()
  @IsString()
  postOpNotes?: string;

  @ApiPropertyOptional({ example: 'Recovery stable.' })
  @IsOptional()
  @IsString()
  recoveryNotes?: string;

  @ApiPropertyOptional({ example: '2026-02-10T10:30:00Z' })
  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}

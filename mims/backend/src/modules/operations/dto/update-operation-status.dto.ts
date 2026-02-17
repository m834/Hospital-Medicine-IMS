import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperationStatus } from '@prisma/client';

export class UpdateOperationStatusDto {
  @ApiProperty({ enum: OperationStatus, example: OperationStatus.PRE_OP })
  @IsEnum(OperationStatus)
  status: OperationStatus;

  @ApiPropertyOptional({ example: 'Patient shifted to recovery' })
  @IsOptional()
  @IsString()
  postOpNotes?: string;

  @ApiPropertyOptional({ example: 'Vitals stable' })
  @IsOptional()
  @IsString()
  recoveryNotes?: string;

  @ApiPropertyOptional({ example: '2026-02-10T10:30:00Z' })
  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}

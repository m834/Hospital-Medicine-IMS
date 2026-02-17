import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OperationTheatreStatus } from '@prisma/client';

export class UpdateOperationTheatreDto {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174010' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: 'Main OT-1' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'OT-1' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'Building A - Floor 2' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ enum: OperationTheatreStatus, example: OperationTheatreStatus.ACTIVE })
  @IsOptional()
  @IsEnum(OperationTheatreStatus)
  status?: OperationTheatreStatus;

  @ApiPropertyOptional({ example: 'Renovated in 2026.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

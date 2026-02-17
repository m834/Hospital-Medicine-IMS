import { IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RescheduleOperationDto {
  @ApiProperty({ example: '2026-02-05T12:30:00Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174006' })
  @IsOptional()
  @IsUUID()
  theatreId?: string;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  @Min(15)
  estimatedDurationMinutes?: number;
}

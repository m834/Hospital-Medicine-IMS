import { IsString, IsUUID, IsDateString, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class DischargeAdmissionDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  dischargingUserId: string;

  @ApiProperty({ example: '2026-01-21T14:30:00Z' })
  @IsDateString()
  dischargedAt: string;

  @ApiProperty({ example: 'Patient fully recovered, discharged on own request' })
  @IsString()
  dischargeSummary: string;

  @ApiProperty({ example: 'Complete bed rest for 2 weeks, follow-up in 1 month' })
  @IsString()
  diagnosisOnDischarge: string;

  @ApiProperty({ example: 12500, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  estimatedTotal?: number;
}

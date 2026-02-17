import { IsString, IsUUID, IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAdmissionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  bedId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  attendingDoctorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expectedDischarge?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  diagnosisOnAdmission?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  treatmentSummary?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

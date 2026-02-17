import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OperationTheatreStatus } from '@prisma/client';

export class CreateOperationTheatreDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  hospitalId: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174010' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiProperty({ example: 'Main OT-1' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'OT-1' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ example: 'Building A - Floor 2' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ enum: OperationTheatreStatus, example: OperationTheatreStatus.ACTIVE })
  @IsOptional()
  @IsEnum(OperationTheatreStatus)
  status?: OperationTheatreStatus;

  @ApiPropertyOptional({ example: 'Equipped for general surgery.' })
  @IsOptional()
  @IsString()
  notes?: string;
}

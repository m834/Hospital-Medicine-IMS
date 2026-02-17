import {
  IsString,
  IsUUID,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BedType, BedStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateBedDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  hospitalId: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174001' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174002' })
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiProperty({ example: 'B-101-1' })
  @IsString()
  bedNumber: string;

  @ApiProperty({ enum: BedType, example: BedType.STANDARD })
  @IsEnum(BedType)
  bedType: BedType;

  @ApiProperty({ example: 1500.0, description: 'Daily rate for the bed' })
  @Type(() => Number)
  @IsNumber()
  dailyRate: number;

  @ApiPropertyOptional({
    example: ['ELECTRIC', 'SIDE_RAILS', 'IV_POLE'],
    description: 'Bed features',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ enum: BedStatus, example: BedStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(BedStatus)
  status?: BedStatus;

  @ApiPropertyOptional({ example: 'Recently serviced bed' })
  @IsOptional()
  @IsString()
  notes?: string;
}

import { IsOptional, IsUUID, IsEnum, IsNumber } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BedType, BedStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class BedQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roomId?: string;

  @ApiPropertyOptional({ enum: BedType })
  @IsOptional()
  @IsEnum(BedType)
  bedType?: BedType;

  @ApiPropertyOptional({ enum: BedStatus })
  @IsOptional()
  @IsEnum(BedStatus)
  status?: BedStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number = 20;
}

import { IsOptional, IsUUID, IsEnum, IsNumber, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType, RoomStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class RoomQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  hospitalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /** Restrict to the rooms one sub-pharmacy looks after. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  pharmacyId?: string;

  @ApiPropertyOptional({ enum: RoomType })
  @IsOptional()
  @IsEnum(RoomType)
  roomType?: RoomType;

  @ApiPropertyOptional({ enum: RoomStatus })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  floor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  building?: string;

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

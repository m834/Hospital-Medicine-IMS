import {
  IsString,
  IsUUID,
  IsEnum,
  IsNumber,
  IsOptional,
  IsArray,
  IsDecimal,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomType, RoomStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { Decimal } from '@prisma/client/runtime/library';

export class CreateRoomDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  hospitalId: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174001' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  /** Sub-pharmacy responsible for this room's ward prescriptions. */
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174002' })
  @IsOptional()
  @IsUUID()
  pharmacyId?: string;

  @ApiProperty({ example: '101' })
  @IsString()
  roomNumber: string;

  @ApiProperty({ enum: RoomType, example: RoomType.PRIVATE })
  @IsEnum(RoomType)
  roomType: RoomType;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  floor?: number;

  @ApiPropertyOptional({ example: 'Building A' })
  @IsOptional()
  @IsString()
  building?: string;

  @ApiProperty({ example: 2, description: 'Number of beds in the room' })
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  capacity: number;

  @ApiProperty({ example: 5000.0, description: 'Daily rate for the room' })
  @IsNumber()
  @Type(() => Number)
  dailyRate: number;

  @ApiPropertyOptional({
    example: ['AC', 'TV', 'ATTACHED_BATH', 'WIFI'],
    description: 'Room amenities',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];

  @ApiPropertyOptional({ enum: RoomStatus, example: RoomStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({ example: 'Newly renovated room' })
  @IsOptional()
  @IsString()
  notes?: string;
}

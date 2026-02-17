import { IsDateString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OperationTheatreAvailabilityQueryDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174006' })
  @IsUUID()
  theatreId: string;

  @ApiProperty({ example: '2026-02-05' })
  @IsDateString()
  date: string;
}

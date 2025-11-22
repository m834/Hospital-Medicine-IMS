import { PartialType } from '@nestjs/mapped-types';
import { CreateStockBatchDto } from './create-stock-batch.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { BatchStatus } from '@prisma/client';

export class UpdateStockBatchDto extends PartialType(CreateStockBatchDto) {
  @IsEnum(BatchStatus, { message: 'Invalid batch status' })
  @IsOptional()
  status?: BatchStatus;
}

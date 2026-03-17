import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DispenseBatchDto {
  @IsString()
  @IsNotEmpty({ message: 'Batch ID is required' })
  batchId: string;

  @IsInt()
  @Min(1, { message: 'Dispensing quantity must be at least 1' })
  @Type(() => Number)
  dispensingQty: number;
}

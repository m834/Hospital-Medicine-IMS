import { PartialType } from '@nestjs/mapped-types';
import { CreateLabOrderDto } from './create-lab-order.dto';
import { IsEnum, IsOptional } from 'class-validator';
import { LabOrderStatus } from '@prisma/client';

export class UpdateLabOrderDto extends PartialType(CreateLabOrderDto) {
  @IsEnum(LabOrderStatus)
  @IsOptional()
  status?: LabOrderStatus;
}

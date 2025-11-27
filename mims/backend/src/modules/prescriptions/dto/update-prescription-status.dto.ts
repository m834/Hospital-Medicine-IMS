import { IsEnum } from 'class-validator';

export class UpdatePrescriptionStatusDto {
  @IsEnum(['PENDING', 'ISSUED', 'PARTIALLY_ISSUED', 'CANCELLED'])
  status: 'PENDING' | 'ISSUED' | 'PARTIALLY_ISSUED' | 'CANCELLED';
}

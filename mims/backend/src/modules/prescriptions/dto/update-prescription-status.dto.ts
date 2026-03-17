import { IsEnum } from 'class-validator';

export enum PrescriptionStatus {
  PENDING = 'PENDING',
  ISSUED = 'ISSUED',
  PARTIALLY_ISSUED = 'PARTIALLY_ISSUED',
  CANCELLED = 'CANCELLED',
}

export class UpdatePrescriptionStatusDto {
  @IsEnum(PrescriptionStatus)
  status: PrescriptionStatus;
}

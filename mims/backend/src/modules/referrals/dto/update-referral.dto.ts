import {
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ReferralStatus } from '@prisma/client';

export class UpdateReferralDto {
  @IsEnum(ReferralStatus)
  @IsOptional()
  status?: ReferralStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

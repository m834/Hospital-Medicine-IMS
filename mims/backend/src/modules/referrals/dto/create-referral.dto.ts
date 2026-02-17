import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { ReferralType, ReferralPriority } from '@prisma/client';

export class CreateReferralDto {
  @IsUUID()
  @IsNotEmpty()
  hospitalId: string;

  @IsUUID()
  @IsNotEmpty()
  visitId: string;

  @IsUUID()
  @IsNotEmpty()
  fromDepartmentId: string;

  @IsUUID()
  @IsNotEmpty()
  toDepartmentId: string;

  @IsUUID()
  @IsNotEmpty()
  referrerId: string;

  @IsEnum(ReferralType)
  @IsNotEmpty()
  referralType: ReferralType;

  @IsEnum(ReferralPriority)
  @IsOptional()
  priority?: ReferralPriority;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

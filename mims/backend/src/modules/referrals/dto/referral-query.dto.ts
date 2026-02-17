import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsNumber,
  Min,
} from 'class-validator';
import { ReferralType, ReferralStatus, ReferralPriority } from '@prisma/client';
import { Type } from 'class-transformer';

export class ReferralQueryDto {
  @IsUUID()
  @IsOptional()
  hospitalId?: string;

  @IsUUID()
  @IsOptional()
  visitId?: string;

  @IsUUID()
  @IsOptional()
  fromDepartmentId?: string;

  @IsUUID()
  @IsOptional()
  toDepartmentId?: string;

  @IsEnum(ReferralType)
  @IsOptional()
  referralType?: ReferralType;

  @IsEnum(ReferralStatus)
  @IsOptional()
  status?: ReferralStatus;

  @IsEnum(ReferralPriority)
  @IsOptional()
  priority?: ReferralPriority;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;
}

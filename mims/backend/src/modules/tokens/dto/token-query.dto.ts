import {
  IsOptional,
  IsUUID,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { TokenStatus } from '@prisma/client';

export class TokenQueryDto {
  @IsUUID()
  @IsOptional()
  hospitalId?: string;

  @IsUUID()
  @IsOptional()
  clinicId?: string;

  @IsEnum(TokenStatus)
  @IsOptional()
  status?: TokenStatus;

  @IsDateString()
  @IsOptional()
  date?: string;
}

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator';
import { CLIENT_ERROR_KINDS } from './create-client-error.dto';

export class ClientErrorQueryDto {
  @IsOptional()
  @IsString()
  machineId?: string;

  @IsOptional()
  @IsIn(CLIENT_ERROR_KINDS)
  kind?: (typeof CLIENT_ERROR_KINDS)[number];

  @IsOptional()
  @IsString()
  hospitalId?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  /** Text to find in the message, route or API URL. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}
